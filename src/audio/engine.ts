// The AudioContext and everything scheduled on it: transport, metronome, reference tone,
// loop players, and the mic capture tap. The context clock is the master clock for the
// whole app. Video and UI read from it and never the other way round.

import type { TakeMeta } from '../state/panels'
import captureWorkletUrl from './capture.worklet.ts?worker&url'
import type { CaptureCommand } from './captureProtocol'
import { CAPTURE_PROCESSOR_NAME } from './captureProtocol'
import { noteFrequency } from './notes'
import type { CaptureChunk } from './take'
import { MAX_CAPTURE_CHANNELS } from './take'
import type { Meter } from './transport'
import {
  SCHEDULE_LEAD_SECONDS,
  barPosition,
  beatAt,
  firstBeatIndexAtOrAfter,
  loopOffset,
  secondsPerBar,
} from './transport'

/** How often the scheduler wakes. Timers jitter by several ms, so it runs well inside the lookahead. */
const SCHEDULER_INTERVAL_MS = 25
/** How far ahead clicks are handed to the audio thread. Must exceed the interval plus timer jitter. */
const SCHEDULE_AHEAD_SECONDS = 0.12

const CLICK_SECONDS = 0.03
const DOWNBEAT_HZ = 1760
const BEAT_HZ = 880
const OFFBEAT_LEVEL = 0.55

const TONE_ATTACK_SECONDS = 0.03
const TONE_RELEASE_SECONDS = 0.04
/** The reference tone ends this far before the downbeat, so its tail can't reach the recorded take. */
const TONE_GUARD_SECONDS = 0.02

/** Smoothing for volume changes. An instant gain jump clicks. */
const GAIN_SMOOTHING_SECONDS = 0.015

interface Player {
  readonly gain: GainNode
  buffer: AudioBuffer | null
  take: TakeMeta | null
  source: AudioBufferSourceNode | null
}

type SinkableContext = AudioContext & { setSinkId?: (sinkId: string) => Promise<void> }

export class AudioEngine {
  readonly context: AudioContext
  private readonly master: GainNode
  private readonly clickBus: GainNode
  private readonly captureNode: AudioWorkletNode
  private input: MediaStreamAudioSourceNode | null = null
  private meter: Meter
  private origin: number | null = null
  private nextBeat = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private metronomeOn = true
  private forcedClicksUntil = Number.NEGATIVE_INFINITY
  private readonly pendingClicks = new Set<OscillatorNode>()
  private readonly players = new Map<string, Player>()
  private onChunk: ((chunk: CaptureChunk) => void) | null = null

  private constructor(context: AudioContext, meter: Meter) {
    this.context = context
    this.meter = meter
    this.master = context.createGain()
    this.master.connect(context.destination)
    this.clickBus = context.createGain()
    this.clickBus.connect(this.master)

    this.captureNode = new AudioWorkletNode(context, CAPTURE_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      // A mono mic stays mono instead of being upmixed into two identical channels.
      channelCount: MAX_CAPTURE_CHANNELS,
      channelCountMode: 'clamped-max',
    })
    this.captureNode.port.onmessage = (event: MessageEvent<CaptureChunk>) => this.onChunk?.(event.data)
    // A node that reaches no destination may never be pulled, and then capture goes silent.
    // Route it through a muted gain so the mic is never heard directly.
    const sink = context.createGain()
    sink.gain.value = 0
    this.captureNode.connect(sink).connect(context.destination)
  }

  static async create(meter: Meter): Promise<AudioEngine> {
    const context = new AudioContext({ latencyHint: 'interactive' })
    await context.audioWorklet.addModule(captureWorkletUrl)
    return new AudioEngine(context, meter)
  }

  get sampleRate(): number {
    return this.context.sampleRate
  }

  get running(): boolean {
    return this.origin !== null
  }

  get gridOrigin(): number | null {
    return this.origin
  }

  get currentMeter(): Meter {
    return this.meter
  }

  /** Browsers start a context suspended until a user gesture. */
  async resume(): Promise<void> {
    if (this.context.state !== 'running') await this.context.resume()
  }

  close(): Promise<void> {
    this.stop()
    return this.context.close()
  }

  /** Returns false where the browser can't route a context to a chosen output. */
  async setSink(deviceId: string | null): Promise<boolean> {
    const context = this.context as SinkableContext
    if (typeof context.setSinkId !== 'function') return false
    await context.setSinkId(deviceId ?? '')
    return true
  }

  setInput(stream: MediaStream | null): void {
    this.input?.disconnect()
    this.input = stream && stream.getAudioTracks().length > 0 ? this.context.createMediaStreamSource(stream) : null
    this.input?.connect(this.captureNode)
  }

  /**
   * The context time the listener is hearing right now. Video follows this rather than
   * `currentTime`, which runs ahead of the speakers by the output latency.
   */
  heardTime(): number {
    if (typeof this.context.getOutputTimestamp === 'function') {
      const { contextTime, performanceTime } = this.context.getOutputTimestamp()
      if (contextTime !== undefined && performanceTime !== undefined && performanceTime > 0) {
        return contextTime + (performance.now() - performanceTime) / 1000
      }
    }
    return this.context.currentTime - (this.context.outputLatency || 0)
  }

  /** Seconds from a sound being scheduled to the player's response reaching the capture worklet. */
  roundTripLatency(inputTrack: MediaStreamTrack | null): number {
    const inputLatency = (inputTrack?.getSettings() as { latency?: number } | undefined)?.latency ?? 0
    return (this.context.outputLatency || 0) + this.context.baseLatency + inputLatency
  }

  /** Fractional bar under the listener's ears, or null while stopped. */
  heardBarPosition(): number | null {
    return this.origin === null ? null : barPosition(this.heardTime(), this.origin, this.meter)
  }

  setMetronome(on: boolean, volume: number): void {
    this.metronomeOn = on
    this.clickBus.gain.setTargetAtTime(volume, this.context.currentTime, GAIN_SMOOTHING_SECONDS)
  }

  /** Clicks until `time` even with the metronome off, because a count-in without clicks counts nothing. */
  forceClicksUntil(time: number): void {
    this.forcedClicksUntil = time
  }

  setMeter(meter: Meter): void {
    if (this.origin === null) {
      this.meter = meter
      return
    }
    // Keep the bar position under the playhead, so a tempo change while playing doesn't jump.
    const now = this.context.currentTime
    const position = barPosition(now, this.origin, this.meter)
    this.meter = meter
    this.origin = now - position * secondsPerBar(meter)
    this.cancelClicks()
    this.nextBeat = firstBeatIndexAtOrAfter(now, this.origin, meter)
    for (const [id, player] of this.players) {
      this.stopSource(player)
      this.startPlayer(id)
    }
  }

  start(origin: number = this.context.currentTime + SCHEDULE_LEAD_SECONDS): void {
    if (this.origin !== null) return
    this.origin = origin
    this.nextBeat = firstBeatIndexAtOrAfter(Math.max(origin, this.context.currentTime), origin, this.meter)
    for (const id of this.players.keys()) this.startPlayer(id)
    this.tick()
    this.timer = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.origin = null
    this.forcedClicksUntil = Number.NEGATIVE_INFINITY
    this.cancelClicks()
    for (const player of this.players.values()) this.stopSource(player)
  }

  /** Holds `midi` from `start` to just before `end`. Returns a function that silences it early. */
  scheduleTone(midi: number, volume: number, start: number, end: number): () => void {
    const stopAt = end - TONE_GUARD_SECONDS
    if (stopAt - start < TONE_ATTACK_SECONDS + TONE_RELEASE_SECONDS) return () => {}
    const osc = this.context.createOscillator()
    const envelope = this.context.createGain()
    osc.type = 'triangle'
    osc.frequency.value = noteFrequency(midi)
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(volume, start + TONE_ATTACK_SECONDS)
    envelope.gain.setValueAtTime(volume, stopAt - TONE_RELEASE_SECONDS)
    envelope.gain.linearRampToValueAtTime(0, stopAt)
    osc.connect(envelope).connect(this.master)
    osc.start(start)
    osc.stop(stopAt)
    const release = () => {
      osc.onended = null
      osc.disconnect()
      envelope.disconnect()
    }
    osc.onended = release
    return release
  }

  /** Installs a loop. It starts at once, phase-correct, if the transport is running. */
  setLoop(panelId: string, buffer: AudioBuffer, take: TakeMeta): void {
    const player = this.player(panelId)
    this.stopSource(player)
    player.buffer = buffer
    player.take = take
    this.startPlayer(panelId)
  }

  clearLoop(panelId: string): void {
    const player = this.players.get(panelId)
    if (!player) return
    this.stopSource(player)
    player.buffer = null
    player.take = null
  }

  removePanel(panelId: string): void {
    const player = this.players.get(panelId)
    if (!player) return
    this.stopSource(player)
    player.gain.disconnect()
    this.players.delete(panelId)
  }

  /** Silences a loop while its panel re-records, and keeps it in case the take is cancelled. */
  pauseLoop(panelId: string): void {
    const player = this.players.get(panelId)
    if (player) this.stopSource(player)
  }

  resumeLoop(panelId: string): void {
    this.startPlayer(panelId)
  }

  setMix(panelId: string, volume: number, muted: boolean): void {
    this.player(panelId).gain.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, GAIN_SMOOTHING_SECONDS)
  }

  /** A panel's post-fader output, which the exporter taps. */
  panelOutput(panelId: string): AudioNode {
    return this.player(panelId).gain
  }

  beginCapture(onChunk: (chunk: CaptureChunk) => void): void {
    this.onChunk = onChunk
    this.captureNode.port.postMessage('start' satisfies CaptureCommand)
  }

  endCapture(): void {
    this.captureNode.port.postMessage('stop' satisfies CaptureCommand)
    this.onChunk = null
  }

  private tick(): void {
    if (this.origin === null) return
    const now = this.context.currentTime
    const horizon = now + SCHEDULE_AHEAD_SECONDS
    for (;;) {
      const beat = beatAt(this.nextBeat, this.origin, this.meter)
      if (beat.time >= horizon) break
      // A throttled background tab can wake far behind. Past beats are dropped, not fired in a burst.
      const audible = this.metronomeOn || beat.time < this.forcedClicksUntil
      if (audible && beat.time >= now) this.click(beat.time, beat.beat === 0)
      this.nextBeat++
    }
  }

  private click(time: number, downbeat: boolean): void {
    const osc = this.context.createOscillator()
    const envelope = this.context.createGain()
    osc.frequency.value = downbeat ? DOWNBEAT_HZ : BEAT_HZ
    envelope.gain.setValueAtTime(0, time)
    envelope.gain.linearRampToValueAtTime(downbeat ? 1 : OFFBEAT_LEVEL, time + 0.002)
    envelope.gain.exponentialRampToValueAtTime(0.001, time + CLICK_SECONDS)
    osc.connect(envelope).connect(this.clickBus)
    osc.start(time)
    osc.stop(time + CLICK_SECONDS)
    this.pendingClicks.add(osc)
    osc.onended = () => {
      this.pendingClicks.delete(osc)
      envelope.disconnect()
    }
  }

  private cancelClicks(): void {
    // Disconnecting silences a click already handed to the audio thread; there is no unschedule.
    for (const osc of this.pendingClicks) {
      osc.onended = null
      osc.disconnect()
    }
    this.pendingClicks.clear()
  }

  private player(panelId: string): Player {
    let player = this.players.get(panelId)
    if (!player) {
      const gain = this.context.createGain()
      gain.connect(this.master)
      player = { gain, buffer: null, take: null, source: null }
      this.players.set(panelId, player)
    }
    return player
  }

  private startPlayer(panelId: string): void {
    const player = this.players.get(panelId)
    if (!player?.buffer || !player.take || player.source || this.origin === null) return
    const when = Math.max(this.origin, this.context.currentTime + SCHEDULE_LEAD_SECONDS)
    const offset = loopOffset(when, this.origin, this.meter, player.take.startBar, player.take.bars)
    const source = this.context.createBufferSource()
    source.buffer = player.buffer
    source.loop = true
    source.connect(player.gain)
    // The buffer is a whole number of frames, so it can be up to one frame shorter than the
    // loop's exact length. Wrap the offset into the buffer rather than start past its end.
    source.start(when, offset % player.buffer.duration)
    player.source = source
  }

  private stopSource(player: Player): void {
    if (!player.source) return
    player.source.stop()
    player.source.disconnect()
    player.source = null
  }
}

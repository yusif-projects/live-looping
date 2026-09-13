// One take, start to finish: count-in clicks and reference tone, sample-accurate audio
// capture, a video clip alongside, and the loop cut from them.

import { VIDEO_MIME_CANDIDATES, pickMimeType } from '../media/mime'
import type { BarCount, TakeMeta } from '../state/panels'
import type { AudioEngine } from './engine'
import type { CaptureChunk } from './take'
import {
  LOOP_FADE_IN_SECONDS,
  LOOP_FADE_OUT_SECONDS,
  MAX_CAPTURE_CHANNELS,
  applyEdgeFades,
  secondsToFrames,
  sliceTake,
} from './take'
import type { TakeAlignment, TakePlan } from './transport'
import { planTake, secondsPerBar } from './transport'

/** Video keeps recording this long past the loop's end, so a slow camera can't leave the last frames out of the clip. */
const VIDEO_TAIL_SECONDS = 0.5
/** With no mic delivering audio no chunk ever arrives, so the take is finished this long after its end anyway, as silence. */
const CAPTURE_TIMEOUT_SECONDS = 1
const VIDEO_BITS_PER_SECOND = 4_000_000
/** Short keyframe gaps make the seek at every loop wrap land quickly. Chromium honours this; other browsers ignore it. */
const VIDEO_KEYFRAME_INTERVAL_MS = 500

export interface TakeRequest {
  readonly panelId: string
  readonly bars: BarCount
  readonly countInBars: number
  /** Where the other loops let this take start, or null to count in `countInBars`. */
  readonly alignment: TakeAlignment | null
  readonly referenceNote: number | null
  readonly referenceVolume: number
  readonly latencyOffsetMs: number
  readonly micTrack: MediaStreamTrack | null
  readonly cameraStream: MediaStream | null
}

export interface RecordedTake {
  readonly meta: TakeMeta
  readonly buffer: AudioBuffer
  readonly channels: Float32Array[]
  readonly sampleRate: number
  readonly video: Blob | null
}

export interface TakeHandle {
  readonly plan: TakePlan
  /** Resolves with the take, or null when cancelled. */
  readonly done: Promise<RecordedTake | null>
  cancel(): void
}

export function toAudioBuffer(context: BaseAudioContext, channels: readonly Float32Array[], sampleRate: number): AudioBuffer {
  const buffer = context.createBuffer(channels.length, channels[0].length, sampleRate)
  channels.forEach((data, i) => buffer.getChannelData(i).set(data))
  return buffer
}

interface VideoClip {
  readonly blob: Blob
  /** Context time the listener was hearing when the clip's first frame was taken. */
  readonly heardStart: number
}

function startVideo(stream: MediaStream | null, heardTime: () => number): () => Promise<VideoClip | null> {
  const track = stream?.getVideoTracks()[0]
  if (!track || track.readyState !== 'live' || typeof MediaRecorder === 'undefined') return async () => null
  const mimeType = pickMimeType(VIDEO_MIME_CANDIDATES, (type) => MediaRecorder.isTypeSupported(type))
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(new MediaStream([track]), {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      videoKeyFrameIntervalDuration: VIDEO_KEYFRAME_INTERVAL_MS,
    } as MediaRecorderOptions)
  } catch {
    return async () => null
  }
  const parts: Blob[] = []
  let heardStart: number | null = null
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) parts.push(event.data)
  }
  // The start event is the closest the API gets to "first frame". Whatever it misses is left to the user's video offset.
  recorder.onstart = () => {
    heardStart = heardTime()
  }
  recorder.start()
  return () =>
    new Promise((resolve) => {
      if (recorder.state === 'inactive') return resolve(null)
      recorder.onstop = () =>
        resolve(
          heardStart === null || parts.length === 0
            ? null
            : { blob: new Blob(parts, { type: recorder.mimeType || mimeType }), heardStart },
        )
      recorder.onerror = () => resolve(null)
      recorder.stop()
    })
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function recordTake(
  engine: AudioEngine,
  request: TakeRequest,
  onStage: (stage: 'recording' | 'processing') => void,
): TakeHandle {
  const { context } = engine
  const meter = engine.currentMeter
  const rate = engine.sampleRate
  const plan = planTake(
    context.currentTime,
    engine.gridOrigin,
    meter,
    request.countInBars,
    request.bars,
    request.alignment,
  )

  if (!engine.running) engine.start(plan.origin)
  engine.pauseLoop(request.panelId)
  engine.forceClicksUntil(plan.recordStart)
  const releaseTone =
    request.referenceNote === null
      ? () => {}
      : engine.scheduleTone(request.referenceNote, request.referenceVolume, plan.countInStart, plan.recordStart)

  // The player hears the downbeat late by the output latency, and their sound reaches the
  // worklet later still by the input latency. The loop is cut that far after the grid line,
  // so what they played on the beat lands on the beat.
  const latency = engine.roundTripLatency(request.micTrack) + request.latencyOffsetMs / 1000
  const startFrame = secondsToFrames(plan.recordStart + latency, rate)
  const length = secondsToFrames(request.bars * secondsPerBar(meter), rate)
  const endFrame = startFrame + length

  const stopVideo = startVideo(request.cameraStream, () => engine.heardTime())
  const chunks: CaptureChunk[] = []
  const timers: number[] = []
  let channelCount = 1
  let finishing = false
  let settled = false

  let resolveDone: (take: RecordedTake | null) => void = () => {}
  let rejectDone: (error: unknown) => void = () => {}
  const done = new Promise<RecordedTake | null>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })

  const at = (time: number, run: () => void) => {
    timers.push(window.setTimeout(run, Math.max(0, (time - context.currentTime) * 1000)))
  }

  const finish = async () => {
    if (finishing || settled) return
    finishing = true
    timers.forEach(clearTimeout)
    engine.endCapture()
    onStage('processing')
    try {
      const channels = sliceTake(chunks, startFrame, length, channelCount)
      applyEdgeFades(channels, secondsToFrames(LOOP_FADE_IN_SECONDS, rate), secondsToFrames(LOOP_FADE_OUT_SECONDS, rate))
      await wait(VIDEO_TAIL_SECONDS * 1000)
      const clip = await stopVideo()
      if (settled) return
      settled = true
      resolveDone({
        meta: {
          startBar: plan.recordStartBar,
          bars: request.bars,
          videoOffset: clip ? plan.recordStart - clip.heardStart : 0,
        },
        buffer: toAudioBuffer(context, channels, rate),
        channels,
        sampleRate: rate,
        video: clip?.blob ?? null,
      })
    } catch (error) {
      if (settled) return
      settled = true
      engine.resumeLoop(request.panelId)
      rejectDone(error)
    }
  }

  engine.beginCapture((chunk) => {
    const chunkEnd = chunk.frame + (chunk.channels[0]?.length ?? 0)
    // Count-in audio is never part of the loop, so it isn't kept.
    if (chunkEnd <= startFrame) return
    channelCount = Math.max(channelCount, Math.min(chunk.channels.length, MAX_CAPTURE_CHANNELS))
    chunks.push(chunk)
    if (chunkEnd >= endFrame) void finish()
  })

  at(plan.recordStart, () => onStage('recording'))
  at(plan.recordEnd + latency + CAPTURE_TIMEOUT_SECONDS, () => void finish())

  const cancel = () => {
    if (settled) return
    settled = true
    timers.forEach(clearTimeout)
    engine.endCapture()
    engine.forceClicksUntil(Number.NEGATIVE_INFINITY)
    releaseTone()
    engine.resumeLoop(request.panelId)
    void stopVideo()
    resolveDone(null)
  }

  return { plan, done, cancel }
}

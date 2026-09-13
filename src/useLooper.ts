// The one bridge between the audio engine and React. Components receive plain state and
// callbacks. Anything that changes every frame (video sync, progress, bar display) is
// written straight to the DOM from one rAF loop instead of going through React state.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AudioEngine } from './audio/engine'
import { isHot, meterLevel, smoothLevel } from './audio/level'
import type { TakeHandle } from './audio/recorder'
import { recordTake, toAudioBuffer } from './audio/recorder'
import type { CountInDisplay, Meter, TakePlan } from './audio/transport'
import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_TEMPO,
  MAX_BEATS_PER_BAR,
  MAX_TEMPO,
  MIN_BEATS_PER_BAR,
  MIN_TEMPO,
  barPosition,
  countInDisplay,
  loopOffset,
  secondsPerBar,
} from './audio/transport'
import { clamp } from './lib/math'
import type { DeviceLists } from './media/devices'
import {
  NO_DEVICES,
  describeMediaError,
  listDevices,
  openCamera,
  openMic,
  requestMediaAccess,
  stopStream,
  supportsSpeakerChoice,
  watchDevices,
} from './media/devices'
import { exportPanels, saveBlob } from './media/exporter'
import { SEEK_THRESHOLD_SECONDS, correctVideo, expectedClipTime } from './media/videoSync'
import { cycleLabel, loopCycle, takeAlignment } from './state/cycle'
import type { BarCount, Panel, TakeMeta } from './state/panels'
import { MAX_PANELS, busyPanel, createPanel, isMeterLocked, panelsReducer } from './state/panels'
import type { Settings } from './state/settings'
import { SETTINGS_KEY, parseSettings, serializeSettings } from './state/settings'
import { LooperStore, isQuotaError } from './storage/db'
import { panelsFromProject, parseProject, toProject } from './storage/project'

export type Phase = 'gate' | 'starting' | 'ready'

export interface ExportState {
  readonly label: string
  readonly progress: number
}

export interface PanelHandlers {
  onRecord(panelId: string): void
  onClear(panelId: string): void
  onRemove(panelId: string): void
  onExport(panelId: string): void
  onBars(panelId: string, bars: BarCount): void
  onNote(panelId: string, note: number | null): void
  onVolume(panelId: string, volume: number): void
  onMute(panelId: string): void
}

/** Tempo and project edits arrive in bursts (dragging a slider). Saving each one would thrash IndexedDB. */
const PROJECT_SAVE_DEBOUNCE_MS = 300
/** Setting playbackRate every frame restarts Chromium's rate smoothing, so small changes are skipped. */
const RATE_EPSILON = 0.002

const STORAGE_FULL_NOTICE =
  'Browser storage is full. New loops play now but won’t survive a reload. Export them, or clear old loops.'

const newId = (): string => crypto.randomUUID()

function readStoredSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY))
  } catch {
    return parseSettings(null)
  }
}

const timestamp = (): string => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

function setText(el: Element | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text
}

function paintCountIn(root: HTMLElement, display: CountInDisplay) {
  const countdown = root.querySelector<HTMLElement>('.panel-countdown')
  if (!countdown) return
  setText(countdown.querySelector('.countdown-label'), `Recording in ${display.barsLeft} ${display.barsLeft === 1 ? 'bar' : 'bars'}`)
  setText(countdown.querySelector('.countdown-beat'), display.beatsLeft === null ? '' : String(display.beatsLeft))
  // toggleAttribute leaves the DOM alone when the attribute is already in that state.
  countdown.toggleAttribute('data-final', display.beatsLeft !== null)
  countdown.querySelectorAll('.countdown-dots i').forEach((dot, i) => {
    dot.toggleAttribute('data-on', display.beat !== null && i <= display.beat)
  })
}

function paintPanel(root: HTMLElement, panel: Panel, heard: number, origin: number | null, meter: Meter, plan: TakePlan | null) {
  let progress = 0
  if (origin !== null && plan) {
    const countIn = countInDisplay(heard, plan, meter)
    if (countIn) paintCountIn(root, countIn)
    else progress = clamp((heard - plan.recordStart) / (plan.recordEnd - plan.recordStart), 0, 1)
  } else if (origin !== null && panel.take) {
    progress = loopOffset(heard, origin, meter, panel.take.startBar, panel.take.bars) / (panel.take.bars * secondsPerBar(meter))
  }
  root.style.setProperty('--progress', progress.toFixed(4))
}

function syncVideo(video: HTMLVideoElement, take: TakeMeta, heard: number, origin: number | null, meter: Meter, videoShift: number) {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) return
  const clipOffset = take.videoOffset - videoShift
  if (origin === null) {
    // Stopped: rest on the loop's first frame.
    if (!video.paused) video.pause()
    const first = expectedClipTime(0, clipOffset)
    if (!video.seeking && Math.abs(video.currentTime - first) > SEEK_THRESHOLD_SECONDS) video.currentTime = first
    return
  }
  const expected = expectedClipTime(loopOffset(heard, origin, meter, take.startBar, take.bars), clipOffset)
  const { seekTo, playbackRate } = correctVideo(video.currentTime, expected)
  // A seek issued while one is pending restarts it, and the video never catches up.
  if (seekTo !== null && !video.seeking) video.currentTime = seekTo
  if (Math.abs(video.playbackRate - playbackRate) > RATE_EPSILON) video.playbackRate = playbackRate
  if (video.paused && !video.seeking) void video.play().catch(() => {})
}

export function useLooper() {
  const [phase, setPhase] = useState<Phase>('gate')
  const [gateError, setGateError] = useState<string | null>(null)
  const [settings, setSettings] = useState(readStoredSettings)
  const [tempo, setTempoState] = useState(DEFAULT_TEMPO)
  const [beatsPerBar, setBeatsPerBarState] = useState(DEFAULT_BEATS_PER_BAR)
  const [panels, dispatch] = useReducer(panelsReducer, undefined, () => [createPanel(newId())])
  const [running, setRunning] = useState(false)
  const [devices, setDevices] = useState<DeviceLists>(NO_DEVICES)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [videoUrls, setVideoUrls] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [exportState, setExportState] = useState<ExportState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [store] = useState(() => new LooperStore())

  const engineRef = useRef<AudioEngine | null>(null)
  const micTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const activeTakeRef = useRef<{ panelId: string; handle: TakeHandle } | null>(null)
  const exportAbortRef = useRef<AbortController | null>(null)
  const videoUrlsRef = useRef<ReadonlyMap<string, string>>(videoUrls)
  const panelsRef = useRef(panels)
  const settingsRef = useRef(settings)
  const videoEls = useRef(new Map<string, HTMLVideoElement>())
  const panelEls = useRef(new Map<string, HTMLElement>())
  const beatDisplayRef = useRef<HTMLElement | null>(null)
  const levelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    panelsRef.current = panels
  }, [panels])
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  useEffect(() => {
    cameraStreamRef.current = cameraStream
  }, [cameraStream])

  // Engine follows state.
  useEffect(() => {
    engineRef.current?.setMeter({ tempo, beatsPerBar })
  }, [phase, tempo, beatsPerBar])
  useEffect(() => {
    engineRef.current?.setMetronome(settings.metronomeOn, settings.metronomeVolume)
  }, [phase, settings.metronomeOn, settings.metronomeVolume])
  useEffect(() => {
    engineRef.current?.setMonitor(settings.monitorOn, settings.monitorVolume)
  }, [phase, settings.monitorOn, settings.monitorVolume])
  useEffect(() => {
    const engine = engineRef.current
    if (engine) for (const panel of panels) engine.setMix(panel.id, panel.volume, panel.muted)
  }, [phase, panels])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, serializeSettings(settings))
    } catch {
      // Private browsing or storage disabled: settings last for this visit only.
    }
  }, [settings])

  useEffect(() => {
    if (phase !== 'ready') return
    const timer = setTimeout(() => {
      store.saveProject(toProject(tempo, beatsPerBar, panels)).catch((error: unknown) => {
        setNotice(isQuotaError(error) ? STORAGE_FULL_NOTICE : 'The project could not be saved.')
      })
    }, PROJECT_SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [phase, store, tempo, beatsPerBar, panels])

  // Devices.
  useEffect(() => {
    if (phase !== 'ready') return
    let stream: MediaStream | null = null
    let cancelled = false
    openCamera(settings.cameraId).then(
      (opened) => {
        if (cancelled) {
          stopStream(opened)
          return
        }
        stream = opened
        setCameraStream(opened)
      },
      () => {
        if (cancelled) return
        setCameraStream(null)
        setNotice('No camera is available. Loops will record audio only.')
      },
    )
    return () => {
      cancelled = true
      stopStream(stream)
      setCameraStream(null)
    }
  }, [phase, settings.cameraId])

  useEffect(() => {
    const engine = engineRef.current
    if (phase !== 'ready' || !engine) return
    let stream: MediaStream | null = null
    let cancelled = false
    openMic(settings.micId).then(
      (opened) => {
        if (cancelled) {
          stopStream(opened)
          return
        }
        stream = opened
        micTrackRef.current = opened.getAudioTracks()[0] ?? null
        engine.setInput(opened)
      },
      (error: unknown) => {
        if (!cancelled) setNotice(describeMediaError(error))
      },
    )
    return () => {
      cancelled = true
      engine.setInput(null)
      micTrackRef.current = null
      stopStream(stream)
    }
  }, [phase, settings.micId])

  useEffect(() => {
    const engine = engineRef.current
    if (phase !== 'ready' || !engine) return
    engine.setSink(settings.speakerId).catch(() => {
      setNotice('That speaker could not be selected, so audio stays on the system default.')
      setSettings((s) => ({ ...s, speakerId: null }))
    })
  }, [phase, settings.speakerId])

  useEffect(() => {
    if (phase !== 'ready') return
    const refresh = () => {
      listDevices().then(setDevices, () => {})
    }
    refresh()
    return watchDevices(refresh)
  }, [phase])

  // Per-frame: bar display, panel progress and countdowns, video sync.
  useEffect(() => {
    if (phase !== 'ready') return
    let frame = 0
    let level = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const engine = engineRef.current
      if (!engine) return
      const origin = engine.gridOrigin
      const meter = engine.currentMeter
      const heard = engine.heardTime()
      const levelBar = levelRef.current
      if (levelBar) {
        level = smoothLevel(level, meterLevel(engine.inputPeak()))
        const value = level.toFixed(3)
        if (levelBar.style.getPropertyValue('--level') !== value) levelBar.style.setProperty('--level', value)
        levelBar.toggleAttribute('data-hot', isHot(level))
      }
      const display = beatDisplayRef.current
      if (display) {
        const cycle = loopCycle(panelsRef.current)
        const label =
          origin === null
            ? `– / ${cycle.bars}`
            : cycleLabel(Math.max(0, Math.floor(barPosition(heard, origin, meter))), cycle)
        if (display.textContent !== label) display.textContent = label
      }
      const active = activeTakeRef.current
      const videoShift = settingsRef.current.videoOffsetMs / 1000
      for (const panel of panelsRef.current) {
        const root = panelEls.current.get(panel.id)
        if (root) paintPanel(root, panel, heard, origin, meter, active?.panelId === panel.id ? active.handle.plan : null)
        const video = videoEls.current.get(panel.id)
        if (video && panel.take && !panel.stage) syncVideo(video, panel.take, heard, origin, meter, videoShift)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  useEffect(
    () => () => {
      activeTakeRef.current?.handle.cancel()
      exportAbortRef.current?.abort()
      for (const url of videoUrlsRef.current.values()) URL.revokeObjectURL(url)
      void engineRef.current?.close()
      engineRef.current = null
    },
    [],
  )

  const replaceVideoUrl = useCallback((panelId: string, blob: Blob | null) => {
    const next = new Map(videoUrlsRef.current)
    const previous = next.get(panelId)
    if (previous) URL.revokeObjectURL(previous)
    if (blob) next.set(panelId, URL.createObjectURL(blob))
    else next.delete(panelId)
    videoUrlsRef.current = next
    setVideoUrls(next)
  }, [])

  const enable = useCallback(async () => {
    setPhase('starting')
    setGateError(null)
    let engine = engineRef.current
    try {
      engine ??= await AudioEngine.create({ tempo: DEFAULT_TEMPO, beatsPerBar: DEFAULT_BEATS_PER_BAR })
      engineRef.current = engine
      await engine.resume()
    } catch {
      setGateError('Audio could not start in this browser. A recent Chrome, Edge or Firefox works best.')
      setPhase('gate')
      return
    }
    try {
      await requestMediaAccess()
    } catch (error) {
      setGateError(describeMediaError(error))
      setPhase('gate')
      return
    }

    let raw: unknown = null
    let takeIds = new Set<string>()
    try {
      ;[raw, takeIds] = await Promise.all([store.loadProject(), store.takeIds()])
    } catch {
      setNotice('Saved loops could not be read, so this is a fresh project.')
    }
    const project = parseProject(raw)
    if (project) {
      setTempoState(project.tempo)
      setBeatsPerBarState(project.beatsPerBar)
      engine.setMeter({ tempo: project.tempo, beatsPerBar: project.beatsPerBar })
      const urls = new Map<string, string>()
      const restored = await Promise.all(
        panelsFromProject(project, takeIds).map(async (panel) => {
          if (!panel.take) return panel
          const media = await store.loadTake(panel.id).catch(() => null)
          if (!media) return { ...panel, take: null }
          engine.setLoop(panel.id, toAudioBuffer(engine.context, media.channels, media.sampleRate), panel.take)
          if (media.video) urls.set(panel.id, URL.createObjectURL(media.video))
          return panel
        }),
      )
      // Media whose panel the project no longer lists (a crash between two writes) would hold storage forever.
      const listed = new Set(restored.map((p) => p.id))
      for (const id of takeIds) if (!listed.has(id)) store.deleteTake(id).catch(() => {})
      videoUrlsRef.current = urls
      setVideoUrls(urls)
      dispatch({ type: 'load', panels: restored })
    }
    setPhase('ready')
  }, [store])

  const record = useCallback(
    (panelId: string) => {
      const engine = engineRef.current
      if (!engine || exportAbortRef.current) return
      const active = activeTakeRef.current
      if (active) {
        if (active.panelId === panelId) active.handle.cancel()
        return
      }
      const panel = panelsRef.current.find((p) => p.id === panelId)
      if (!panel) return
      const s = settingsRef.current
      dispatch({ type: 'stage', id: panelId, stage: 'countIn' })
      let handle: TakeHandle
      try {
        void engine.resume()
        handle = recordTake(
          engine,
          {
            panelId,
            bars: panel.bars,
            countInBars: s.countInBars,
            alignment: takeAlignment(panelsRef.current, panelId),
            referenceNote: panel.noteOverride ?? s.referenceNote,
            referenceVolume: s.referenceVolume,
            latencyOffsetMs: s.latencyOffsetMs,
            micTrack: micTrackRef.current,
            cameraStream: cameraStreamRef.current,
          },
          (stage) => dispatch({ type: 'stage', id: panelId, stage }),
        )
      } catch {
        dispatch({ type: 'cancelTake', id: panelId })
        setNotice('Recording could not start.')
        return
      }
      activeTakeRef.current = { panelId, handle }
      setRunning(true)
      handle.done.then(
        async (take) => {
          activeTakeRef.current = null
          if (!take) {
            dispatch({ type: 'cancelTake', id: panelId })
            return
          }
          engine.setLoop(panelId, take.buffer, take.meta)
          replaceVideoUrl(panelId, take.video)
          dispatch({ type: 'takeReady', id: panelId, take: take.meta })
          try {
            await store.saveTake({ panelId, video: take.video, sampleRate: take.sampleRate, channels: take.channels })
          } catch (error) {
            setNotice(isQuotaError(error) ? STORAGE_FULL_NOTICE : 'This loop could not be saved. It plays until the page closes.')
          }
        },
        () => {
          activeTakeRef.current = null
          dispatch({ type: 'cancelTake', id: panelId })
          setNotice('Recording failed. Try again.')
        },
      )
    },
    [store, replaceVideoUrl],
  )

  const togglePlay = useCallback(() => {
    const engine = engineRef.current
    if (!engine || exportAbortRef.current) return
    if (engine.running) {
      activeTakeRef.current?.handle.cancel()
      engine.stop()
      setRunning(false)
    } else {
      void engine.resume()
      engine.start()
      setRunning(true)
    }
  }, [])

  const clear = useCallback(
    (panelId: string) => {
      const panel = panelsRef.current.find((p) => p.id === panelId)
      if (!panel?.take || panel.stage) return
      engineRef.current?.clearLoop(panelId)
      replaceVideoUrl(panelId, null)
      dispatch({ type: 'clearTake', id: panelId })
      store.deleteTake(panelId).catch(() => {})
    },
    [store, replaceVideoUrl],
  )

  const removePanel = useCallback(
    (panelId: string) => {
      const list = panelsRef.current
      const panel = list.find((p) => p.id === panelId)
      if (!panel || panel.stage || list.length <= 1) return
      engineRef.current?.removePanel(panelId)
      replaceVideoUrl(panelId, null)
      dispatch({ type: 'remove', id: panelId })
      store.deleteTake(panelId).catch(() => {})
    },
    [store, replaceVideoUrl],
  )

  const clearAll = useCallback(() => {
    activeTakeRef.current?.handle.cancel()
    for (const panel of panelsRef.current) {
      engineRef.current?.clearLoop(panel.id)
      replaceVideoUrl(panel.id, null)
    }
    dispatch({ type: 'clearAll' })
    store.clearTakes().catch(() => {})
  }, [store, replaceVideoUrl])

  const exportLoops = useCallback(async (panelId: string | null) => {
    const engine = engineRef.current
    if (!engine || activeTakeRef.current || exportAbortRef.current) return
    const all = panelsRef.current
    const targets = all.filter((p) => p.take && (panelId === null || p.id === panelId))
    if (targets.length === 0) return
    const number = panelId === null ? null : all.findIndex((p) => p.id === panelId) + 1
    const controller = new AbortController()
    exportAbortRef.current = controller
    setExportState({ label: number === null ? `Exporting ${targets.length} loops` : `Exporting loop ${number}`, progress: 0 })
    setRunning(true)
    try {
      await engine.resume()
      const { blob, extension } = await exportPanels(engine, {
        panels: targets,
        videoFor: (id) => videoEls.current.get(id) ?? null,
        onProgress: (progress) => setExportState((s) => s && { ...s, progress }),
        signal: controller.signal,
      })
      saveBlob(blob, `live-looping-${number === null ? 'all' : `loop-${number}`}-${timestamp()}.${extension}`)
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'AbortError') {
        setNotice('Export failed. Try again, or export fewer loops at once.')
      }
    } finally {
      exportAbortRef.current = null
      setExportState(null)
      setRunning(engine.running)
    }
  }, [])

  const cancelExport = useCallback(() => exportAbortRef.current?.abort(), [])

  const setTempo = useCallback((value: number) => {
    if (isMeterLocked(panelsRef.current)) return
    setTempoState(Math.round(clamp(value, MIN_TEMPO, MAX_TEMPO, DEFAULT_TEMPO)))
  }, [])

  const setBeatsPerBar = useCallback((value: number) => {
    if (isMeterLocked(panelsRef.current)) return
    setBeatsPerBarState(Math.round(clamp(value, MIN_BEATS_PER_BAR, MAX_BEATS_PER_BAR, DEFAULT_BEATS_PER_BAR)))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [])

  const addPanel = useCallback(() => dispatch({ type: 'add', id: newId() }), [])

  const panelHandlers = useMemo<PanelHandlers>(
    () => ({
      onRecord: record,
      onClear: clear,
      onRemove: removePanel,
      onExport: (panelId) => void exportLoops(panelId),
      onBars: (id, bars) => dispatch({ type: 'setBars', id, bars }),
      onNote: (id, note) => dispatch({ type: 'setNote', id, note }),
      onVolume: (id, volume) => dispatch({ type: 'setVolume', id, volume }),
      onMute: (id) => dispatch({ type: 'toggleMute', id }),
    }),
    [record, clear, removePanel, exportLoops],
  )

  const registerVideo = useCallback((panelId: string, el: HTMLVideoElement | null) => {
    if (el) videoEls.current.set(panelId, el)
    else videoEls.current.delete(panelId)
  }, [])

  const registerPanel = useCallback((panelId: string, el: HTMLElement | null) => {
    if (el) panelEls.current.set(panelId, el)
    else panelEls.current.delete(panelId)
  }, [])

  const registerBeatDisplay = useCallback((el: HTMLElement | null) => {
    beatDisplayRef.current = el
  }, [])

  return {
    phase,
    gateError,
    enable,
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    settings,
    updateSettings,
    tempo,
    beatsPerBar,
    setTempo,
    setBeatsPerBar,
    meterLocked: isMeterLocked(panels),
    running,
    togglePlay,
    devices,
    speakerSupported: supportsSpeakerChoice(),
    cameraStream,
    panels,
    busyPanelId: busyPanel(panels)?.id ?? null,
    hasLoops: panels.some((p) => p.take !== null),
    canAddPanel: panels.length < MAX_PANELS,
    addPanel,
    clearAll,
    panelHandlers,
    videoUrls,
    exportState,
    exportAll: useCallback(() => void exportLoops(null), [exportLoops]),
    cancelExport,
    registerVideo,
    registerPanel,
    registerBeatDisplay,
    registerLevel: useCallback((el: HTMLElement | null) => {
      levelRef.current = el
    }, []),
  }
}

export type Looper = ReturnType<typeof useLooper>

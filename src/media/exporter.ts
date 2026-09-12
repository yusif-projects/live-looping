// Renders panels into one video file in real time: their synced <video> elements drawn onto a
// canvas, plus their post-fader audio, through a single MediaRecorder.

import type { AudioEngine } from '../audio/engine'
import { SCHEDULE_LEAD_SECONDS, secondsPerBar } from '../audio/transport'
import { clamp } from '../lib/math'
import {
  EXPORT_FPS,
  EXPORT_GRID_GAP,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  coverCrop,
  exportBars,
  exportStartBar,
  gridLayout,
} from '../state/exportPlan'
import type { Panel, TakeMeta } from '../state/panels'
import { AV_MIME_CANDIDATES, extensionForMime, pickMimeType } from './mime'

/**
 * MediaRecorder starts at an unknown moment, so the file can't be made to begin exactly on a
 * bar. Instead the recorder starts early and the audio is gated on the context clock. The
 * file opens with this much black silence and then the first bar lands sample-exact.
 */
const EXPORT_PREROLL_SECONDS = 0.4
/** Runs briefly past the last bar so the encoder flushes the final frames. */
const EXPORT_TAIL_SECONDS = 0.15
const EXPORT_VIDEO_BITS_PER_SECOND = 8_000_000
/** Each progress report re-renders React; ten a second reads as smooth. */
const PROGRESS_INTERVAL_MS = 100
const BACKGROUND = '#0b0a08'

export interface ExportOptions {
  readonly panels: readonly Panel[]
  videoFor(panelId: string): HTMLVideoElement | null
  onProgress(fraction: number): void
  readonly signal: AbortSignal
}

export interface ExportResult {
  readonly blob: Blob
  readonly extension: string
}

export function exportPanels(engine: AudioEngine, options: ExportOptions): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const panels = options.panels.filter((p) => p.take !== null)
    const takes = panels.map((p) => p.take as TakeMeta)
    const canvas = document.createElement('canvas')
    const painter = canvas.getContext('2d')
    if (takes.length === 0 || !painter || typeof MediaRecorder === 'undefined') {
      reject(new Error('Nothing to export'))
      return
    }
    canvas.width = EXPORT_WIDTH
    canvas.height = EXPORT_HEIGHT

    const { context } = engine
    const barSeconds = secondsPerBar(engine.currentMeter)
    const exportStart = context.currentTime + Math.max(EXPORT_PREROLL_SECONDS, SCHEDULE_LEAD_SECONDS)
    const exportEnd = exportStart + exportBars(takes) * barSeconds
    engine.stop()
    engine.start(exportStart - exportStartBar(takes) * barSeconds)

    const rects =
      panels.length === 1
        ? [{ x: 0, y: 0, width: EXPORT_WIDTH, height: EXPORT_HEIGHT }]
        : gridLayout(panels.length, EXPORT_WIDTH, EXPORT_HEIGHT, EXPORT_GRID_GAP)

    const gate = context.createGain()
    gate.gain.setValueAtTime(0, context.currentTime)
    gate.gain.setValueAtTime(1, exportStart)
    gate.gain.setValueAtTime(0, exportEnd)
    // The canvas shows what the listener hears, but the destination node receives audio before
    // the output device has delayed it. Delaying the recorded audio by that gap keeps the
    // file's picture and sound together.
    const delay = context.createDelay(1)
    delay.delayTime.value = clamp(context.currentTime - engine.heardTime(), 0, 1, 0)
    const destination = context.createMediaStreamDestination()
    gate.connect(delay).connect(destination)
    for (const panel of panels) engine.panelOutput(panel.id).connect(gate)

    const videoTrack = canvas.captureStream(EXPORT_FPS).getVideoTracks()
    const stream = new MediaStream([...videoTrack, ...destination.stream.getAudioTracks()])
    const mimeType = pickMimeType(AV_MIME_CANDIDATES, (type) => MediaRecorder.isTypeSupported(type))
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: EXPORT_VIDEO_BITS_PER_SECOND,
      })
    } catch (error) {
      reject(error)
      return
    }

    const parts: Blob[] = []
    let frame = 0
    let lastProgress = 0

    const cleanup = () => {
      cancelAnimationFrame(frame)
      options.signal.removeEventListener('abort', onAbort)
      for (const panel of panels) {
        try {
          engine.panelOutput(panel.id).disconnect(gate)
        } catch {
          // The panel was removed mid-export and its output is already gone.
        }
      }
      gate.disconnect()
      delay.disconnect()
      for (const track of stream.getTracks()) track.stop()
    }

    const onAbort = () => {
      cleanup()
      recorder.onstop = null
      if (recorder.state !== 'inactive') recorder.stop()
      reject(new DOMException('Export cancelled', 'AbortError'))
    }
    options.signal.addEventListener('abort', onAbort, { once: true })

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) parts.push(event.data)
    }
    recorder.onstop = () => {
      cleanup()
      const type = recorder.mimeType || mimeType || 'video/webm'
      resolve({ blob: new Blob(parts, { type }), extension: extensionForMime(type) })
    }

    const draw = () => {
      frame = requestAnimationFrame(draw)
      const heard = engine.heardTime()
      painter.fillStyle = BACKGROUND
      painter.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
      if (heard >= exportStart && heard < exportEnd) {
        panels.forEach((panel, i) => {
          const video = options.videoFor(panel.id)
          if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return
          const rect = rects[i]
          const crop = coverCrop(video.videoWidth, video.videoHeight, rect.width, rect.height)
          painter.drawImage(video, crop.x, crop.y, crop.width, crop.height, rect.x, rect.y, rect.width, rect.height)
        })
      }
      const now = performance.now()
      if (now - lastProgress >= PROGRESS_INTERVAL_MS) {
        lastProgress = now
        options.onProgress(clamp((heard - exportStart) / (exportEnd - exportStart), 0, 1))
      }
      if (heard >= exportEnd + EXPORT_TAIL_SECONDS && recorder.state === 'recording') recorder.stop()
    }

    recorder.start()
    draw()
  })
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking at once can cancel the download before the browser has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

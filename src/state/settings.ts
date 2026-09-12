// Per-machine preferences, kept in localStorage. Tempo and panels are part of the project
// (storage/project.ts), because recorded loops depend on them.

import { DEFAULT_REFERENCE_NOTE, isReferenceNote } from '../audio/notes'
import { clamp } from '../lib/math'

export const SETTINGS_KEY = 'live-looping:settings:v1'

export const MIN_COUNT_IN_BARS = 1
export const MAX_COUNT_IN_BARS = 4
/** Round-trip audio latency correction. Past ±200 ms something other than latency is wrong. */
export const LATENCY_OFFSET_RANGE_MS = 200
/** Camera pipelines lag further behind audio than interfaces do, so the video range is wider. */
export const VIDEO_OFFSET_RANGE_MS = 300

export interface Settings {
  readonly metronomeOn: boolean
  readonly metronomeVolume: number
  readonly countInBars: number
  /** MIDI note held during the count-in, or null for no tone. */
  readonly referenceNote: number | null
  readonly referenceVolume: number
  readonly cameraId: string | null
  readonly micId: string | null
  readonly speakerId: string | null
  /** Positive moves recorded audio earlier, compensating for more latency. */
  readonly latencyOffsetMs: number
  /** Positive moves video later relative to audio. */
  readonly videoOffsetMs: number
}

export const DEFAULT_SETTINGS: Settings = {
  metronomeOn: true,
  metronomeVolume: 0.6,
  countInBars: 1,
  referenceNote: DEFAULT_REFERENCE_NOTE,
  referenceVolume: 0.4,
  cameraId: null,
  micId: null,
  speakerId: null,
  latencyOffsetMs: 0,
  videoOffsetMs: 0,
}

type Raw = Record<string, unknown>

const numberOr = (raw: Raw, key: keyof Settings, min: number, max: number): number => {
  const fallback = DEFAULT_SETTINGS[key] as number
  const value = raw[key]
  return typeof value === 'number' ? clamp(value, min, max, fallback) : fallback
}

const booleanOr = (raw: Raw, key: keyof Settings): boolean => {
  const value = raw[key]
  return typeof value === 'boolean' ? value : (DEFAULT_SETTINGS[key] as boolean)
}

const deviceId = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

/** Reads whatever localStorage holds. A missing, corrupt or partial value degrades field by field to defaults. */
export function parseSettings(stored: string | null): Settings {
  if (stored === null) return DEFAULT_SETTINGS
  let raw: unknown
  try {
    raw = JSON.parse(stored)
  } catch {
    return DEFAULT_SETTINGS
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_SETTINGS
  const r = raw as Raw
  return {
    metronomeOn: booleanOr(r, 'metronomeOn'),
    metronomeVolume: numberOr(r, 'metronomeVolume', 0, 1),
    countInBars: Math.round(numberOr(r, 'countInBars', MIN_COUNT_IN_BARS, MAX_COUNT_IN_BARS)),
    // null is a deliberate "no tone", distinct from a missing key.
    referenceNote: r.referenceNote === null ? null : isReferenceNote(r.referenceNote) ? r.referenceNote : DEFAULT_SETTINGS.referenceNote,
    referenceVolume: numberOr(r, 'referenceVolume', 0, 1),
    cameraId: deviceId(r.cameraId),
    micId: deviceId(r.micId),
    speakerId: deviceId(r.speakerId),
    latencyOffsetMs: numberOr(r, 'latencyOffsetMs', -LATENCY_OFFSET_RANGE_MS, LATENCY_OFFSET_RANGE_MS),
    videoOffsetMs: numberOr(r, 'videoOffsetMs', -VIDEO_OFFSET_RANGE_MS, VIDEO_OFFSET_RANGE_MS),
  }
}

export const serializeSettings = (settings: Settings): string => JSON.stringify(settings)

// The saved project: tempo, meter and panels, stored in IndexedDB. Media lives in a
// separate store keyed by panel id (storage/db.ts).

import { isReferenceNote } from '../audio/notes'
import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_TEMPO,
  MAX_BEATS_PER_BAR,
  MAX_TEMPO,
  MIN_BEATS_PER_BAR,
  MIN_TEMPO,
} from '../audio/transport'
import { clamp } from '../lib/math'
import type { BarCount, Panel, TakeMeta } from '../state/panels'
import { DEFAULT_BARS, DEFAULT_PANEL_VOLUME, MAX_PANELS, isBarCount } from '../state/panels'

export const PROJECT_VERSION = 1

export interface StoredPanel {
  readonly id: string
  readonly bars: BarCount
  readonly noteOverride: number | null
  readonly volume: number
  readonly muted: boolean
  readonly take: TakeMeta | null
}

export interface Project {
  readonly version: typeof PROJECT_VERSION
  readonly tempo: number
  readonly beatsPerBar: number
  readonly panels: readonly StoredPanel[]
}

export function toProject(tempo: number, beatsPerBar: number, panels: readonly Panel[]): Project {
  return {
    version: PROJECT_VERSION,
    tempo,
    beatsPerBar,
    // A take in progress isn't saved: its media doesn't exist yet.
    panels: panels.map(({ id, bars, noteOverride, volume, muted, take }) => ({ id, bars, noteOverride, volume, muted, take })),
  }
}

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)

function parseTake(raw: unknown): TakeMeta | null {
  if (!isObject(raw) || !isBarCount(raw.bars)) return null
  if (typeof raw.startBar !== 'number' || !Number.isInteger(raw.startBar)) return null
  if (typeof raw.videoOffset !== 'number' || !Number.isFinite(raw.videoOffset)) return null
  return { startBar: raw.startBar, bars: raw.bars, videoOffset: raw.videoOffset }
}

function parsePanel(raw: unknown): StoredPanel | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || raw.id === '') return null
  const take = parseTake(raw.take)
  return {
    id: raw.id,
    // A take's own length wins, so the panel can never disagree with its audio.
    bars: take?.bars ?? (isBarCount(raw.bars) ? raw.bars : DEFAULT_BARS),
    noteOverride: isReferenceNote(raw.noteOverride) ? raw.noteOverride : null,
    volume: typeof raw.volume === 'number' ? clamp(raw.volume, 0, 1, DEFAULT_PANEL_VOLUME) : DEFAULT_PANEL_VOLUME,
    muted: raw.muted === true,
    take,
  }
}

/** Validates a stored project. Returns null when there's nothing usable, so the caller starts fresh. */
export function parseProject(raw: unknown): Project | null {
  if (!isObject(raw) || raw.version !== PROJECT_VERSION || !Array.isArray(raw.panels)) return null
  const seen = new Set<string>()
  const panels: StoredPanel[] = []
  for (const entry of raw.panels) {
    const panel = parsePanel(entry)
    if (!panel || seen.has(panel.id)) continue
    seen.add(panel.id)
    panels.push(panel)
    if (panels.length === MAX_PANELS) break
  }
  if (panels.length === 0) return null
  return {
    version: PROJECT_VERSION,
    tempo: typeof raw.tempo === 'number' ? clamp(raw.tempo, MIN_TEMPO, MAX_TEMPO, DEFAULT_TEMPO) : DEFAULT_TEMPO,
    beatsPerBar:
      typeof raw.beatsPerBar === 'number'
        ? Math.round(clamp(raw.beatsPerBar, MIN_BEATS_PER_BAR, MAX_BEATS_PER_BAR, DEFAULT_BEATS_PER_BAR))
        : DEFAULT_BEATS_PER_BAR,
    panels,
  }
}

/** Rebuilds live panels. A take whose media didn't survive (cleared storage, quota) comes back empty. */
export function panelsFromProject(project: Project, takeIds: ReadonlySet<string>): Panel[] {
  return project.panels.map((p) => ({ ...p, take: p.take && takeIds.has(p.id) ? p.take : null, stage: null }))
}

// Panel list state. The reducer refuses impossible transitions by returning the state
// unchanged, so a double-click or a stale event can't corrupt it.

import { clamp } from '../lib/math'

export const BAR_COUNTS = [1, 2, 4, 8, 16, 32] as const
export type BarCount = (typeof BAR_COUNTS)[number]

export const MIN_PANELS = 1
export const MAX_PANELS = 16
export const DEFAULT_BARS: BarCount = 4
export const DEFAULT_PANEL_VOLUME = 0.8

export type TakeStage = 'countIn' | 'recording' | 'processing'

export interface TakeMeta {
  /** Bar the recording started on; fixes the loop's phase on the grid. */
  readonly startBar: number
  readonly bars: BarCount
  /** Seconds into the video clip where the loop begins. */
  readonly videoOffset: number
}

export interface Panel {
  readonly id: string
  readonly bars: BarCount
  /** Overrides the global reference note; null uses the global one. */
  readonly noteOverride: number | null
  readonly volume: number
  readonly muted: boolean
  readonly take: TakeMeta | null
  readonly stage: TakeStage | null
}

export type PanelAction =
  | { readonly type: 'add'; readonly id: string }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'setBars'; readonly id: string; readonly bars: BarCount }
  | { readonly type: 'setNote'; readonly id: string; readonly note: number | null }
  | { readonly type: 'setVolume'; readonly id: string; readonly volume: number }
  | { readonly type: 'toggleMute'; readonly id: string }
  | { readonly type: 'stage'; readonly id: string; readonly stage: TakeStage }
  | { readonly type: 'cancelTake'; readonly id: string }
  | { readonly type: 'takeReady'; readonly id: string; readonly take: TakeMeta }
  | { readonly type: 'clearTake'; readonly id: string }
  | { readonly type: 'clearAll' }
  | { readonly type: 'load'; readonly panels: readonly Panel[] }

export const isBarCount = (value: unknown): value is BarCount => BAR_COUNTS.includes(value as BarCount)

export function createPanel(id: string, bars: BarCount = DEFAULT_BARS): Panel {
  return { id, bars, noteOverride: null, volume: DEFAULT_PANEL_VOLUME, muted: false, take: null, stage: null }
}

export const busyPanel = (panels: readonly Panel[]): Panel | null => panels.find((p) => p.stage !== null) ?? null

/** Tempo and meter can't change under recorded loops, or while one is being recorded. */
export const isMeterLocked = (panels: readonly Panel[]): boolean =>
  panels.some((p) => p.take !== null || p.stage !== null)

const STAGE_ORDER: Record<TakeStage, number> = { countIn: 0, recording: 1, processing: 2 }

function update(panels: readonly Panel[], id: string, change: (panel: Panel) => Panel | null): readonly Panel[] {
  const index = panels.findIndex((p) => p.id === id)
  if (index === -1) return panels
  const next = change(panels[index])
  if (next === null) return panels
  return panels.map((p, i) => (i === index ? next : p))
}

export function panelsReducer(panels: readonly Panel[], action: PanelAction): readonly Panel[] {
  switch (action.type) {
    case 'add': {
      if (panels.length >= MAX_PANELS || panels.some((p) => p.id === action.id)) return panels
      return [...panels, createPanel(action.id, panels.at(-1)?.bars ?? DEFAULT_BARS)]
    }
    case 'remove': {
      const target = panels.find((p) => p.id === action.id)
      if (!target || target.stage !== null || panels.length <= MIN_PANELS) return panels
      return panels.filter((p) => p.id !== action.id)
    }
    case 'setBars':
      // A recorded loop's length is baked into its audio, so clear before changing it.
      return update(panels, action.id, (p) => (p.take || p.stage ? null : { ...p, bars: action.bars }))
    case 'setNote':
      return update(panels, action.id, (p) => ({ ...p, noteOverride: action.note }))
    case 'setVolume':
      return update(panels, action.id, (p) => ({ ...p, volume: clamp(action.volume, 0, 1, p.volume) }))
    case 'toggleMute':
      return update(panels, action.id, (p) => ({ ...p, muted: !p.muted }))
    case 'stage': {
      const busy = busyPanel(panels)
      if (action.stage === 'countIn') {
        return busy ? panels : update(panels, action.id, (p) => ({ ...p, stage: 'countIn' }))
      }
      if (busy?.id !== action.id || STAGE_ORDER[action.stage] <= STAGE_ORDER[busy.stage!]) return panels
      return update(panels, action.id, (p) => ({ ...p, stage: action.stage }))
    }
    case 'cancelTake':
      return update(panels, action.id, (p) => (p.stage ? { ...p, stage: null } : null))
    case 'takeReady':
      return update(panels, action.id, (p) => ({ ...p, bars: action.take.bars, take: action.take, stage: null }))
    case 'clearTake':
      return update(panels, action.id, (p) => (p.stage || !p.take ? null : { ...p, take: null }))
    case 'clearAll':
      return panels.map((p) => ({ ...p, take: null, stage: null }))
    case 'load':
      return action.panels.length >= MIN_PANELS ? action.panels.slice(0, MAX_PANELS) : panels
  }
}

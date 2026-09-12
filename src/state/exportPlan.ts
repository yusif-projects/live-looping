// Geometry and timing for exporting panels to one video file.

import { lcm, mod } from '../lib/math'
import type { TakeMeta } from './panels'

export const EXPORT_WIDTH = 1920
export const EXPORT_HEIGHT = 1080
export const EXPORT_FPS = 30
/** Gap between grid cells in a combined export, in output pixels. */
export const EXPORT_GRID_GAP = 8

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Bars needed for every selected loop to complete at least one full cycle and line up again. */
export function exportBars(takes: readonly TakeMeta[]): number {
  return takes.reduce((acc, t) => lcm(acc, t.bars), takes.length ? 1 : 0)
}

/** Starts the export where the longest loop begins, so the file opens on its first bar rather than mid-phrase. */
export function exportStartBar(takes: readonly TakeMeta[]): number {
  const longest = takes.reduce<TakeMeta | null>((best, t) => (best && best.bars >= t.bars ? best : t), null)
  return longest ? mod(longest.startBar, longest.bars) : 0
}

/** A near-square grid: 1 → 1×1, 2 → 2×1, 3–4 → 2×2, 5–6 → 3×2, up to 16 → 4×4. */
export function gridLayout(count: number, width: number, height: number, gap: number): Rect[] {
  if (count <= 0) return []
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const cellWidth = (width - gap * (cols - 1)) / cols
  const cellHeight = (height - gap * (rows - 1)) / rows
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round((i % cols) * (cellWidth + gap)),
    y: Math.round(Math.floor(i / cols) * (cellHeight + gap)),
    width: Math.round(cellWidth),
    height: Math.round(cellHeight),
  }))
}

/** The part of a source frame to draw so it fills the destination without distortion (CSS `object-fit: cover`). */
export function coverCrop(sourceWidth: number, sourceHeight: number, destWidth: number, destHeight: number): Rect {
  const scale = Math.max(destWidth / sourceWidth, destHeight / sourceHeight)
  const width = destWidth / scale
  const height = destHeight / scale
  return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height }
}

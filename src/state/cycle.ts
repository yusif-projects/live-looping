// The loop cycle the transport readout counts through, so it wraps instead of counting forever.

import { lcm, mod } from '../lib/math'
import { exportBars, exportStartBar } from './exportPlan'
import type { Panel } from './panels'

export interface Cycle {
  readonly bars: number
  /** A grid bar where the cycle begins; bar 1 of the readout lands on it. */
  readonly startBar: number
}

/**
 * The cycle of the recorded loops, anchored where the longest one starts. With nothing recorded
 * it falls back to the panels' chosen lengths from bar 0, so the readout already shows where a
 * new recording will line up.
 */
export function loopCycle(panels: readonly Panel[]): Cycle {
  const takes = panels.flatMap((p) => (p.take ? [p.take] : []))
  if (takes.length > 0) return { bars: exportBars(takes), startBar: exportStartBar(takes) }
  return { bars: panels.reduce((acc, p) => lcm(acc, p.bars), 1), startBar: 0 }
}

/** 1-based bar within the cycle for a 0-based grid bar, e.g. "3 / 8". */
export function cycleLabel(gridBar: number, cycle: Cycle): string {
  return `${mod(gridBar - cycle.startBar, cycle.bars) + 1} / ${cycle.bars}`
}

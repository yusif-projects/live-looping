import { describe, expect, it } from 'vitest'
import { cycleLabel, loopCycle } from '../state/cycle'
import type { BarCount, Panel } from '../state/panels'
import { createPanel } from '../state/panels'

const recorded = (id: string, bars: BarCount, startBar: number): Panel => ({
  ...createPanel(id, bars),
  take: { startBar, bars, videoOffset: 0 },
})

describe('loopCycle', () => {
  it('follows the recorded loops, anchored on the longest one’s start', () => {
    const cycle = loopCycle([recorded('a', 2, 1), recorded('b', 8, 11), createPanel('c', 32)])
    expect(cycle).toEqual({ bars: 8, startBar: 3 })
  })

  it('falls back to the chosen lengths when nothing is recorded', () => {
    expect(loopCycle([createPanel('a', 4), createPanel('b', 16)])).toEqual({ bars: 16, startBar: 0 })
  })
})

describe('cycleLabel', () => {
  it('wraps back to bar 1 instead of counting forever', () => {
    const cycle = { bars: 4, startBar: 0 }
    expect([0, 1, 3, 4, 9].map((bar) => cycleLabel(bar, cycle))).toEqual(['1 / 4', '2 / 4', '4 / 4', '1 / 4', '2 / 4'])
  })

  it('puts bar 1 on the cycle’s start, even before it', () => {
    const cycle = { bars: 8, startBar: 3 }
    expect(cycleLabel(3, cycle)).toBe('1 / 8')
    expect(cycleLabel(2, cycle)).toBe('8 / 8')
  })
})

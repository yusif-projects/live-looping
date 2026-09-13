import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_LEAD_SECONDS,
  barStartTime,
  beatAt,
  countInDisplay,
  firstBeatIndexAtOrAfter,
  loopOffset,
  nextBarAtOrAfter,
  planTake,
  secondsPerBar,
} from '../audio/transport'

const fourFour = { tempo: 120, beatsPerBar: 4 } // 2 s per bar

describe('grid math', () => {
  it('sizes a bar from tempo and meter', () => {
    expect(secondsPerBar(fourFour)).toBe(2)
    expect(secondsPerBar({ tempo: 90, beatsPerBar: 3 })).toBe(2)
  })

  it('finds the next bar, counting a bar that starts exactly now', () => {
    expect(nextBarAtOrAfter(4, 0, fourFour)).toBe(2)
    expect(nextBarAtOrAfter(4.001, 0, fourFour)).toBe(3)
    expect(nextBarAtOrAfter(-5, 0, fourFour)).toBe(0)
  })

  it('does not skip a boundary that floating point lands a hair past', () => {
    const meter = { tempo: 97, beatsPerBar: 7 }
    const origin = 0.1
    expect(nextBarAtOrAfter(barStartTime(3, origin, meter), origin, meter)).toBe(3)
  })

  it('numbers beats into bars and positions', () => {
    expect(beatAt(5, 10, fourFour)).toEqual({ time: 12.5, bar: 1, beat: 1 })
    expect(beatAt(8, 0, fourFour).beat).toBe(0)
    expect(firstBeatIndexAtOrAfter(1.2, 0, fourFour)).toBe(3)
    expect(firstBeatIndexAtOrAfter(1.5, 0, fourFour)).toBe(3)
  })
})

describe('loopOffset', () => {
  it('is zero on the start bar and wraps every loop length', () => {
    expect(loopOffset(2, 0, fourFour, 1, 2)).toBe(0)
    expect(loopOffset(3, 0, fourFour, 1, 2)).toBe(1)
    expect(loopOffset(6, 0, fourFour, 1, 2)).toBe(0)
  })

  it('stays positive before the start bar', () => {
    expect(loopOffset(0, 0, fourFour, 1, 2)).toBe(2)
  })
})

describe('planTake', () => {
  it('starts a stopped transport just ahead of now', () => {
    const plan = planTake(10, null, fourFour, 1, 4, null)
    expect(plan.origin).toBe(10 + SCHEDULE_LEAD_SECONDS)
    expect(plan.countInStartBar).toBe(0)
    expect(plan.countInStart).toBe(plan.origin)
    expect(plan.recordStartBar).toBe(1)
    expect(plan.recordStart).toBeCloseTo(plan.origin + 2)
    expect(plan.recordEnd).toBeCloseTo(plan.origin + 10)
  })

  it('waits for the next bar on a running transport', () => {
    const plan = planTake(2.5, 0, fourFour, 2, 1, null)
    expect(plan.origin).toBe(0)
    expect(plan.countInStartBar).toBe(2)
    expect(plan.recordStartBar).toBe(4)
    expect(plan.recordEnd).toBe(10)
  })

  it('skips a boundary too close to schedule', () => {
    expect(planTake(3.95, 0, fourFour, 1, 1, null).countInStartBar).toBe(3)
  })
})

describe('planTake lined up with existing loops', () => {
  // A 4-bar loop recorded from bar 1: its cycle starts on bars 1, 5, 9…
  const anchoredOnBar1 = (stepBars: number) => ({ anchorBar: 1, stepBars })

  it('starts a shorter loop on its own boundary instead of waiting out the long one', () => {
    // Pressed in bar 2: a 2-bar take may start on bar 3 or 5, and bar 3 is too close to count a full bar.
    const plan = planTake(4.5, 0, fourFour, 4, 2, anchoredOnBar1(2))
    expect(plan.countInStartBar).toBe(3)
    expect(plan.recordStartBar).toBe(5)
    expect(plan.recordEnd).toBe(14)
    // Pressed in bar 1, bar 3 leaves a full bar to count.
    expect(planTake(3.5, 0, fourFour, 4, 2, anchoredOnBar1(2)).recordStartBar).toBe(3)
  })

  it('starts a 1-bar loop a bar after the count-in begins, ignoring the count-in setting', () => {
    const plan = planTake(4.5, 0, fourFour, 4, 1, anchoredOnBar1(1))
    expect(plan.recordStartBar).toBe(plan.countInStartBar + 1)
  })

  it('starts a longer loop on the existing cycle’s first bar', () => {
    expect(planTake(10.5, 0, fourFour, 1, 8, anchoredOnBar1(4)).recordStartBar).toBe(9)
  })

  it('lines up on a stopped transport too', () => {
    expect(planTake(10, null, fourFour, 1, 2, anchoredOnBar1(2)).recordStartBar).toBe(1)
    expect(planTake(10, null, fourFour, 1, 4, { anchorBar: 3, stepBars: 4 }).recordStartBar).toBe(3)
  })
})

describe('countInDisplay', () => {
  // Pressed in bar 2 at 4.5 s: the count-in starts on bar 3 (6 s) and recording on bar 5 (10 s).
  const plan = planTake(4.5, 0, fourFour, 1, 2, { anchorBar: 1, stepBars: 2 })

  it('shows the bars left, reading the wait for the next bar as the first count-in bar', () => {
    expect(countInDisplay(5, plan, fourFour)).toEqual({ barsLeft: 2, beat: null, beatsLeft: null })
    expect(countInDisplay(6, plan, fourFour)).toEqual({ barsLeft: 2, beat: 0, beatsLeft: null })
    expect(countInDisplay(7.6, plan, fourFour)).toEqual({ barsLeft: 2, beat: 3, beatsLeft: null })
  })

  it('counts the beats down in the last bar, then gives way to recording', () => {
    expect([8, 8.5, 9, 9.5].map((t) => countInDisplay(t, plan, fourFour)?.beatsLeft)).toEqual([4, 3, 2, 1])
    expect(countInDisplay(10, plan, fourFour)).toBeNull()
  })

  it('counts a beat that floating point lands a hair early as that beat', () => {
    const meter = { tempo: 97, beatsPerBar: 7 }
    const running = planTake(0, 0.1, meter, 1, 1, null)
    const beats = Array.from({ length: 7 }, (_, i) => countInDisplay(beatAt(i, 0.1, meter).time, running, meter)?.beat)
    expect(beats).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('shows no extra bar in the moment before a fresh origin', () => {
    const stopped = planTake(10, null, fourFour, 1, 4, null)
    expect(countInDisplay(10.05, stopped, fourFour)).toEqual({ barsLeft: 1, beat: null, beatsLeft: null })
  })
})

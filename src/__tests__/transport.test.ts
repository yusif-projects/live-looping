import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_LEAD_SECONDS,
  barStartTime,
  beatAt,
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
    const plan = planTake(10, null, fourFour, 1, 4)
    expect(plan.origin).toBe(10 + SCHEDULE_LEAD_SECONDS)
    expect(plan.countInStartBar).toBe(0)
    expect(plan.countInStart).toBe(plan.origin)
    expect(plan.recordStartBar).toBe(1)
    expect(plan.recordStart).toBeCloseTo(plan.origin + 2)
    expect(plan.recordEnd).toBeCloseTo(plan.origin + 10)
  })

  it('waits for the next bar on a running transport', () => {
    const plan = planTake(2.5, 0, fourFour, 2, 1)
    expect(plan.origin).toBe(0)
    expect(plan.countInStartBar).toBe(2)
    expect(plan.recordStartBar).toBe(4)
    expect(plan.recordEnd).toBe(10)
  })

  it('skips a boundary too close to schedule', () => {
    expect(planTake(3.95, 0, fourFour, 1, 1).countInStartBar).toBe(3)
  })
})

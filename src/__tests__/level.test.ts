import { describe, expect, it } from 'vitest'
import { LEVEL_DECAY_PER_FRAME, isHot, meterLevel, peakOf, smoothLevel } from '../audio/level'

describe('peakOf', () => {
  it('takes the loudest sample on either side of zero', () => {
    expect(peakOf(new Float32Array([0.1, -0.5, 0.25]))).toBe(0.5)
    expect(peakOf(new Float32Array(0))).toBe(0)
  })
})

describe('meterLevel', () => {
  it('fills at full scale and empties at the floor or in silence', () => {
    expect(meterLevel(1)).toBe(1)
    expect(meterLevel(2)).toBe(1)
    expect(meterLevel(0.001)).toBeCloseTo(0)
    expect(meterLevel(0)).toBe(0)
    expect(meterLevel(Number.NaN)).toBe(0)
  })

  it('is even in decibels', () => {
    expect(meterLevel(10 ** (-30 / 20))).toBeCloseTo(0.5)
  })
})

describe('smoothLevel', () => {
  it('rises at once and falls gradually, never below the new level', () => {
    expect(smoothLevel(0.2, 0.9)).toBe(0.9)
    expect(smoothLevel(0.9, 0)).toBeCloseTo(0.9 - LEVEL_DECAY_PER_FRAME)
    expect(smoothLevel(0.5, 0.49)).toBe(0.49)
  })
})

describe('isHot', () => {
  it('warns near full scale only', () => {
    expect(isHot(meterLevel(1))).toBe(true)
    expect(isHot(meterLevel(0.5))).toBe(false)
  })
})

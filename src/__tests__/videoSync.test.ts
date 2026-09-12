import { describe, expect, it } from 'vitest'
import { MAX_RATE_DEVIATION, SEEK_THRESHOLD_SECONDS, correctVideo, expectedClipTime } from '../media/videoSync'

describe('videoSync', () => {
  it('offsets the loop into the clip, never before its start', () => {
    expect(expectedClipTime(1.5, 2)).toBe(3.5)
    expect(expectedClipTime(0, -0.2)).toBe(0)
  })

  it('leaves invisible drift alone', () => {
    expect(correctVideo(1.01, 1)).toEqual({ seekTo: null, playbackRate: 1 })
  })

  it('speeds up when behind and slows down when ahead', () => {
    expect(correctVideo(0.96, 1).playbackRate).toBeCloseTo(1.08)
    expect(correctVideo(1.04, 1).playbackRate).toBeCloseTo(0.92)
  })

  it('caps the nudge', () => {
    const rate = correctVideo(1 - SEEK_THRESHOLD_SECONDS + 0.001, 1).playbackRate
    expect(rate).toBeLessThanOrEqual(1 + MAX_RATE_DEVIATION)
  })

  it('seeks on large drift, which is also how the loop wraps', () => {
    expect(correctVideo(5.9, 2)).toEqual({ seekTo: 2, playbackRate: 1 })
  })
})

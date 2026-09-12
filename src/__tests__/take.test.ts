import { describe, expect, it } from 'vitest'
import type { CaptureChunk } from '../audio/take'
import { applyEdgeFades, capturedUntil, secondsToFrames, sliceTake } from '../audio/take'

const ramp = (from: number, length: number): Float32Array => Float32Array.from({ length }, (_, i) => from + i)
const chunk = (frame: number, ...channels: Float32Array[]): CaptureChunk => ({ frame, channels })

describe('sliceTake', () => {
  it('copies a range that spans chunk boundaries', () => {
    const chunks = [chunk(100, ramp(100, 4)), chunk(104, ramp(104, 4))]
    expect(Array.from(sliceTake(chunks, 102, 5, 1)[0])).toEqual([102, 103, 104, 105, 106])
  })

  it('keeps the requested length and leaves uncaptured frames silent', () => {
    const chunks = [chunk(0, ramp(1, 2)), chunk(4, ramp(5, 2))]
    expect(Array.from(sliceTake(chunks, 0, 8, 1)[0])).toEqual([1, 2, 0, 0, 5, 6, 0, 0])
  })

  it('repeats the last channel present to fill the ones asked for', () => {
    const [left, right] = sliceTake([chunk(0, ramp(1, 3))], 0, 3, 2)
    expect(Array.from(right)).toEqual(Array.from(left))
  })

  it('keeps stereo channels apart', () => {
    const [left, right] = sliceTake([chunk(0, ramp(1, 2), ramp(10, 2))], 0, 2, 2)
    expect(Array.from(left)).toEqual([1, 2])
    expect(Array.from(right)).toEqual([10, 11])
  })
})

describe('edges', () => {
  it('fades both ends down to silence', () => {
    const data = new Float32Array(10).fill(1)
    applyEdgeFades([data], 2, 4)
    expect(Array.from(data)).toEqual([0, 0.5, 1, 1, 1, 1, 0.75, 0.5, 0.25, 0])
  })

  it('reports how far capture has reached', () => {
    expect(capturedUntil([chunk(0, ramp(0, 128)), chunk(128, ramp(0, 128))])).toBe(256)
    expect(capturedUntil([])).toBe(0)
  })

  it('rounds seconds to whole frames', () => {
    expect(secondsToFrames(0.5, 48000)).toBe(24000)
    expect(secondsToFrames(1 / 3, 44100)).toBe(14700)
  })
})

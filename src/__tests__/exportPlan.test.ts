import { describe, expect, it } from 'vitest'
import type { BarCount, TakeMeta } from '../state/panels'
import { coverCrop, exportBars, exportStartBar, gridLayout } from '../state/exportPlan'

const take = (bars: number, startBar = 0): TakeMeta => ({ bars: bars as BarCount, startBar, videoOffset: 0 })

describe('export timing', () => {
  it('lasts until every loop has cycled and lined up again', () => {
    expect(exportBars([take(2), take(4), take(16)])).toBe(16)
    expect(exportBars([take(1)])).toBe(1)
    expect(exportBars([])).toBe(0)
    expect(exportBars([take(3), take(4)])).toBe(12)
  })

  it('starts where the longest loop begins', () => {
    expect(exportStartBar([take(2, 1), take(8, 11)])).toBe(3)
    expect(exportStartBar([])).toBe(0)
  })
})

describe('export geometry', () => {
  it('lays panels out in a near-square grid', () => {
    expect(gridLayout(1, 1920, 1080, 8)).toEqual([{ x: 0, y: 0, width: 1920, height: 1080 }])
    expect(gridLayout(3, 1920, 1080, 8)).toHaveLength(3)
    const sixteen = gridLayout(16, 1920, 1080, 8)
    expect(sixteen[15]).toEqual({ x: 1446, y: 816, width: 474, height: 264 })
    expect(gridLayout(0, 1920, 1080, 8)).toEqual([])
  })

  it('crops the source to fill the cell without stretching', () => {
    expect(coverCrop(640, 480, 1920, 1080)).toEqual({ x: 0, y: 60, width: 640, height: 360 })
    expect(coverCrop(1920, 1080, 100, 100)).toEqual({ x: 420, y: 0, width: 1080, height: 1080 })
  })
})

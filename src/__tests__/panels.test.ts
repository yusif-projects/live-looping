import { describe, expect, it } from 'vitest'
import type { Panel, PanelAction, TakeMeta } from '../state/panels'
import { MAX_PANELS, busyPanel, createPanel, isMeterLocked, panelsReducer } from '../state/panels'

const take: TakeMeta = { startBar: 1, bars: 4, videoOffset: 2 }
const run = (state: readonly Panel[], ...actions: PanelAction[]) => actions.reduce(panelsReducer, state)

describe('panelsReducer: the panel list', () => {
  it('adds a panel with the previous panel’s length, up to the maximum', () => {
    const two = run([createPanel('a', 16)], { type: 'add', id: 'b' })
    expect(two.map((p) => [p.id, p.bars])).toEqual([['a', 16], ['b', 16]])

    let full: readonly Panel[] = [createPanel('p0')]
    for (let i = 1; i <= MAX_PANELS + 2; i++) full = panelsReducer(full, { type: 'add', id: `p${i}` })
    expect(full).toHaveLength(MAX_PANELS)
  })

  it('refuses a duplicate id', () => {
    const state = [createPanel('a')]
    expect(panelsReducer(state, { type: 'add', id: 'a' })).toBe(state)
  })

  it('never removes the last panel or one that is recording', () => {
    const one = [createPanel('a')]
    expect(panelsReducer(one, { type: 'remove', id: 'a' })).toBe(one)

    const recording = run([createPanel('a'), createPanel('b')], { type: 'stage', id: 'a', stage: 'countIn' })
    expect(panelsReducer(recording, { type: 'remove', id: 'a' })).toBe(recording)
    expect(panelsReducer(recording, { type: 'remove', id: 'b' }).map((p) => p.id)).toEqual(['a'])
  })
})

describe('panelsReducer: recording', () => {
  it('walks a take forward through its stages to a loop', () => {
    const state = run(
      [createPanel('a')],
      { type: 'stage', id: 'a', stage: 'countIn' },
      { type: 'stage', id: 'a', stage: 'recording' },
      { type: 'stage', id: 'a', stage: 'processing' },
      { type: 'takeReady', id: 'a', take },
    )
    expect(state[0]).toMatchObject({ stage: null, take })
  })

  it('records one panel at a time and never steps backwards', () => {
    const state = run([createPanel('a'), createPanel('b')], { type: 'stage', id: 'a', stage: 'recording' })
    expect(busyPanel(state)).toBeNull() // recording without a count-in is refused

    const counting = run(state, { type: 'stage', id: 'a', stage: 'countIn' })
    expect(panelsReducer(counting, { type: 'stage', id: 'b', stage: 'countIn' })).toBe(counting)

    const recording = run(counting, { type: 'stage', id: 'a', stage: 'recording' })
    expect(panelsReducer(recording, { type: 'stage', id: 'a', stage: 'countIn' })).toBe(recording)
  })

  it('keeps the old loop when a re-record is cancelled', () => {
    const state = run(
      [createPanel('a')],
      { type: 'takeReady', id: 'a', take },
      { type: 'stage', id: 'a', stage: 'countIn' },
      { type: 'cancelTake', id: 'a' },
    )
    expect(state[0]).toMatchObject({ stage: null, take })
  })

  it('locks the length and the meter while a loop exists', () => {
    const state = run([createPanel('a', 4)], { type: 'takeReady', id: 'a', take })
    expect(isMeterLocked(state)).toBe(true)
    expect(panelsReducer(state, { type: 'setBars', id: 'a', bars: 8 })).toBe(state)

    const cleared = run(state, { type: 'clearTake', id: 'a' }, { type: 'setBars', id: 'a', bars: 8 })
    expect(isMeterLocked(cleared)).toBe(false)
    expect(cleared[0].bars).toBe(8)
  })

  it('does not clear a panel mid-take', () => {
    const state = run(
      [createPanel('a')],
      { type: 'takeReady', id: 'a', take },
      { type: 'stage', id: 'a', stage: 'countIn' },
    )
    expect(panelsReducer(state, { type: 'clearTake', id: 'a' })).toBe(state)
  })

  it('clears everything, including a take in progress', () => {
    const state = run(
      [createPanel('a'), createPanel('b')],
      { type: 'takeReady', id: 'a', take },
      { type: 'stage', id: 'b', stage: 'countIn' },
      { type: 'clearAll' },
    )
    expect(isMeterLocked(state)).toBe(false)
  })
})

describe('panelsReducer: mix', () => {
  it('clamps volume, toggles mute and sets a note override', () => {
    const state = run(
      [createPanel('a')],
      { type: 'setVolume', id: 'a', volume: 4 },
      { type: 'toggleMute', id: 'a' },
      { type: 'setNote', id: 'a', note: 40 },
    )
    expect(state[0]).toMatchObject({ volume: 1, muted: true, noteOverride: 40 })
  })
})

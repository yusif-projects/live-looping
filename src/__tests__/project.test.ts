import { describe, expect, it } from 'vitest'
import { MAX_TEMPO } from '../audio/transport'
import { createPanel } from '../state/panels'
import type { Panel } from '../state/panels'
import { PROJECT_VERSION, panelsFromProject, parseProject, toProject } from '../storage/project'

const recorded: Panel = { ...createPanel('a', 8), noteOverride: 45, take: { startBar: 3, bars: 8, videoOffset: 2.1 } }

describe('project', () => {
  it('round-trips through JSON, dropping an in-progress stage', () => {
    const panels: Panel[] = [recorded, { ...createPanel('b', 2), stage: 'countIn' }]
    const project = parseProject(JSON.parse(JSON.stringify(toProject(96, 3, panels))))
    expect(project).not.toBeNull()
    expect(project!.tempo).toBe(96)
    expect(project!.beatsPerBar).toBe(3)
    expect(panelsFromProject(project!, new Set(['a']))).toEqual([recorded, createPanel('b', 2)])
  })

  it('rejects the wrong version or no usable panels', () => {
    expect(parseProject({ version: 99, tempo: 120, beatsPerBar: 4, panels: [recorded] })).toBeNull()
    expect(parseProject({ version: PROJECT_VERSION, panels: [{ bars: 4 }] })).toBeNull()
    expect(parseProject('nope')).toBeNull()
  })

  it('clamps the meter and repairs panels field by field', () => {
    const project = parseProject({
      version: PROJECT_VERSION,
      tempo: 900,
      beatsPerBar: 'four',
      panels: [
        { id: 'a', bars: 5, volume: -1, noteOverride: 7, muted: 'yes' },
        { id: 'a', bars: 2 },
        { id: 'b', bars: 2, take: { startBar: 0, bars: 16, videoOffset: 1 } },
        { id: 'c', take: { startBar: 1.5, bars: 4, videoOffset: 1 } },
      ],
    })
    expect(project!.tempo).toBe(MAX_TEMPO)
    expect(project!.beatsPerBar).toBe(4)
    expect(project!.panels.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(project!.panels[0]).toMatchObject({ bars: 4, volume: 0, noteOverride: null, muted: false })
    expect(project!.panels[1].bars).toBe(16) // the take's length wins
    expect(project!.panels[2].take).toBeNull()
  })

  it('empties a panel whose media is gone', () => {
    const project = parseProject(toProject(120, 4, [recorded]))!
    expect(panelsFromProject(project, new Set())[0].take).toBeNull()
  })
})

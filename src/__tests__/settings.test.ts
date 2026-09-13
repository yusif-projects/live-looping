import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, LATENCY_OFFSET_RANGE_MS, parseSettings, serializeSettings } from '../state/settings'

describe('parseSettings', () => {
  it('falls back to defaults for nothing, corrupt JSON, or a non-object', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid fields and defaults the rest', () => {
    const settings = parseSettings(JSON.stringify({ metronomeOn: false, micId: 'usb-mic', tempo: 90 }))
    expect(settings.metronomeOn).toBe(false)
    expect(settings.micId).toBe('usb-mic')
    expect(settings.countInBars).toBe(DEFAULT_SETTINGS.countInBars)
    expect(settings).not.toHaveProperty('tempo')
  })

  it('clamps numbers into range and rounds count-in bars', () => {
    const settings = parseSettings(
      JSON.stringify({ metronomeVolume: 3, latencyOffsetMs: -999, countInBars: 2.6, referenceVolume: 'loud' }),
    )
    expect(settings.metronomeVolume).toBe(1)
    expect(settings.latencyOffsetMs).toBe(-LATENCY_OFFSET_RANGE_MS)
    expect(settings.countInBars).toBe(3)
    expect(settings.referenceVolume).toBe(DEFAULT_SETTINGS.referenceVolume)
  })

  it('tells a deliberate "no tone" from an invalid note', () => {
    expect(parseSettings(JSON.stringify({ referenceNote: null })).referenceNote).toBeNull()
    expect(parseSettings(JSON.stringify({ referenceNote: 200 })).referenceNote).toBe(DEFAULT_SETTINGS.referenceNote)
  })

  it('treats an empty device id as the system default', () => {
    expect(parseSettings(JSON.stringify({ cameraId: '' })).cameraId).toBeNull()
  })

  it('keeps monitoring off unless it was turned on, and clamps its volume', () => {
    expect(DEFAULT_SETTINGS.monitorOn).toBe(false)
    const settings = parseSettings(JSON.stringify({ monitorOn: true, monitorVolume: 7 }))
    expect(settings.monitorOn).toBe(true)
    expect(settings.monitorVolume).toBe(1)
  })

  it('round-trips', () => {
    const settings = { ...DEFAULT_SETTINGS, speakerId: 'hdmi', referenceNote: 45, videoOffsetMs: -40 }
    expect(parseSettings(serializeSettings(settings))).toEqual(settings)
  })
})

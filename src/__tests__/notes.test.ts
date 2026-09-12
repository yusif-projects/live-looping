import { describe, expect, it } from 'vitest'
import {
  HIGHEST_REFERENCE_NOTE,
  LOWEST_REFERENCE_NOTE,
  REFERENCE_NOTES,
  isReferenceNote,
  noteFrequency,
  noteName,
  parseNoteName,
} from '../audio/notes'

describe('notes', () => {
  it('tunes to A4 = 440 Hz in equal temperament', () => {
    expect(noteFrequency(69)).toBe(440)
    expect(noteFrequency(57)).toBe(220)
    expect(noteFrequency(60)).toBeCloseTo(261.6256, 3)
  })

  it('names notes with sharps and octave numbers', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(61)).toBe('C#4')
    expect(noteName(LOWEST_REFERENCE_NOTE)).toBe('C2')
    expect(noteName(HIGHEST_REFERENCE_NOTE)).toBe('C6')
  })

  it('parses sharps and flats, and rejects anything else', () => {
    expect(parseNoteName('A4')).toBe(69)
    expect(parseNoteName('Bb2')).toBe(46)
    expect(parseNoteName('A#2')).toBe(46)
    expect(parseNoteName('H2')).toBeNull()
    expect(parseNoteName('A')).toBeNull()
  })

  it('round-trips every offered note', () => {
    for (const midi of REFERENCE_NOTES) expect(parseNoteName(noteName(midi))).toBe(midi)
  })

  it('accepts only whole notes inside the offered range', () => {
    expect(isReferenceNote(LOWEST_REFERENCE_NOTE)).toBe(true)
    expect(isReferenceNote(LOWEST_REFERENCE_NOTE - 1)).toBe(false)
    expect(isReferenceNote(60.5)).toBe(false)
    expect(isReferenceNote('60')).toBe(false)
  })
})

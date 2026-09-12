// Reference notes are MIDI numbers in equal temperament, tuned to A4 = 440 Hz.

import { mod } from '../lib/math'

const A4_MIDI = 69
const A4_HZ = 440

/** C2: the lowest note offered, low enough for a bass. */
export const LOWEST_REFERENCE_NOTE = 36
/** C6: the highest note offered. */
export const HIGHEST_REFERENCE_NOTE = 84
export const DEFAULT_REFERENCE_NOTE = A4_MIDI

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const NATURAL_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const REFERENCE_NOTES: readonly number[] = Array.from(
  { length: HIGHEST_REFERENCE_NOTE - LOWEST_REFERENCE_NOTE + 1 },
  (_, i) => LOWEST_REFERENCE_NOTE + i,
)

export function noteFrequency(midi: number): number {
  return A4_HZ * 2 ** ((midi - A4_MIDI) / 12)
}

export function noteName(midi: number): string {
  return `${NOTE_NAMES[mod(midi, 12)]}${Math.floor(midi / 12) - 1}`
}

/** Parses "A4", "C#3", "Bb2". Returns null for anything else. */
export function parseNoteName(name: string): number | null {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name.trim())
  if (!match) return null
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  return (Number(match[3]) + 1) * 12 + NATURAL_SEMITONES[match[1]] + accidental
}

export function isReferenceNote(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= LOWEST_REFERENCE_NOTE &&
    value <= HIGHEST_REFERENCE_NOTE
  )
}

// Input level for the mic meter: peak amplitude on a decibel scale, which the eye reads evenly.

import { clamp } from '../lib/math'

/** Quieter than this reads as an empty meter. Room noise through a decent interface sits about here. */
export const LEVEL_FLOOR_DB = -60
/** Past this the meter warns: a louder peak is close to clipping the take. */
export const HOT_DB = -3
/** How much of the meter a falling level gives back per frame. An instant fall flickers too fast to read. */
export const LEVEL_DECAY_PER_FRAME = 0.04

export function peakOf(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const magnitude = Math.abs(samples[i])
    if (magnitude > peak) peak = magnitude
  }
  return peak
}

const dbToLevel = (db: number): number => clamp(1 - db / LEVEL_FLOOR_DB, 0, 1)

/** 0 at the floor or below, 1 at full scale. */
export function meterLevel(peak: number): number {
  return peak > 0 ? dbToLevel(20 * Math.log10(peak)) : 0
}

/** Rises at once so a transient shows, then falls gradually. */
export function smoothLevel(previous: number, next: number): number {
  return next >= previous ? next : Math.max(next, previous - LEVEL_DECAY_PER_FRAME)
}

export const isHot = (level: number): boolean => level >= dbToLevel(HOT_DB)

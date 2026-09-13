// Timing math for the shared bar grid. Every time is in AudioContext seconds, and the grid
// is anchored at `origin`: the context time of bar 0, beat 0.

import { mod } from '../lib/math'

export const MIN_TEMPO = 40
export const MAX_TEMPO = 240
export const DEFAULT_TEMPO = 120
export const MIN_BEATS_PER_BAR = 2
export const MAX_BEATS_PER_BAR = 12
export const DEFAULT_BEATS_PER_BAR = 4

// Anything scheduled closer to "now" than this can arrive after the audio thread has already
// rendered that moment, so the click sounds late or not at all. A count-in never starts on a
// bar boundary inside this window.
export const SCHEDULE_LEAD_SECONDS = 0.1

// Grid positions computed in floating point land a hair off the integer (3.9999999…). Without
// this tolerance a bar that starts exactly "now" would be skipped for the next one.
const GRID_EPSILON = 1e-9

export interface Meter {
  readonly tempo: number
  readonly beatsPerBar: number
}

export const secondsPerBeat = (tempo: number): number => 60 / tempo

export const secondsPerBar = (meter: Meter): number => secondsPerBeat(meter.tempo) * meter.beatsPerBar

export function barStartTime(bar: number, origin: number, meter: Meter): number {
  return origin + bar * secondsPerBar(meter)
}

/** Fractional bar position of `time`; negative before the origin. */
export function barPosition(time: number, origin: number, meter: Meter): number {
  return (time - origin) / secondsPerBar(meter)
}

/** The first whole bar starting at or after `time`, never before bar 0. */
export function nextBarAtOrAfter(time: number, origin: number, meter: Meter): number {
  return Math.max(0, Math.ceil(barPosition(time, origin, meter) - GRID_EPSILON))
}

export interface Beat {
  readonly time: number
  readonly bar: number
  /** 0-based position inside the bar; 0 is the downbeat. */
  readonly beat: number
}

/** Beat number `index` counted from the origin. Schedulers walk indices, not times, so no beat is counted twice. */
export function beatAt(index: number, origin: number, meter: Meter): Beat {
  return {
    time: origin + index * secondsPerBeat(meter.tempo),
    bar: Math.floor(index / meter.beatsPerBar),
    beat: mod(index, meter.beatsPerBar),
  }
}

export function firstBeatIndexAtOrAfter(time: number, origin: number, meter: Meter): number {
  return Math.max(0, Math.ceil((time - origin) / secondsPerBeat(meter.tempo) - GRID_EPSILON))
}

/**
 * Seconds into a loop at `time`. A loop keeps the bar it was recorded on, so its phase
 * is `(bar − startBar) mod bars`. Loops of different lengths stay aligned however the
 * transport is restarted.
 */
export function loopOffset(time: number, origin: number, meter: Meter, startBar: number, bars: number): number {
  const loopSeconds = bars * secondsPerBar(meter)
  return mod(time - barStartTime(startBar, origin, meter), loopSeconds)
}

export interface TakeAlignment {
  /** A grid bar the existing loops treat as their first bar. */
  readonly anchorBar: number
  /** A new take may start every this many bars from the anchor. */
  readonly stepBars: number
}

/** Lining up with existing loops never leaves less than this to count, so there is always a full bar of clicks. */
export const MIN_ALIGNED_COUNT_IN_BARS = 1

export interface TakePlan {
  /** The grid origin: unchanged when the transport was already running, otherwise a fresh one. */
  readonly origin: number
  readonly countInStartBar: number
  readonly recordStartBar: number
  readonly countInStart: number
  readonly recordStart: number
  readonly recordEnd: number
}

/**
 * When a take's count-in and recording happen. When the transport is stopped
 * (`runningOrigin` null) it starts just ahead of now. When it's running, the count-in
 * waits for the next bar boundary.
 *
 * With `alignment`, recording starts on the first bar where the new loop lines up with the
 * existing ones, at least a bar past the count-in's start, so a short loop never waits out a
 * whole long one. That holds on a stopped transport too: recording starts every loop, and the
 * anchor is a grid bar, valid on a fresh origin. Without it, the count-in lasts `countInBars`.
 */
export function planTake(
  now: number,
  runningOrigin: number | null,
  meter: Meter,
  countInBars: number,
  bars: number,
  alignment: TakeAlignment | null,
): TakePlan {
  const origin = runningOrigin ?? now + SCHEDULE_LEAD_SECONDS
  const countInStartBar = nextBarAtOrAfter(now + SCHEDULE_LEAD_SECONDS, origin, meter)
  const earliest = countInStartBar + MIN_ALIGNED_COUNT_IN_BARS
  const recordStartBar = alignment
    ? earliest + mod(alignment.anchorBar - earliest, alignment.stepBars)
    : countInStartBar + countInBars
  return {
    origin,
    countInStartBar,
    recordStartBar,
    countInStart: barStartTime(countInStartBar, origin, meter),
    recordStart: barStartTime(recordStartBar, origin, meter),
    recordEnd: barStartTime(recordStartBar + bars, origin, meter),
  }
}

export interface CountInDisplay {
  /** Bars still to count before recording, the current one included. */
  readonly barsLeft: number
  /** 0-based beat in the current bar, or null before the count-in's first bar. */
  readonly beat: number | null
  /** Beats until recording (4 3 2 1 in 4/4), during the last bar only. */
  readonly beatsLeft: number | null
}

/**
 * What the count-in overlay shows at `time`, or null once recording has begun. Before the
 * count-in's first bar it reads as that bar, so neither the wait for the next bar nor the moment
 * before a fresh origin shows an extra bar to count.
 */
export function countInDisplay(time: number, plan: TakePlan, meter: Meter): CountInDisplay | null {
  if (time >= plan.recordStart) return null
  const position = barPosition(time, plan.origin, meter)
  const bar = Math.max(Math.floor(position + GRID_EPSILON), plan.countInStartBar)
  const barsLeft = plan.recordStartBar - bar
  if (barsLeft <= 0) return null
  if (position + GRID_EPSILON < plan.countInStartBar) return { barsLeft, beat: null, beatsLeft: null }
  const beat = clampBeat(Math.floor((position - bar) * meter.beatsPerBar + GRID_EPSILON), meter)
  return { barsLeft, beat, beatsLeft: barsLeft === 1 ? meter.beatsPerBar - beat : null }
}

const clampBeat = (beat: number, meter: Meter): number => Math.min(meter.beatsPerBar - 1, Math.max(0, beat))

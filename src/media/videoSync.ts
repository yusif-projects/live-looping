// Keeps a looping <video> on the audio clock. Audio is the reference; video is corrected toward it.

import { clamp } from '../lib/math'

/** Beyond this much drift a rate nudge would take too long to catch up, so seek instead. Also catches the loop wrap. */
export const SEEK_THRESHOLD_SECONDS = 0.12
/** Drift below one frame at 60 fps isn't visible. Chasing it would make playback shimmer. */
export const RATE_DEADBAND_SECONDS = 0.016
/** Rate change per second of drift: 40 ms behind plays 8% fast. */
export const RATE_GAIN = 2
/** Past this the eye notices speed changes. */
export const MAX_RATE_DEVIATION = 0.1

export interface VideoCorrection {
  /** Seek target in clip seconds, or null to leave position alone. */
  readonly seekTo: number | null
  readonly playbackRate: number
}

/** Where the clip should be: the recorded video starts at the count-in, so the loop begins `clipOffset` into it. */
export function expectedClipTime(loopOffsetSeconds: number, clipOffset: number): number {
  return Math.max(0, clipOffset + loopOffsetSeconds)
}

export function correctVideo(actual: number, expected: number): VideoCorrection {
  const drift = actual - expected
  if (Math.abs(drift) > SEEK_THRESHOLD_SECONDS) return { seekTo: expected, playbackRate: 1 }
  if (Math.abs(drift) < RATE_DEADBAND_SECONDS) return { seekTo: null, playbackRate: 1 }
  return {
    seekTo: null,
    playbackRate: clamp(1 - drift * RATE_GAIN, 1 - MAX_RATE_DEVIATION, 1 + MAX_RATE_DEVIATION),
  }
}

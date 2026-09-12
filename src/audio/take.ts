// Turns the capture worklet's stream of PCM chunks into a loop of exactly the right length.

/** Fade-in at the loop start. Kept tiny so a downbeat's attack survives it. */
export const LOOP_FADE_IN_SECONDS = 0.001
/** Fade-out at the loop end, which removes the click where the waveform jumps back to the start. */
export const LOOP_FADE_OUT_SECONDS = 0.005
/** Most interfaces are mono or stereo. More channels would multiply storage for no audible gain. */
export const MAX_CAPTURE_CHANNELS = 2

export interface CaptureChunk {
  /** AudioContext frame of the chunk's first sample. */
  readonly frame: number
  readonly channels: readonly Float32Array[]
}

export const secondsToFrames = (seconds: number, sampleRate: number): number => Math.round(seconds * sampleRate)

/**
 * Copies `[startFrame, startFrame + length)` out of the captured chunks. Frames nobody
 * captured (a dropped render quantum) are silence rather than a shortened loop, since a
 * loop that loses length drifts off the grid. Missing channels repeat the last one present.
 */
export function sliceTake(
  chunks: readonly CaptureChunk[],
  startFrame: number,
  length: number,
  channelCount: number,
): Float32Array[] {
  const out = Array.from({ length: channelCount }, () => new Float32Array(length))
  const endFrame = startFrame + length
  for (const chunk of chunks) {
    const chunkLength = chunk.channels[0]?.length ?? 0
    const from = Math.max(startFrame, chunk.frame)
    const to = Math.min(endFrame, chunk.frame + chunkLength)
    if (to <= from) continue
    for (let c = 0; c < channelCount; c++) {
      const source = chunk.channels[Math.min(c, chunk.channels.length - 1)]
      out[c].set(source.subarray(from - chunk.frame, to - chunk.frame), from - startFrame)
    }
  }
  return out
}

/** Linear fades at both ends, in place on channels the caller owns. */
export function applyEdgeFades(channels: Float32Array[], fadeInFrames: number, fadeOutFrames: number): void {
  for (const data of channels) {
    const fadeIn = Math.min(fadeInFrames, data.length)
    for (let i = 0; i < fadeIn; i++) data[i] *= i / fadeIn
    const fadeOut = Math.min(fadeOutFrames, data.length)
    for (let i = 0; i < fadeOut; i++) data[data.length - 1 - i] *= i / fadeOut
  }
}

/** The last frame any chunk reaches, so the recorder knows when the take is fully captured. */
export function capturedUntil(chunks: readonly CaptureChunk[]): number {
  let end = 0
  for (const chunk of chunks) end = Math.max(end, chunk.frame + (chunk.channels[0]?.length ?? 0))
  return end
}

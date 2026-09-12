// MediaRecorder container choice. MP4 comes first because looping video seeks at every wrap,
// and MP4 carries an index. Chromium's recorded WebM has no cues, so its seeks are slower
// and its duration reads as Infinity. MP4 also plays in more places once exported.

export const VIDEO_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

export const AV_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const

/** The first supported type, or '' to let the browser pick its default. */
export function pickMimeType(candidates: readonly string[], isSupported: (type: string) => boolean): string {
  return candidates.find((type) => isSupported(type)) ?? ''
}

export function extensionForMime(mime: string): 'mp4' | 'webm' {
  return mime.trim().toLowerCase().startsWith('video/mp4') ? 'mp4' : 'webm'
}

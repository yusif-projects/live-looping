import { describe, expect, it } from 'vitest'
import { AV_MIME_CANDIDATES, VIDEO_MIME_CANDIDATES, extensionForMime, pickMimeType } from '../media/mime'

describe('mime', () => {
  it('picks the first supported type in order', () => {
    expect(pickMimeType(['a', 'b', 'c'], (t) => t !== 'a')).toBe('b')
    expect(pickMimeType(['a'], () => false)).toBe('')
  })

  it('prefers mp4 wherever both are supported', () => {
    expect(pickMimeType(VIDEO_MIME_CANDIDATES, () => true)).toMatch(/^video\/mp4/)
    expect(pickMimeType(AV_MIME_CANDIDATES, () => true)).toMatch(/^video\/mp4/)
  })

  it('falls back to webm on a browser without mp4 recording', () => {
    expect(pickMimeType(VIDEO_MIME_CANDIDATES, (t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9')
  })

  it('names the file after its container', () => {
    expect(extensionForMime('video/mp4;codecs=avc1,mp4a.40.2')).toBe('mp4')
    expect(extensionForMime('video/x-matroska;codecs=avc1')).toBe('webm')
    expect(extensionForMime('')).toBe('webm')
  })
})

// Camera, mic and speaker access.

const CAMERA_WIDTH = 1280
const CAMERA_HEIGHT = 720
const CAMERA_FPS = 30

// Voice-call processing wrecks instruments: echo cancellation eats sustained notes, noise
// suppression gates quiet playing, and AGC pumps. Headphones replace all three.
const MUSIC_AUDIO: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

const CAMERA_VIDEO: MediaTrackConstraints = {
  width: { ideal: CAMERA_WIDTH },
  height: { ideal: CAMERA_HEIGHT },
  frameRate: { ideal: CAMERA_FPS },
}

export interface DeviceLists {
  readonly cameras: readonly MediaDeviceInfo[]
  readonly mics: readonly MediaDeviceInfo[]
  readonly speakers: readonly MediaDeviceInfo[]
}

export const NO_DEVICES: DeviceLists = { cameras: [], mics: [], speakers: [] }

export async function listDevices(): Promise<DeviceLists> {
  const all = await navigator.mediaDevices.enumerateDevices()
  // Before permission is granted, entries come back without ids, so nothing can be picked by them.
  const usable = all.filter((d) => d.deviceId !== '')
  return {
    cameras: usable.filter((d) => d.kind === 'videoinput'),
    mics: usable.filter((d) => d.kind === 'audioinput'),
    speakers: usable.filter((d) => d.kind === 'audiooutput'),
  }
}

/**
 * One prompt for camera and mic together, which also unlocks device labels. A machine
 * without a camera still gets audio, since loops work without video.
 */
export async function requestMediaAccess(): Promise<void> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  } catch (error) {
    if ((error as { name?: string } | null)?.name !== 'NotFoundError') throw error
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  }
  stopStream(stream)
}

export function supportsSpeakerChoice(): boolean {
  return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype
}

async function open(kind: 'audio' | 'video', base: MediaTrackConstraints, deviceId: string | null): Promise<MediaStream> {
  const constraints = (id: string | null): MediaStreamConstraints => ({
    [kind]: id ? { ...base, deviceId: { exact: id } } : base,
  })
  try {
    return await navigator.mediaDevices.getUserMedia(constraints(deviceId))
  } catch (error) {
    // A remembered device that has since been unplugged. The system default beats no device.
    const name = (error as { name?: string } | null)?.name
    if (deviceId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
      return navigator.mediaDevices.getUserMedia(constraints(null))
    }
    throw error
  }
}

export const openCamera = (deviceId: string | null): Promise<MediaStream> => open('video', CAMERA_VIDEO, deviceId)

export const openMic = (deviceId: string | null): Promise<MediaStream> => open('audio', MUSIC_AUDIO, deviceId)

export function stopStream(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) track.stop()
}

export function watchDevices(onChange: () => void): () => void {
  navigator.mediaDevices.addEventListener('devicechange', onChange)
  return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
}

/** A sentence a user can act on, for the errors getUserMedia actually throws. */
export function describeMediaError(error: unknown): string {
  switch ((error as { name?: string } | null)?.name) {
    case 'NotAllowedError':
      return 'Camera or microphone access is blocked. Allow it in the browser’s site settings, then try again.'
    case 'NotFoundError':
      return 'No camera or microphone was found. Connect one and try again.'
    case 'NotReadableError':
      return 'The camera or microphone is in use by another app. Close it and try again.'
    case 'SecurityError':
      return 'Camera and microphone need a secure page (https or localhost).'
    default:
      return 'Could not open the camera or microphone.'
  }
}

// Shared by the capture worklet (audio thread) and the engine (main thread).

export const CAPTURE_PROCESSOR_NAME = 'live-looping-capture'

export type CaptureCommand = 'start' | 'stop'

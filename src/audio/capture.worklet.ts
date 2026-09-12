// Runs on the audio thread in AudioWorkletGlobalScope, which the DOM typings don't describe.
//
// This exists instead of MediaRecorder because every chunk carries `currentFrame`: the exact
// context frame its first sample was rendered on. That's what lets a take be cut to the bar
// line with sample accuracy. MediaRecorder starts at an unknown moment tens of milliseconds late.

import type { CaptureCommand } from './captureProtocol'
import { CAPTURE_PROCESSOR_NAME } from './captureProtocol'

declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void

class CaptureProcessor extends AudioWorkletProcessor {
  private capturing = false

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<CaptureCommand>) => {
      this.capturing = event.data === 'start'
    }
  }

  // One message per 128-frame render quantum (~375/s). Cheap to post, and batching would
  // only delay the moment the recorder learns a take is fully captured.
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]
    if (this.capturing && input && input.length > 0) {
      // The engine reuses these arrays for the next quantum, so copy before transferring.
      const channels = input.map((channel) => channel.slice())
      this.port.postMessage(
        { frame: currentFrame, channels },
        channels.map((channel) => channel.buffer),
      )
    }
    // Stay alive with no input, so the mic can be swapped without recreating the node.
    return true
  }
}

registerProcessor(CAPTURE_PROCESSOR_NAME, CaptureProcessor)

# Architecture

This page describes the code as it is now, not its history.

## Module map

| Module | Role |
| --- | --- |
| [main.tsx](../src/main.tsx) | Mounts the React root |
| [App.tsx](../src/App.tsx) | Top-level wiring: start gate or app, Space to play and stop, confirmations before destructive actions |
| [useLooper.ts](../src/useLooper.ts) | The only bridge between the engine and React: state, device streams, persistence, and the per-frame loop |
| [audio/engine.ts](../src/audio/engine.ts) | Owns the `AudioContext`: transport, metronome scheduler, reference tone, looping players, mic capture tap, input monitor and level, speaker routing |
| [audio/transport.ts](../src/audio/transport.ts) | Pure bar-grid math: bar and beat times, loop phase, when a take's count-in and recording happen, what the count-in overlay shows |
| [audio/level.ts](../src/audio/level.ts) | Pure: input peak → decibel meter level, its smoothing and clip warning |
| [audio/recorder.ts](../src/audio/recorder.ts) | One take: count-in, sample-accurate capture, the cut loop, the video clip |
| [audio/capture.worklet.ts](../src/audio/capture.worklet.ts) | `AudioWorkletProcessor` that posts mic PCM stamped with its context frame |
| [audio/captureProtocol.ts](../src/audio/captureProtocol.ts) | Names shared by the worklet and the engine |
| [audio/take.ts](../src/audio/take.ts) | Pure: slice captured chunks into an exact-length loop, fade its edges |
| [audio/notes.ts](../src/audio/notes.ts) | Pure: MIDI note ↔ name ↔ frequency, the offered reference range |
| [media/devices.ts](../src/media/devices.ts) | Permission prompt, device lists, `getUserMedia` with music-friendly constraints |
| [media/videoSync.ts](../src/media/videoSync.ts) | Pure: video drift → seek or playback-rate nudge |
| [media/exporter.ts](../src/media/exporter.ts) | Canvas plus panel audio → `MediaRecorder` → downloaded file |
| [media/mime.ts](../src/media/mime.ts) | Pure: recorder container choice and file extension |
| [state/panels.ts](../src/state/panels.ts) | Pure panel reducer: add/remove, record stages, lengths, mix |
| [state/settings.ts](../src/state/settings.ts) | Pure settings schema, defaults, parsing and clamping |
| [state/exportPlan.ts](../src/state/exportPlan.ts) | Pure export length, start bar, grid and crop geometry |
| [state/cycle.ts](../src/state/cycle.ts) | Pure: the loop cycle the transport readout counts through, its "3 / 8" label, and where a new take lines up with it |
| [storage/project.ts](../src/storage/project.ts) | Pure project schema and validation |
| [storage/db.ts](../src/storage/db.ts) | IndexedDB wrapper for the project and recorded takes |
| [lib/math.ts](../src/lib/math.ts) | `clamp`, a non-negative `mod`, `gcd`/`lcm` |
| [ui/](../src/ui/) | Presentational components: `StartGate`, `TransportBar`, `DeviceBar`, `PanelGrid`, `LoopPanel`, `ExportDialog` |

## Data flow

```
                         ┌──────────────── AudioContext clock ────────────────┐
                         │                                                    │
 mic ─► MediaStreamSource ─► capture worklet ─► recorder ─► take.ts ─► AudioBuffer ─► engine: looping
                         │   (frame-stamped PCM)   │                                  source per panel
 camera ─► MediaRecorder (video only) ─────────────┘─► Blob ─┐                              │
                         │                                   │                        panel gain
 engine: metronome clicks, reference tone ───────────────────┼──────────────────────► master ─► speaker
                         │                                   ▼                              │  (setSinkId)
                         │                             IndexedDB ◄─ project + takes         │
                         │                                   │                              │
                         └─ heardTime() ─► useLooper rAF ─► <video> per panel (seek / rate) │
                                                │          progress, countdown, bar / cycle │
                                                ▼                                           ▼
                                  exporter: canvas draws the synced videos + gated panel audio
                                                └──────────► MediaRecorder ─► downloaded file
```

The mic source also feeds a monitor gain into master, silent unless **Monitor** is on, and an
analyser the frame loop reads for the level bar. Neither is on the capture or export path.

## Lifecycle

**Load.** Settings are parsed from `localStorage` and one empty panel is created. The start
gate shows. No `AudioContext` exists yet, because browsers only let audio start from a user
gesture.

**Enable.** The click creates the engine, which loads the capture worklet and resumes the
context. `requestMediaAccess` prompts once for camera and mic. The project and its takes load
from IndexedDB, and each take becomes an `AudioBuffer` plus a video object URL. Then the phase
becomes `ready`, and effects open the camera and mic, route the speaker, list devices and start
the frame loop.

**Play.** `engine.start(origin)` anchors the bar grid. A 25 ms timer schedules clicks up to
120 ms ahead, walking beat indices so no beat is scheduled twice. Every loop starts at its
`loopOffset`, so it enters mid-phrase exactly where it would be.

**Record.** `planTake` chooses the bars:
- The count-in begins on the next bar boundary if the transport is running, or just ahead of
  now on a fresh grid if it's stopped.
- If other panels hold loops, `takeAlignment` says where the new loop lines up with them: every
  `gcd(its length, their cycle)` bars from where the longest one starts. Recording begins on the
  first such bar at least one bar after the count-in begins.
- With nothing to line up with, recording starts `countInBars` later.

While the count-in runs:
- The panel's old loop pauses.
- Clicks sound through the count-in even with the metronome off.
- The reference tone holds until 20 ms before the downbeat.

The worklet streams chunks from the start. The recorder keeps only those past the start frame,
which is the downbeat plus round-trip latency plus the user's audio latency offset. When a chunk
reaches the end frame, the loop is sliced to exactly `bars × samplesPerBar` and its edges are
faded. The video recorder stops 0.5 s later. `setLoop` starts the new loop phase-correct at once,
and the take is written to IndexedDB.

**Stop.** The scheduler timer is cleared and pending clicks are disconnected. Every source
stops, and the videos rest on their loop's first frame.

**Export.** The transport restarts so that the longest loop's first bar lands 0.4 s from now.
A gain gate on the panel audio opens at that moment and closes one full cycle later. The frame
loop draws the synced videos onto a canvas, and the recorder stops once the cycle has played.

## Design decisions worth knowing

**The `AudioContext` clock is the only clock.** It keeps loops of different lengths aligned
indefinitely. Take any timer or a video's `currentTime` as the reference instead, and loops
drift apart by tens of milliseconds a minute.

**Audio is captured by a worklet, not `MediaRecorder`.** Every chunk carries the context frame
it was rendered on, so a loop is cut on the bar line to the sample. `MediaRecorder` starts an
unknown, varying time late, and loops cut from it flam.

**A loop remembers the bar it was recorded on.** Its phase is `(bar − startBar) mod bars`, so a
loop recorded starting on bar 3 still lines up after stop and play. Drop `startBar` and every
loop snaps to bar 0, shifting the ones that weren't recorded there.

**Video follows the time being heard, not `currentTime`.** `heardTime()` reads
`getOutputTimestamp()`, which accounts for output latency. Following `currentTime` shows picture
ahead of sound by that latency.

**Video never loops by itself.** The `loop` attribute leaves a gap at the wrap and drifts. The
frame loop seeks when drift exceeds 120 ms (which also handles the wrap) and nudges
`playbackRate` by up to 10% for smaller drift. A seek is never issued while one is pending,
because each new seek restarts it.

**Per-frame work bypasses React.** Progress bars, count-in overlays, the mic level bar and the
bar-in-cycle readout are written straight to the DOM by one `requestAnimationFrame` loop in `useLooper`. Routing them
through state would re-render sixteen panels sixty times a second.

**Tempo and meter lock while any loop exists.** A take's length is baked into its samples, and
re-timing recorded video is out of scope. Clearing every loop unlocks them.

**A loop buffer is a whole number of frames.** It can run up to half a frame off the exact loop
length per cycle, which is at most about 36 ms an hour for a one-second loop. Every play
restarts each loop phase-correct, which resets the error.

**Export gates audio on the context clock.** `MediaRecorder` can't be started on a precise
moment, so it starts early. The panel audio is gated open on the exact first bar, which leaves
0.4 s of black silence at the head of the file. The recorded audio is also delayed by the
output latency to match the picture, which follows heard time.

**Voice processing is off on the mic.** Echo cancellation, noise suppression and auto gain
damage instruments. The cost is that speakers bleed into takes, which is why the app asks for
headphones.

**Audio latency applies at capture, video offset at playback.** The audio offset moves where
the next take is cut, which can't change for samples already recorded. The video offset is
applied every frame, so it re-syncs existing loops live.

**The capture worklet is bundled with `?worker&url`.** Vite builds it as a separate chunk and
returns its URL for `audioWorklet.addModule`. It imports only `captureProtocol.ts`, because
the worklet scope has no DOM.

**A new take lines up with the longest loop, not just the next bar.** `takeAlignment` anchors on
the longest loop's start, the bar the readout calls 1, and steps by `gcd(new length, cycle)`.
A short loop enters at any of its own boundaries inside a long one instead of waiting out the
whole cycle, and a longer loop starts on the cycle's first bar. Loop phase alone would stay in
time from any bar; the alignment keeps loops in phrase. The count-in is at least one bar, so there
is always a bar of clicks to count.

**Monitoring feeds master, not a panel.** The exporter taps panel gains, so a monitored mic never
lands in a file. Capture reads the mic before the monitor gain, so monitor volume never changes a
take. Browser monitoring adds base and output latency, roughly 10–40 ms, which is why it is off
by default and the level bar works without it.

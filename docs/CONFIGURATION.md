# Configuration

## Settings

Per-machine preferences, defined in [state/settings.ts](../src/state/settings.ts).

| Key | Default | Range | What it does |
| --- | --- | --- | --- |
| `metronomeOn` | `true` | boolean | Clicks while playing. The count-in clicks regardless. |
| `metronomeVolume` | `0.6` | 0–1 | Click level, which also sets the count-in level |
| `countInBars` | `1` | 1–4 | Bars of count-in when no other loop is recorded. Otherwise a take counts in, for at least a bar, to where it lines up with the existing loops. |
| `referenceNote` | `69` (A4) | `null`, or MIDI 36–84 (C2–C6) | Tone held through the count-in; `null` is no tone |
| `referenceVolume` | `0.4` | 0–1 | Reference tone level |
| `monitorOn` | `false` | boolean | Plays the mic to the output live. Off by default, because through speakers it feeds back. |
| `monitorVolume` | `0.8` | 0–1 | Monitor level |
| `cameraId` | `null` | device id or `null` | Camera; `null` or an unplugged device uses the system default |
| `micId` | `null` | device id or `null` | Microphone, same fallback |
| `speakerId` | `null` | device id or `null` | Output device, where `AudioContext.setSinkId` exists |
| `latencyOffsetMs` | `0` | −200…200 | Added to the measured round-trip latency; positive cuts later takes later |
| `videoOffsetMs` | `0` | −300…300 | Shifts every loop's picture against its sound; positive shows video later |

Project values live with the loops, because the loops depend on them. They're defined in
[audio/transport.ts](../src/audio/transport.ts), [state/panels.ts](../src/state/panels.ts)
and [storage/project.ts](../src/storage/project.ts).

| Key | Default | Range | What it does |
| --- | --- | --- | --- |
| `tempo` | `120` | 40–240 BPM, whole numbers | Grid tempo; locked while any loop exists |
| `beatsPerBar` | `4` | 2–12 | Grid meter; locked while any loop exists |
| panel `bars` | `4`, or the previous panel's length | 1, 2, 4, 8, 16, 32 | Loop length; fixed once the panel holds a loop |
| panel `noteOverride` | `null` | `null` or MIDI 36–84 | Reference note for this panel; `null` uses the global one |
| panel `volume` | `0.8` | 0–1 | Loop level |
| panel `muted` | `false` | boolean | Silences the loop and dims its video |
| panel count | 1 | 1–16 | Panels in the project |

## Persistence

| What | Where | Written |
| --- | --- | --- |
| Settings | `localStorage` key `live-looping:settings:v1`, as JSON | On every change |
| Project (tempo, meter, panels, each take's `startBar`, `bars`, `videoOffset`) | IndexedDB database `live-looping`, store `project`, key `current` | 300 ms after the last change |
| Takes (video `Blob`, one `Float32Array` per audio channel, sample rate) | Same database, store `takes`, keyed by panel id | When a take finishes; deleted on clear or remove |

The first saved take asks the browser for persistent storage (`navigator.storage.persist()`),
so recorded loops aren't evicted under storage pressure. A `QuotaExceededError` shows a notice.
The take keeps playing from memory but won't survive a reload.

**Migration.**
- Settings are parsed field by field. A missing, corrupt or out-of-range value falls back to its
  default, so adding a field needs no migration. Renaming or re-typing one means bumping the key
  to `:v2` and reading `:v1` once.
- The project carries `version: 1`. `parseProject` rejects any other version, which starts a
  fresh project, so a schema change must bump `PROJECT_VERSION` and convert the old shape in
  `parseProject`.
- On load, takes whose panel the project no longer lists are deleted, and a panel whose take is
  missing comes back empty.

## Environment variables

None yet. Vite exposes only variables prefixed `VITE_` to the client; anything
added here goes in a `.env.*` file and gets a row in this table.

| Variable | Used by | Purpose |
| --- | --- | --- |
| | | |

## Tooling

| File | What it sets |
| --- | --- |
| [vite.config.ts](../vite.config.ts) | React plugin, relative `base: './'`, dev server fixed to port 5180 with `strictPort` |
| [tsconfig.app.json](../tsconfig.app.json) | App code under `src/` — ES2023, bundler resolution, `verbatimModuleSyntax`, `erasableSyntaxOnly`, no unused locals or parameters |
| [tsconfig.node.json](../tsconfig.node.json) | `vite.config.ts` only |
| [.oxlintrc.json](../.oxlintrc.json) | oxlint with the react, typescript and oxc plugins; rules of hooks as an error; `.claude/` and `dist/` ignored, since vendored skill code is not ours to lint |

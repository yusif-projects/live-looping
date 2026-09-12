# Getting started

## Requirements

| Thing | Why |
| --- | --- |
| Node 22+ | Matches the CI runner |
| A modern desktop browser | Needs `getUserMedia`, `AudioWorklet`, `MediaRecorder`, `IndexedDB` and `canvas.captureStream`. Output selection also needs `AudioContext.setSinkId` (Chrome, Edge). |
| A camera, a mic, headphones | The camera is optional (loops become audio-only); headphones keep speakers out of takes |

## Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:5180>.

The port is fixed. [vite.config.ts](../vite.config.ts) sets `strictPort`, so if
5180 is already taken the dev server exits with an error rather than moving to
another port — stop the old server and run it again.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload on port 5180 |
| `npm run build` | `tsc -b` project build, then `vite build` into `dist/` |
| `npm run preview` | Serves the built `dist/` locally (port 4173) |
| `npm test` | Vitest, single run — pure-logic tests only |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | oxlint |
| `npm run check-commits` | Validates a commit message file, or `-- --range main..HEAD` |
| `prepare` | Runs on `npm install`; points `core.hooksPath` at `.githooks/` |

`prepare` is what installs the `commit-msg` hook, so commit messages are checked
against [Conventional Commits](https://www.conventionalcommits.org) from your
first commit after `npm install` — see
[contributing](CONTRIBUTING.md#commit-messages) for the format.

## Project layout

```
src/
├── __tests__/     pure-logic tests
├── audio/         engine, transport math, recorder, capture worklet
├── media/         devices, video sync, exporter
├── state/         panel reducer, settings, export geometry
├── storage/       project schema, IndexedDB
├── lib/           math helpers
├── ui/            presentational components
├── useLooper.ts   engine ↔ React bridge
├── App.tsx        top-level wiring
├── main.tsx       React root
└── styles.css     the entire stylesheet
public/            static assets served as-is (favicon)
scripts/           commit-message.mjs · next-version.mjs
.githooks/         commit-msg — the conventional-commit gate
.github/           CI, commit check, Pages deploy, release
.claude/           skills and subagents, committed rather than installed
                   per machine — see docs/AI-USAGE.md
docs/              this documentation
```

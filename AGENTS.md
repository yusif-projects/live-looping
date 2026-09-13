# AGENTS.md

Live Looping — a client-only React app for recording video-and-audio loops that
play in sync against one tempo. It has up to 16 panels, each looping its own number of
bars, with a metronome, a count-in that holds a reference note, device pickers, and
export to a video file. The Web Audio clock drives everything:
- An AudioWorklet captures mic audio cut to the sample.
- Looping buffer sources play it back.
- `<video>` elements are corrected every frame to follow the heard time.

Loops persist in IndexedDB. No backend, no server code anywhere in this repo.

The documentation in [docs/](docs/) is the map. **Read the doc before grepping
the source** — the routing table below says which one, and each doc links to
the exact files it describes.

## Where things are documented

| If the task touches… | Read |
| --- | --- |
| Running, building, testing, scripts, project layout | [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) |
| Module map, data flow, lifecycle, design decisions | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Settings, persistence, env vars, Vite/TS/lint config | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) |
| GitHub Pages pipeline, releases, rollback | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| A user-reported bug | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Test strategy, code conventions, commit format | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| The app from the user's side | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) |
| Claude Code setup, the skills under `.claude/`, vendoring or updating a skill | [docs/AI-USAGE.md](docs/AI-USAGE.md) |
| An overview before picking any of the above | [docs/README.md](docs/README.md) |

## Source map

```
src/
├── __tests__/     pure-logic tests only                       → docs/CONTRIBUTING.md
├── audio/         engine, transport math, recorder, worklet   → docs/ARCHITECTURE.md
├── media/         devices, video sync, exporter, mime choice  → docs/ARCHITECTURE.md
├── state/         panel reducer, settings, cycle, export math → docs/CONFIGURATION.md
├── storage/       project schema, IndexedDB                   → docs/CONFIGURATION.md
├── lib/           small math helpers
├── ui/            presentational components
├── useLooper.ts   the one hook bridging engine and React      → docs/ARCHITECTURE.md
├── App.tsx        top-level wiring                            → docs/ARCHITECTURE.md
├── main.tsx       React root
└── styles.css     the entire stylesheet
```

Keep this map current as directories appear — it is the first thing an agent
reads.

## Commands

```bash
npm test        # vitest, single run — the fast check, no browser needed
npm run lint    # oxlint
npm run typecheck
npm run build   # tsc -b + vite build
npm run dev     # http://localhost:5180
```

Before pushing: `npm test && npm run lint && npm run build`. Anything touching
timing, audio or the UI also needs a manual run — the tests cover pure logic
only, by design.

**The dev server lives on port 5180 — always that one.** `vite.config.ts` sets
`strictPort`, so if 5180 is taken `npm run dev` fails instead of drifting to
another port. A busy 5180 almost always means an old dev server of this repo is
still running: stop that one and reuse the port. Never pass `--port`, never
change `server.port` in `vite.config.ts`, and never write another port into
docs, scripts, tests or a screenshot run. 5173 belongs to dj-hands. `npm run
preview` stays on its own default (4173) and is not a substitute for `npm run
dev`.

## Invariants worth knowing before you edit

These are the ones that break silently. Full reasoning in
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#conventions).

- **TypeScript is strict in ways that fail the build**, not the lint:
  `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (no enums, no
  constructor parameter properties), `noUnusedLocals`, `noUnusedParameters`.
- **Pure logic stays React-free** so it can be tested without a DOM. Put the
  math in a plain `.ts` module and keep the `.tsx` component presentational.
- **Tuning constants live named at the top of their module.** Edit the
  constant, not an inline number.
- **Comments explain why, not what.** They document non-obvious constraints;
  if a line looks gratuitously complicated, say what would break if it were
  simpler.

## Hand edits are not drafts

Code an agent wrote stops belonging to the agent the moment it is on disk. The
working tree is the source of truth, not the version an earlier turn produced.

- **Re-read a file immediately before editing it**, even one written earlier in
  the same session. What is on disk now is what ships.
- **If a file differs from what the agent last wrote, that difference is
  deliberate.** Treat a hand edit as a decision — keep it, build on top of it,
  and match its style in the surrounding code. Do not "fix" it back toward the
  generated version.
- **Never rewrite a whole file to change part of it.** Edit the part. A
  full-file rewrite silently reverts every hand edit it does not happen to
  reproduce.
- If a hand edit genuinely conflicts with the task — it breaks an invariant
  above, or the request cannot be satisfied while keeping it — **stop and ask**.
  Say what changed and why it collides. Do not overwrite it and mention it
  afterwards.

## Repo conventions

**Never push to a remote without asking first.** Commit locally when asked, then
stop and ask — pushing is outward-facing. The one exception
is the `ship` skill: invoking `/ship` *is* the permission to stage, commit, and
push. Permission for one push does not carry to the next.

GitHub Pages deploys are paused: a push to `main` deploys nothing until the push
trigger in `deploy.yml` is restored — see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Once it is, `main` deploys to
production on push, so branch for anything not ready to publish.

**Commit messages follow [Conventional Commits](https://www.conventionalcommits.org).**
The `commit-msg` hook rejects anything else, and so does CI on a pull request.

```
type(optional scope)!: description

feat(looper): add overdub on a second press
fix(audio): keep the loop length when the tempo changes
docs: document the recording lifecycle
```

- **Types:** `feat` `fix` `perf` `refactor` `docs` `test` `build` `ci` `style`
  `chore` `revert`. Scope is optional and lowercase — usually a source directory
  under `src/`, or `deps`, `deploy`, `skills`.
- The description stays imperative, lowercase, under 72 characters with the
  prefix, no trailing period, and describes the **user-visible change**.
- `feat` bumps the minor version on the next deploy, a `!` or a
  `BREAKING CHANGE:` footer bumps the major, everything else the patch — see
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#releases). Type honestly; the version
  is derived from it.
- **No tool attribution, ever.** No `Co-Authored-By: Claude`, no
  `Claude-Session:`, no "Generated with Claude Code". Commits here are authored
  by a person; GitHub renders a co-author trailer as a contributor on every
  commit page. `.claude/settings.json` turns the trailer off at the source and
  the `commit-msg` hook rejects one that arrives anyway.

**Skills belong to this repo, never to the machine.** Installing, vendoring or
writing a skill means creating it under `.claude/skills/<name>/` in this project
and committing it. Never write to `~/.claude/skills/`, `~/.claude/agents/`, or
any other path in the home directory — a global skill is invisible to everyone
who clones this repo, survives no `git clean`, and silently follows you into
unrelated projects. The same goes for agents (`.claude/agents/`), commands and
`settings.json`: project-local, tracked in git.

- Vendoring an upstream skill: clone it, strip its `.git`, copy it into
  `.claude/skills/`, and record the source and commit in
  [skills-lock.json](skills-lock.json) — the full procedure is in
  [docs/AI-USAGE.md](docs/AI-USAGE.md#vendoring-a-skill).
- If a tool offers to install a skill globally, decline and place it by hand.
- Anything that would touch the home directory is worth a question first.

Keep the docs in step with the code: a change that makes any statement in
[docs/](docs/) wrong should update that doc in the same commit.

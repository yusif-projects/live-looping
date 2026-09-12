# AI

This project is built with [Claude Code](https://claude.com/claude-code). Four
skills are committed under `.claude/skills/` — two written for these projects,
two vendored from upstream. A skill is a folder with a `SKILL.md` that teaches
the agent one job: how to commit here, how to keep the docs true, how to draw
the architecture, how to hold the design system.

None of it ships to users. It is build-time tooling, and it is committed rather
than installed per machine so a clone gets the same versions.

## Contents

- [How an agent starts here](#how-an-agent-starts-here)
- [My skills](#my-skills)
  - [ship](#ship) — stage, commit, push, without breaking production
  - [update-docs](#update-docs) — keep `docs/` true after a code change
- [Vendored skills](#vendored-skills)
  - [archify](#archify) — architecture diagrams, generated and verified
  - [impeccable](#impeccable) — design audits and refinement
- [Vendoring a skill](#vendoring-a-skill)
- [Keeping vendored skills current](#keeping-vendored-skills-current)

## How an agent starts here

[CLAUDE.md](../CLAUDE.md) imports [AGENTS.md](../AGENTS.md), the entry point — a
routing table from "the task touches X" to the doc that owns X.

Impeccable looks for two more files at the root, written by
`/impeccable init` once there is a product to describe:

| File | What it holds |
| --- | --- |
| `PRODUCT.md` | Audiences, purpose, positioning, durable constraints, brand commitments |
| `DESIGN.md` | Colour, typography, layout, depth and component rules |

```
.claude/
├── settings.json     tracked — turns off commit attribution
├── settings.local.json  per machine, gitignored — Impeccable's design hooks
├── agents/           four subagents that ship with Impeccable
└── skills/
    ├── ship/         mine
    ├── update-docs/  mine
    ├── archify/      vendored — tt-a1i/archify, MIT
    └── impeccable/   vendored — pbakaus/impeccable, Apache 2.0
```

A skill is matched by its frontmatter `description`, not by name — you describe
the task and the right one loads.

## My skills

Both are plain markdown. No scripts, no dependencies.

### ship

Stages everything, writes a commit message in this repo's style, and pushes to
the current branch.

- Reads the diff before writing the message, and scans staged files for secrets,
  `.env*`, or unrelated work in progress
- Writes a [Conventional Commit](https://www.conventionalcommits.org) and picks
  the type carefully, since it decides the version the deploy tags
- Refuses to resolve a rejected push on its own — no silent pull, rebase or merge
- Adds no attribution trailer — `.claude/settings.json` disables it at the
  source, and the `commit-msg` hook rejects one that slips through anyway

```
ship it
```

**Why this repo needs it.** A push to `main` is a production deploy through
[deploy.yml](../.github/workflows/deploy.yml). So `ship` runs the checks locally
and asks for confirmation before pushing to `main`, while pushing freely on any
other branch.

### update-docs

Brings `docs/` and the root README back in line with the code after a change.

- Routes a change to the page that owns it
- Edits the existing paragraph or table row instead of appending a "New in this
  version" section — these docs describe current state, not history
- Registers any genuinely new page in *both* indexes, and verifies every link
  and code reference it touched

```
update the docs
```

**Why this repo needs it.** AGENTS.md tells every agent to read the doc *before*
grepping the source — so a stale page does not just sit there, it actively
misleads.

## Vendored skills

These carry real code, so they are committed rather than installed per machine.

### archify

Renders architecture diagrams from a typed JSON spec into one standalone HTML
file, kept in `docs/DIAGRAMS/`.

- Five diagram types — `architecture`, `workflow`, `sequence`, `dataflow`,
  `lifecycle`
- `validate` before `deliver`, so a broken spec fails loudly instead of
  rendering something wrong
- Verifies that source paths cited in the spec actually exist, via `--repo-root`

```bash
node .claude/skills/archify/bin/archify.mjs validate architecture \
  docs/DIAGRAMS/architecture-diagram.json --quality showcase --repo-root . --json

node .claude/skills/archify/bin/archify.mjs deliver architecture \
  docs/DIAGRAMS/architecture-diagram.json \
  docs/DIAGRAMS/architecture-diagram.html --quality showcase --repo-root .
```

### impeccable

Frontend design work: audit, critique, and targeted refinement passes over the
UI.

- `init` writes `PRODUCT.md` and `DESIGN.md`; `audit`, `polish`, `typeset`,
  `colorize` and `document` do the day-to-day work
- Ships a detector that flags common UI slop — wired into Claude Code as
  `PostToolUse` and `Stop` hooks in `.claude/settings.local.json` — and four
  subagents in `.claude/agents/`

```
/impeccable init
/impeccable audit src/App.tsx
```

## Vendoring a skill

Copy the folder in and commit it:

```bash
git clone --depth 1 https://github.com/<owner>/<skill>.git /tmp/<skill>
rm -rf /tmp/<skill>/.git
cp -R /tmp/<skill> .claude/skills/<skill>
```

Record where it came from in [skills-lock.json](../skills-lock.json), so a
vendored copy is distinguishable from local edits.

Two things to check before committing:

- **Does it ship subagents?** Impeccable does — its four `impeccable-*.md` files
  belong in `.claude/agents/`, not in the skill folder.
- **Does it write scratch files?** Impeccable writes to `.impeccable/`. The
  throwaway parts are in [.gitignore](../.gitignore); the durable parts
  (`config.json`, `design.json`, `surfaces/`) are committed on purpose.

## Keeping vendored skills current

Archify ships a checker that only *reports* — it never downloads or installs:

```bash
node .claude/skills/archify/scripts/check-update.mjs
```

An `update_available` means re-vendoring by hand with the steps above, and
bumping `computedHash` in the same commit.

Impeccable updates itself through its own CLI:

```bash
npx impeccable update
```

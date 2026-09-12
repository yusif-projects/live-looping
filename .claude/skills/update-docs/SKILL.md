---
name: update-docs
description: Bring docs/ and the root README back in line with the code. Use when the user says "update the docs", "document this", "the docs are stale", or after a change that alters behaviour, settings, or the module map.
---

# Update docs

The docs in [docs/](../../../docs) describe the app **as it is now** — not what
changed. Your job is to make them true again after a code change, and to touch
only the pages that actually went stale.

## Steps

### 1. Find out what changed

```bash
git status --short && git diff --stat HEAD
```

If the work is already committed, diff against the point it started instead
(`git diff main...HEAD`, or `git show <sha>`). If the user described the change
in prose rather than pointing at code, find it first — you cannot document a
behaviour you have not read.

Read the actual diff of every file you plan to write about. Docs in this repo
quote real defaults, real ranges, and real function names; getting one wrong is
worse than leaving the page alone.

### 2. Route the change to the pages that own it

| What changed | Pages that likely need it |
| --- | --- |
| Settings, persistence, env vars | [CONFIGURATION.md](../../../docs/CONFIGURATION.md) — schema block **and** the defaults/ranges table |
| Components the user sees and controls they use | [USER-GUIDE.md](../../../docs/USER-GUIDE.md) — what the user sees and does |
| `src/App.tsx`, a new `src/` directory, data flow or lifecycle | [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) — module map, data flow, ASCII diagram; also the source map in [AGENTS.md](../../../AGENTS.md) |
| `src/__tests__/*` | [CONTRIBUTING.md](../../../docs/CONTRIBUTING.md) — the suite table |
| `.github/workflows/*`, `.github/actions/*`, `vite.config.ts` | [DEPLOYMENT.md](../../../docs/DEPLOYMENT.md), [GETTING-STARTED.md](../../../docs/GETTING-STARTED.md), CONFIGURATION.md — the tooling table |
| `scripts/commit-message.mjs`, `next-version.mjs`, `.githooks/*` | CONTRIBUTING.md — the commit format; DEPLOYMENT.md — the version it picks |
| `.claude/skills/*`, `.claude/agents/*`, `skills-lock.json` | [AI-USAGE.md](../../../docs/AI-USAGE.md) — what each skill does and why this repo has it |
| New user-facing failure or error message | [TROUBLESHOOTING.md](../../../docs/TROUBLESHOOTING.md) — symptom first, then fix |
| `package.json` scripts, Node version, browser support | GETTING-STARTED.md, CONTRIBUTING.md |

A single change often lands in two places — a new setting is both a schema row
in CONFIGURATION.md and a sentence in USER-GUIDE.md about what the control does.
Follow it through. Grep the docs for the old value or the old name to catch
mentions you would not have guessed:

```bash
grep -rn "<old name or value>" docs README.md
```

### 3. Edit in place

Prefer editing the existing paragraph, table row, or code block over appending a
new section. A doc that grows a "New in this version" section has failed at its
job — the reader wants current state, not history. There is no changelog in
`docs/`; do not start one.

Match what is already on the page:

- **Prose wrapped at ~80 columns**, plain declarative sentences
- **Tables** for anything enumerable — settings, controls, ranges, test suites
- **Links to source as relative paths** — `[App.tsx](../src/App.tsx)`
- Fenced blocks for real code, real shell commands, and the ASCII diagrams
- Explain the *why* where it is non-obvious — these docs justify decisions, and
  a new entry should too

A page still holding `TODO:` placeholders is a template. When the change gives
you the real content for one, replace the placeholder rather than writing around
it.

### 4. Create a new page only for a genuinely new subsystem

A new page is right when the material has no owner — a subsystem with its own
model (audio, recording, sync), a new integration, a new build target, a new
deployment surface — not — a new integration, a new build target, a new deployment surface — not
because an existing page is getting long.

When you do add one, it is not finished until it is registered in **both**
indexes:

- The contents table in [docs/README.md](../../../docs/README.md)
- The documentation table in [README.md](../../../README.md)

- The routing table in [AGENTS.md](../../../AGENTS.md)

Give it an `# H1` title and the same structure as its neighbours.

### 5. Then decide about the root README

[README.md](../../../README.md) is the landing page, not another doc. Update it
only when the change is visible from outside the code:

- The one-paragraph description of what the app does
- The list of what is configurable
- The ASCII data-flow diagram, if a node was added or removed
- The `npm` commands in **Run it**
- The documentation table, if a page was added or renamed

A refactor, an internal rename, or a new test does not touch the README. When in
doubt, leave it — a stale README line is more expensive than a missing one.

Keep the badges, the centred header block, and the Credits section as they are
unless the user asks.

### 6. Verify before reporting

For every link and code reference you added or edited, confirm the target
exists — the file path, the function name, the setting key, the heading anchor.
Relative links resolve from the file they live in, so `../src/...` from `docs/`
and `docs/...` from the root README:

```bash
grep -ohE '\]\(\.\./[^)#]+' docs/*.md | sed 's/^](\.\.\///' | sort -u |
  while read -r f; do [ -e "$f" ] || echo "broken: $f"; done
```

Then re-read your own diff:

```bash
git diff -- docs README.md
```

Check that nothing you wrote contradicts a page you did not open. The defaults
table in CONFIGURATION.md and the settings prose in USER-GUIDE.md are the pair
that drifts apart most often.

## Report back

List the pages you changed and the one-line reason for each, plus anything you
deliberately left alone (`README.md — unchanged, the change is internal`). If
you found a doc that was already wrong for an unrelated reason, say so rather
than silently fixing it in the same pass.

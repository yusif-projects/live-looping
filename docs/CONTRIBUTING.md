# Contributing

## Before you push

```bash
npm run lint       # oxlint
npm run typecheck  # tsc -b --noEmit
npm test           # vitest, single run
npm run build      # the real gate — typecheck + bundle
```

CI runs all four on every pull request
([ci.yml](../.github/workflows/ci.yml)), and again on the push to `main` that
deploys. Both call the same composite action,
[.github/actions/build](../.github/actions/build/action.yml), so what runs in CI
is exactly the list above — running it locally first just fails you faster.

## Testing strategy

Tests cover the **pure logic** — the parts where a bug is silent and a test is
cheap. There are no DOM tests. Tests live in `src/__tests__/` and run in Node.

| Suite | Covers |
| --- | --- |
| [commitMessage.test.ts](../src/__tests__/commitMessage.test.ts) | The commit-message grammar and the version it implies — header parts, unknown types, sentence case, trailing periods, the length limit, the blank line a body needs, the breaking-change footer, git's own merge/revert/fixup messages, and `nextVersion` moving major, minor or patch |

`commitMessage.test.ts` reaches out of `src/` into [scripts/](../scripts/) — the
two commit scripts are plain ESM with pure exports.

**What to add a test for:** TODO — the modules whose bugs are silent.

**What not to bother with:** presentational React components. Test those by
running the app.

## Conventions

**Purity boundaries are load-bearing.** Logic lives in plain `.ts` modules with
no side effects and no React; `.tsx` components stay presentational. That is
what keeps the test suite small and fast.

**Comments explain why, not what.** If a line looks gratuitously complicated,
say what would break if it were simpler.

**TypeScript settings that will bite you:** `verbatimModuleSyntax` means
type-only imports must be written `import type`, and `erasableSyntaxOnly` means
no enums and no constructor parameter properties. `noUnusedLocals` and
`noUnusedParameters` fail the build, not just the lint.

**Constants at the top of the module**, named and commented, rather than magic
numbers inline. Tuning happens by editing one named value.

## Repository conventions

Work on `main` deploys immediately. Branch for anything you are not ready to
publish.

### Commit messages

Every commit follows [Conventional Commits](https://www.conventionalcommits.org):

```
type(optional scope)!: description

[optional body]

[optional BREAKING CHANGE: footer]
```

| Type | For |
| --- | --- |
| `feat` | A user-visible capability |
| `fix` | A user-visible bug fix |
| `perf` | Faster or lighter, same behaviour |
| `refactor` | Same behaviour, different code |
| `docs` | `docs/`, the README, `AGENTS.md`, comments |
| `test` | Tests only |
| `build` | Vite, tsconfig, `scripts/`, dependencies |
| `ci` | `.github/workflows` |
| `style` | Formatting only |
| `chore` | Anything else that ships no behaviour |
| `revert` | Undoes an earlier commit |

Scope is optional, lowercase, and usually the source directory the change lives
in — or `deps`, `deploy`, `skills`. The description is imperative, lowercase,
describes the user-visible change rather than the files touched, has no
trailing period, and keeps the whole header under 72 characters.

**The format decides the next version.** The deploy tags a release on every push
to `main`, and [scripts/next-version.mjs](../scripts/next-version.mjs) reads the
commits to pick the number: `feat` → minor, `!` or a `BREAKING CHANGE:` footer →
major, everything else → patch. See [deployment](DEPLOYMENT.md#releases).

**Two gates enforce it.** [scripts/commit-message.mjs](../scripts/commit-message.mjs)
runs from `.githooks/commit-msg` on every local commit — `npm install` points
`core.hooksPath` at that directory through the `prepare` script. The same script
runs over the whole branch in [commits.yml](../.github/workflows/commits.yml) on
a pull request, which catches commits made where the hook was never installed.

**No tool attribution.** A `Co-Authored-By:` line naming Claude or Anthropic, a
`Claude-Session:` trailer, or a "Generated with Claude Code" line is rejected by
the same hook. `.claude/settings.json` sets `attribution.commit` to an empty
string so no agent session adds one in the first place. A co-author trailer
naming an actual human is fine.

To check a range by hand:

```bash
npm run check-commits -- --range main..HEAD
```

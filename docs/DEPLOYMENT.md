# Deployment

The app is static: `npm run build` writes `dist/`, and GitHub Pages serves it.

## Pipeline

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [ci.yml](../.github/workflows/ci.yml) | Pull request | Lint, typecheck, build, test |
| [commits.yml](../.github/workflows/commits.yml) | Pull request | Checks every commit on the branch is a Conventional Commit |
| [deploy.yml](../.github/workflows/deploy.yml) | Manual only, for now | Same checks, then publishes `dist/` to Pages; tags a release when push-triggered |
| [release.yml](../.github/workflows/release.yml) | A `v*` tag pushed by hand | Builds and attaches a zip of `dist/` to a release |

Every workflow installs and checks through one composite action,
[.github/actions/build](../.github/actions/build/action.yml), so CI, the deploy
and a release all run the same steps.

**Deploys are paused.** The `push` trigger in `deploy.yml` is commented out
until the site is ready to publish, so a push to `main` runs nothing and no
release is tagged. Uncomment it to turn automatic deploys back on. A site
deployed before the pause stays live until Pages is unpublished in the repo
settings.

**One-time setup:** in the GitHub repo, *Settings → Pages → Source* must be
**GitHub Actions**, or the deploy job fails.

TODO: custom domain — add `public/CNAME` and document it here.

## Releases

The `tag` job in `deploy.yml` runs after every push-triggered deploy that
reached the site — none while deploys are paused. [scripts/next-version.mjs](../scripts/next-version.mjs) reads
the commits since the last `v*` tag and picks the bump:

| Commits since the last tag include | Bump |
| --- | --- |
| A `!` before the colon, or a `BREAKING CHANGE:` footer | major |
| A `feat` | minor |
| Anything else | patch |

The first release lands on `v0.0.1`, `v0.1.0` or `v1.0.0` depending on the log.

## Rollback

Run **Deploy to GitHub Pages** by hand (*Actions → Deploy → Run workflow*) with
the tag of a known-good release as `ref`. Manual runs skip the tag job, so a
rollback never tags old code as a new version.

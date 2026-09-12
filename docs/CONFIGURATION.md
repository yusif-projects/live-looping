# Configuration

## Settings

TODO: the settings schema, defaults and ranges, as a table.

| Key | Default | Range | What it does |
| --- | --- | --- | --- |
| | | | |

## Persistence

TODO: what is stored, where (`localStorage` key), and how old data is migrated.

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

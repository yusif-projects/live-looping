# Troubleshooting

Each entry leads with the symptom as a user would describe it, then the cause,
then the fix.

## `npm run dev` fails with "Port 5180 is already in use"

**Cause:** another dev server of this repo is still running. The port is fixed
with `strictPort` on purpose, so Vite refuses to move to a different one.

**Fix:** stop the old server (`lsof -i :5180` finds its process) and run
`npm run dev` again.

## A commit is rejected with "Not a conventional commit"

**Cause:** the `commit-msg` hook checks every message against the format in
[contributing](CONTRIBUTING.md#commit-messages).

**Fix:** reword the message as `type(optional scope): description`. The hook
prints what was wrong and the list of valid types.

TODO: add app-specific problems as they come up.

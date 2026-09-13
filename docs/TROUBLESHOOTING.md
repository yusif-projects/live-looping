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

## "Camera or microphone access is blocked"

**Cause:** the browser's permission for this site is set to block, or it was dismissed.

**Fix:** open the site settings (the icon left of the address bar), allow camera and
microphone, then press **Enable** again. On macOS, also check System Settings → Privacy &
Security → Camera and Microphone for the browser.

## There is no Speaker picker

**Cause:** choosing an output needs `AudioContext.setSinkId`, which Chromium browsers have and
Safari and Firefox currently don't.

**Fix:** pick the output in the operating system's sound settings, or use Chrome or Edge.

## New loops sound late, or flam against the click

**Cause:** the app cuts each take later by the latency the browser reports, but some interfaces
and Bluetooth headphones report less than they really have.

**Fix:** open **Sync** and raise **Audio latency** until a take of claps on the click lands on
the click. It affects the next take, not existing ones. Wired headphones help a lot, because
Bluetooth adds 150 ms or more.

## The video is ahead of or behind the sound

**Cause:** cameras deliver frames later than audio, by an amount the browser doesn't report.

**Fix:** adjust **Video offset** under **Sync**. It moves every loop's picture at once, live.

## Loops contain the click or other loops

**Cause:** speakers. The mic records without echo cancellation, because that processing damages
instruments.

**Fix:** use headphones.

## Echo, feedback or a howl with Monitor on

**Cause:** the monitored mic is coming out of speakers and back into the mic. Browsers also
delay monitored sound by roughly 10–40 ms, which on its own can sound like a short echo.

**Fix:** use wired headphones, or turn **Monitor** off and watch the level bar in the
**Microphone** picker instead. The monitor signal itself is never recorded into loops or
exports; only what speakers bleed into the mic is.

## The click stutters, or an export is choppy

**Cause:** browsers throttle timers and animation frames in background tabs. The scheduler then
misses beats and the export's canvas stops drawing.

**Fix:** keep the tab in front while playing or exporting.

## Loops were gone after reopening the page

**Cause:** the browser's storage for the site was cleared, or it was a private window, or the
**storage is full** notice appeared when the loop was recorded.

**Fix:** export loops you want to keep. Loops recorded after a storage-full notice play until
the page closes. Clearing old loops frees space.

## The picture hitches where the loop wraps

**Cause:** the wrap is a seek. Browsers that can't record MP4 fall back to WebM, which seeks
more slowly, and only Chromium honours the short keyframe interval the app asks for.

**Fix:** use a recent Chrome or Edge. Audio is unaffected either way.

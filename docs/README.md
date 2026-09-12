# Live Looping — Documentation

Record video loops that play in time: count in, capture, stack up to sixteen.

Live Looping is a client-only React app. A Web Audio engine owns the one clock, and
several pieces hang off it:
- An AudioWorklet captures mic audio cut to the sample.
- Looping buffer sources play the loops back.
- A frame loop keeps each panel's `<video>` on the heard time.
- IndexedDB keeps the project and its takes.
- A canvas plus `MediaRecorder` exports loops to a file.

React only renders controls; per-frame work goes straight to the DOM.

## Contents

| Document | What is in it |
| --- | --- |
| [Getting started](GETTING-STARTED.md) | Install, run, build, test, project layout |
| [User guide](USER-GUIDE.md) | Using the app |
| [Architecture](ARCHITECTURE.md) | Module map, data flow, design decisions |
| [Configuration](CONFIGURATION.md) | Settings, persistence, environment variables, tooling config |
| [Deployment](DEPLOYMENT.md) | GitHub Pages pipeline, releases, rollback |
| [Troubleshooting](TROUBLESHOOTING.md) | Known problems and fixes |
| [Contributing](CONTRIBUTING.md) | Test strategy, linting, code conventions, commit format |
| [AI usage](AI-USAGE.md) | Claude Code setup, the skills in this repo, vendoring and updating them |

## The 30-second version

```
mic ──► AudioWorklet (frame-stamped PCM) ──► cut to exact bars ──► looping AudioBuffer ──► speaker
camera ──► MediaRecorder ──► clip ──► <video> per panel, corrected every frame to the heard time
                     AudioContext clock ──► metronome · count-in tone · loop phase
                     IndexedDB ◄──► project + takes          canvas + audio ──► exported video
```

- Set tempo and meter, pick devices, and press **Record** on a panel.
- The count-in clicks and holds a reference note; recording runs exactly the panel's bars.
- The loop plays at once, locked to the grid by the bar it was recorded on.
- Up to 16 panels of 1–32 bars loop together. Tempo locks while loops exist.
- Loops survive reloads, and one loop or all of them export to a video file.

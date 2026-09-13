<div align="center">

# 🔁 Live Looping

**Record video loops that play in time: count in, capture, stack up to sixteen.**

[![CI](https://github.com/yusif-projects/live-looping/actions/workflows/ci.yml/badge.svg)](https://github.com/yusif-projects/live-looping/actions/workflows/ci.yml)
[![Deploy](https://github.com/yusif-projects/live-looping/actions/workflows/deploy.yml/badge.svg)](https://github.com/yusif-projects/live-looping/actions/workflows/deploy.yml)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
[![License](https://img.shields.io/badge/License-Apache_2.0-green)](LICENSE)

</div>

---

Live Looping is a video looper for musicians.
- Set a tempo, pick a camera, mic and speaker, and record clips into panels.
- Each panel loops for its own number of bars (1 to 32), all locked to the same grid.
- Before each take a count-in clicks and holds a reference note so you can tune. It counts down
  to the next bar where the new loop lines up with the loops already playing.
- Empty panels preview the camera, and the mic can be monitored live, with a level meter.
- Loops are saved in the browser, and any one of them, or all of them as a grid, exports to a
  video file.

Everything runs in the browser. Chrome or Edge gives the full feature set.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5180.

```bash
npm test        # pure-logic tests
npm run build   # typecheck + production build
npm run lint    # oxlint
```

## How it works

```
mic ──► AudioWorklet (frame-stamped PCM) ──► cut to exact bars ──► looping AudioBuffer ──► speaker
camera ──► MediaRecorder ──► clip ──► <video> per panel, corrected every frame to the heard time
                     AudioContext clock ──► metronome · count-in tone · loop phase
                     IndexedDB ◄──► project + takes          canvas + audio ──► exported video
```

Details in [architecture](docs/ARCHITECTURE.md).

## Documentation

| | |
| --- | --- |
| [Getting started](docs/GETTING-STARTED.md) | Install, run, build, test, project layout |
| [User guide](docs/USER-GUIDE.md) | Using the app |
| [Architecture](docs/ARCHITECTURE.md) | Module map, data flow, design decisions |
| [Configuration](docs/CONFIGURATION.md) | Settings, persistence, env vars, tooling config |
| [Deployment](docs/DEPLOYMENT.md) | Pages pipeline, releases, rollback |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Known problems and fixes |
| [Contributing](docs/CONTRIBUTING.md) | Tests, conventions, commit format |
| [AI usage](docs/AI-USAGE.md) | Claude Code setup, the skills in this repo, vendoring and updating them |

## Credits

Built by **Yusif Aliyev** —
[LinkedIn](https://www.linkedin.com/in/yusif-programmer/) ·
[**Joe in the Studio**](https://www.joeinthestudio.com), my music project.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

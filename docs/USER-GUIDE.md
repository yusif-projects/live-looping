# User guide

Live Looping records short video clips with sound that loop in time with each other. You set a
tempo, and each panel loops for its own number of bars. Everything stays in your browser.

## First run

Put on headphones, then press **Enable camera & microphone** and allow access when the browser
asks. You'll see one empty panel. The mic records without echo cancellation, so anything
coming out of speakers ends up in your loops.

Your loops and settings are saved in this browser and come back the next time you open the page.

## Recording a loop

1. Set the **Tempo** and **Meter** first. They lock once a loop exists.
2. Pick the panel's length in bars, and a reference **Tone** if you want one.
3. Press **Record**.
4. The count-in clicks for the chosen number of bars while the reference note plays. The big
   number counts down the beats.
5. The tone stops just before the downbeat, and recording runs for exactly the panel's length.
6. The loop starts playing right away, in time, and is saved.

If the transport is already playing, the count-in waits for the next bar. Press **Cancel** during
the count-in or recording to stop the take. A loop you were re-recording comes back.

## Controls

| Control | What it does |
| --- | --- |
| **Play / Stop** (or Space) | Starts and stops every loop together, from bar 1 |
| Bar readout (e.g. 3 / 8) | Which bar of the loop cycle is playing. It counts through the longest recorded loop and wraps back to 1; with nothing recorded, it follows the panels' lengths. |
| **Tempo** | Beats per minute; type a value or use − and + |
| **Meter** | Beats per bar |
| **Click** On/Off and slider | Metronome while playing, and its volume. The count-in always clicks. |
| **Count-in** | How many bars count in before recording |
| **Tone** and slider | The note held through the count-in, and its volume |
| **Export all** | Saves one video of every loop in a grid |
| **Clear all** | Deletes every loop and unlocks tempo and meter |
| **Camera / Microphone / Speaker** | Which device to use. The speaker picker only appears in browsers that support it. |
| **Sync** | Calibration sliders; see below |
| Panel length | The panel's loop length in bars; clear the loop to change it |
| Panel **Tone** | A different reference note for this panel only |
| **Record / Re-record / Cancel** | Starts or cancels a take on this panel |
| **Mute** and slider | Silences the loop (its video dims), and sets its volume |
| **Export** | Saves this loop as a video |
| **Clear** | Deletes this loop |
| **Remove** | Deletes the panel |
| **Add loop** | Adds a panel, up to 16 |

## Exporting

**Export** on a panel saves that loop, and **Export all** saves every loop side by side.

- The export records in real time for one full cycle of the longest loop, so a 16-bar loop at
  120 BPM takes 32 seconds.
- Keep the tab in front while it runs.
- The file begins with a fraction of a second of black before the first bar.
- Muted loops appear in the picture but are silent.
- The file is MP4 where the browser can record it, otherwise WebM.

## Settings

- **Audio latency**: if claps on the click sound late in your loops, move this to the right. It
  applies to the next take you record.
- **Video offset**: if the picture is ahead of or behind the sound, move this until they match.
  It changes every loop at once.
- **Tone**: pick **Off** for no reference note. A panel's own tone setting overrides it.
- Device choices are remembered. If a remembered device is unplugged, the system default is used.

Defaults and ranges are listed in [configuration](CONFIGURATION.md#settings).

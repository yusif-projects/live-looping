# User guide

Live Looping records short video clips with sound that loop in time with each other. You set a
tempo, and each panel loops for its own number of bars. Everything stays in your browser.

## First run

Put on headphones, then press **Enable camera & microphone** and allow access when the browser
asks. You'll see one empty panel showing your camera. The mic records without echo
cancellation, so anything coming out of speakers ends up in your loops. Turn **Monitor** on to
hear the mic in your headphones while you play.

Your loops and settings are saved in this browser and come back the next time you open the page.

## Recording a loop

1. Set the **Tempo** and **Meter** first. They lock once a loop exists.
2. Pick the panel's length in bars, and a reference **Tone** if you want one. An empty panel
   shows your camera, so you can frame the shot before recording.
3. Press **Record**.
4. The count-in clicks while the reference note plays. The panel shows **Recording in 2 bars**
   with a dot for each beat, then counts down **4 3 2 1** in the last bar.
5. The tone stops just before the downbeat, and recording runs for exactly the panel's length.
6. The loop starts playing right away, in time, and is saved.

**Where a take starts.** A new loop starts where it lines up with the loops already recorded,
counted from where the longest one begins, so a short loop never waits for a long one to finish:
- Over a 4-bar loop, a 2-bar loop can start on bar 1 or bar 3 of it, and a 1-bar loop on any bar.
- A loop longer than the others, such as 8 bars over a 4-bar loop, starts on bar 1 of their cycle.
- The count-in always lasts at least one full bar. If the next start point is closer than that,
  the take waits for the one after.
- With no other loop recorded, the count-in lasts the **Count-in** setting's bars instead.

Press **Cancel** during the count-in or recording to stop the take. A loop you were re-recording
comes back.

## Controls

| Control | What it does |
| --- | --- |
| **Play / Stop** (or Space) | Starts and stops every loop together, from bar 1 |
| Bar readout (e.g. 3 / 8) | Which bar of the loop cycle is playing. It counts through the longest recorded loop and wraps back to 1; with nothing recorded, it follows the panels' lengths. |
| **Tempo** | Beats per minute; type a value or use − and + |
| **Meter** | Beats per bar |
| **Click** On/Off and slider | Metronome while playing, and its volume. The count-in always clicks. |
| **Count-in** | How many bars count in before the first loop. Later takes count in until they line up with the loops already recorded. |
| **Tone** and slider | The note held through the count-in, and its volume |
| **Export all** | Saves one video of every loop in a grid |
| **Clear all** | Deletes every loop and unlocks tempo and meter |
| **Camera / Microphone / Speaker** | Which device to use. The speaker picker only appears in browsers that support it. |
| Level bar in the **Microphone** picker | How loud the mic is right now; it turns red close to clipping |
| **Monitor** On/Off and slider | Plays the mic to your headphones live, and its volume. Off by default. Browsers add a small delay to what you hear. |
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

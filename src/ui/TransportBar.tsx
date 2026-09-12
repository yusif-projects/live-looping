import { useState } from 'react'
import { REFERENCE_NOTES, noteName } from '../audio/notes'
import { MAX_BEATS_PER_BAR, MIN_BEATS_PER_BAR } from '../audio/transport'
import type { Settings } from '../state/settings'
import { MAX_COUNT_IN_BARS, MIN_COUNT_IN_BARS } from '../state/settings'

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const BEAT_OPTIONS = range(MIN_BEATS_PER_BAR, MAX_BEATS_PER_BAR)
const COUNT_IN_OPTIONS = range(MIN_COUNT_IN_BARS, MAX_COUNT_IN_BARS)

interface TransportBarProps {
  readonly running: boolean
  readonly disabled: boolean
  readonly tempo: number
  readonly beatsPerBar: number
  readonly meterLocked: boolean
  readonly settings: Settings
  readonly hasLoops: boolean
  onTogglePlay(): void
  onTempo(tempo: number): void
  onBeatsPerBar(beats: number): void
  onSettings(patch: Partial<Settings>): void
  onExportAll(): void
  onClearAll(): void
  /** Receives the bar-in-cycle readout, which the frame loop writes to directly rather than re-rendering. */
  registerBeatDisplay(el: HTMLElement | null): void
}

function TempoField({ tempo, locked, onTempo }: { tempo: number; locked: boolean; onTempo(tempo: number): void }) {
  // Null except while typing, so the field shows the live tempo without copying it into state.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onTempo(Number(draft))
    setDraft(null)
  }

  return (
    <div className="field">
      <span className="field-label">Tempo</span>
      <div className="stepper">
        <button className="step" onClick={() => onTempo(tempo - 1)} disabled={locked} aria-label="Slower">
          −
        </button>
        <input
          className="tempo-input"
          inputMode="numeric"
          aria-label="Tempo in beats per minute"
          value={draft ?? String(tempo)}
          disabled={locked}
          onFocus={() => setDraft(String(tempo))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <button className="step" onClick={() => onTempo(tempo + 1)} disabled={locked} aria-label="Faster">
          +
        </button>
      </div>
    </div>
  )
}

export function TransportBar({
  running,
  disabled,
  tempo,
  beatsPerBar,
  meterLocked,
  settings,
  hasLoops,
  onTogglePlay,
  onTempo,
  onBeatsPerBar,
  onSettings,
  onExportAll,
  onClearAll,
  registerBeatDisplay,
}: TransportBarProps) {
  return (
    <section className="transport" aria-label="Transport">
      <div className="transport-group">
        <button
          className="button button-primary play-button"
          onClick={onTogglePlay}
          disabled={disabled}
          aria-pressed={running}
        >
          <span className={running ? 'glyph glyph-stop' : 'glyph glyph-play'} aria-hidden="true" />
          {running ? 'Stop' : 'Play'}
        </button>
        <output className="position" ref={registerBeatDisplay} aria-label="Bar in loop cycle" />
      </div>

      <div className="transport-group">
        <TempoField tempo={tempo} locked={meterLocked || disabled} onTempo={onTempo} />
        <label className="field">
          <span className="field-label">Meter</span>
          <select
            value={beatsPerBar}
            disabled={meterLocked || disabled}
            onChange={(e) => onBeatsPerBar(Number(e.target.value))}
          >
            {BEAT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}/4
              </option>
            ))}
          </select>
        </label>
        {meterLocked && <span className="lock-note">Locked while loops exist</span>}
      </div>

      <div className="transport-group">
        <div className="field">
          <span className="field-label">Click</span>
          <div className="inline">
            <button
              className="toggle"
              aria-pressed={settings.metronomeOn}
              onClick={() => onSettings({ metronomeOn: !settings.metronomeOn })}
            >
              {settings.metronomeOn ? 'On' : 'Off'}
            </button>
            <input
              type="range"
              className="volume"
              aria-label="Metronome volume"
              min={0}
              max={1}
              step={0.01}
              value={settings.metronomeVolume}
              onChange={(e) => onSettings({ metronomeVolume: Number(e.target.value) })}
            />
          </div>
        </div>
        <label className="field">
          <span className="field-label">Count-in</span>
          <select value={settings.countInBars} onChange={(e) => onSettings({ countInBars: Number(e.target.value) })}>
            {COUNT_IN_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'bar' : 'bars'}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">Tone</span>
          <div className="inline">
            <select
              aria-label="Reference note"
              value={settings.referenceNote ?? ''}
              onChange={(e) => onSettings({ referenceNote: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Off</option>
              {REFERENCE_NOTES.map((n) => (
                <option key={n} value={n}>
                  {noteName(n)}
                </option>
              ))}
            </select>
            <input
              type="range"
              className="volume"
              aria-label="Reference tone volume"
              min={0}
              max={1}
              step={0.01}
              value={settings.referenceVolume}
              disabled={settings.referenceNote === null}
              onChange={(e) => onSettings({ referenceVolume: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="transport-group transport-actions">
        <button className="button" onClick={onExportAll} disabled={!hasLoops || disabled}>
          Export all
        </button>
        <button className="button button-quiet" onClick={onClearAll} disabled={!hasLoops || disabled}>
          Clear all
        </button>
      </div>
    </section>
  )
}

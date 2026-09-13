import { useEffect, useRef } from 'react'
import { REFERENCE_NOTES, noteName } from '../audio/notes'
import type { BarCount, Panel, TakeStage } from '../state/panels'
import { BAR_COUNTS } from '../state/panels'
import type { PanelHandlers } from '../useLooper'

const STAGE_LABEL: Record<TakeStage, string> = {
  countIn: 'Count-in',
  recording: 'Recording',
  processing: 'Saving',
}

const barsLabel = (bars: number): string => `${bars} ${bars === 1 ? 'bar' : 'bars'}`

interface LoopPanelProps {
  readonly panel: Panel
  readonly number: number
  readonly videoUrl: string | null
  /** The camera, shown while this panel is empty or recording. */
  readonly liveStream: MediaStream | null
  readonly globalNote: number | null
  /** Beats in a bar: one count-in dot each. */
  readonly beatsPerBar: number
  readonly recordDisabled: boolean
  readonly canRemove: boolean
  /** An export is running, so nothing that changes loops is allowed. */
  readonly locked: boolean
  readonly handlers: PanelHandlers
  registerRoot(panelId: string, el: HTMLElement | null): void
  registerVideo(panelId: string, el: HTMLVideoElement | null): void
}

function LivePreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} className="panel-video mirrored" autoPlay muted playsInline />
}

export function LoopPanel(props: LoopPanelProps) {
  const { panel, handlers, locked } = props
  const busy = panel.stage !== null
  const state = panel.stage ?? (panel.take ? 'looping' : 'empty')
  const recordLabel = panel.stage === 'processing' ? 'Saving…' : busy ? 'Cancel' : panel.take ? 'Re-record' : 'Record'

  // Empty and busy panels render the preview in the same place, so pressing Record keeps the
  // playing element instead of remounting it and flashing black.
  const live = busy || !panel.take ? props.liveStream : null
  let screen
  if (live) {
    screen = <LivePreview stream={live} />
  } else if (busy) {
    screen = <div className="panel-empty">No camera</div>
  } else if (props.videoUrl) {
    screen = (
      <video
        key={props.videoUrl}
        ref={(el) => props.registerVideo(panel.id, el)}
        className="panel-video mirrored"
        src={props.videoUrl}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
    )
  } else {
    screen = <div className="panel-empty">{panel.take ? 'Audio loop' : barsLabel(panel.bars)}</div>
  }

  return (
    <article
      className="panel"
      data-state={state}
      data-muted={panel.muted || undefined}
      ref={(el) => props.registerRoot(panel.id, el)}
      aria-label={`Loop ${props.number}`}
    >
      <div className="panel-screen">
        {screen}
        {panel.stage && <span className="panel-badge">{STAGE_LABEL[panel.stage]}</span>}
        <div className="panel-countdown" hidden={panel.stage !== 'countIn'} aria-live="off">
          <span className="countdown-label" />
          <span className="countdown-beat" />
          <span className="countdown-dots">
            {Array.from({ length: props.beatsPerBar }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </div>
        <div className="panel-progress" aria-hidden="true" />
      </div>

      <div className="panel-controls">
        <div className="panel-row">
          <span className="panel-number">{props.number}</span>
          <select
            aria-label={`Loop ${props.number} length`}
            value={panel.bars}
            disabled={panel.take !== null || busy || locked}
            title={panel.take ? 'Clear the loop to change its length' : undefined}
            onChange={(e) => handlers.onBars(panel.id, Number(e.target.value) as BarCount)}
          >
            {BAR_COUNTS.map((b) => (
              <option key={b} value={b}>
                {barsLabel(b)}
              </option>
            ))}
          </select>
          <select
            aria-label={`Loop ${props.number} reference note`}
            value={panel.noteOverride ?? ''}
            disabled={busy}
            onChange={(e) => handlers.onNote(panel.id, e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">{props.globalNote === null ? 'Tone: off' : `Tone: ${noteName(props.globalNote)}`}</option>
            {REFERENCE_NOTES.map((n) => (
              <option key={n} value={n}>
                {noteName(n)}
              </option>
            ))}
          </select>
        </div>

        <div className="panel-row">
          <button
            className="button record-button"
            data-armed={busy || undefined}
            onClick={() => handlers.onRecord(panel.id)}
            disabled={props.recordDisabled || panel.stage === 'processing'}
          >
            <span className="record-dot" aria-hidden="true" />
            {recordLabel}
          </button>
          <button className="toggle" aria-pressed={panel.muted} onClick={() => handlers.onMute(panel.id)}>
            Mute
          </button>
          <input
            type="range"
            className="volume panel-volume"
            aria-label={`Loop ${props.number} volume`}
            min={0}
            max={1}
            step={0.01}
            value={panel.volume}
            onChange={(e) => handlers.onVolume(panel.id, Number(e.target.value))}
          />
        </div>

        <div className="panel-row panel-row-quiet">
          <button className="text-button" onClick={() => handlers.onExport(panel.id)} disabled={!panel.take || busy || locked}>
            Export
          </button>
          <button className="text-button" onClick={() => handlers.onClear(panel.id)} disabled={!panel.take || busy || locked}>
            Clear
          </button>
          <button className="text-button danger" onClick={() => handlers.onRemove(panel.id)} disabled={!props.canRemove}>
            Remove
          </button>
        </div>
      </div>
    </article>
  )
}

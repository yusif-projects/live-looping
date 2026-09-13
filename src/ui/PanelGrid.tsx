import type { Panel } from '../state/panels'
import { MAX_PANELS } from '../state/panels'
import type { PanelHandlers } from '../useLooper'
import { LoopPanel } from './LoopPanel'

interface PanelGridProps {
  readonly panels: readonly Panel[]
  readonly videoUrls: ReadonlyMap<string, string>
  readonly cameraStream: MediaStream | null
  readonly globalNote: number | null
  readonly beatsPerBar: number
  readonly busyPanelId: string | null
  readonly exporting: boolean
  readonly canAdd: boolean
  readonly handlers: PanelHandlers
  onAdd(): void
  registerRoot(panelId: string, el: HTMLElement | null): void
  registerVideo(panelId: string, el: HTMLVideoElement | null): void
}

export function PanelGrid(props: PanelGridProps) {
  const { panels, busyPanelId, exporting } = props
  return (
    <section className="grid" aria-label="Loops">
      {panels.map((panel, i) => (
        <LoopPanel
          key={panel.id}
          panel={panel}
          number={i + 1}
          videoUrl={props.videoUrls.get(panel.id) ?? null}
          liveStream={panel.stage || !panel.take ? props.cameraStream : null}
          globalNote={props.globalNote}
          beatsPerBar={props.beatsPerBar}
          recordDisabled={exporting || (busyPanelId !== null && busyPanelId !== panel.id)}
          canRemove={panels.length > 1 && panel.stage === null && !exporting}
          locked={exporting}
          handlers={props.handlers}
          registerRoot={props.registerRoot}
          registerVideo={props.registerVideo}
        />
      ))}
      {props.canAdd && (
        <button className="add-panel" onClick={props.onAdd} disabled={exporting}>
          <span className="add-panel-plus" aria-hidden="true">
            +
          </span>
          Add loop
          <span className="add-panel-count">
            {panels.length} of {MAX_PANELS}
          </span>
        </button>
      )}
    </section>
  )
}

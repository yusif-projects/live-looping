import { useEffect, useMemo } from 'react'
import { DeviceBar } from './ui/DeviceBar'
import { ExportDialog } from './ui/ExportDialog'
import { PanelGrid } from './ui/PanelGrid'
import { StartGate } from './ui/StartGate'
import { TransportBar } from './ui/TransportBar'
import type { PanelHandlers } from './useLooper'
import { useLooper } from './useLooper'

export default function App() {
  const looper = useLooper()
  const { phase, togglePlay, panelHandlers, panels, clearAll } = looper

  useEffect(() => {
    if (phase !== 'ready') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      // Space already types, toggles or nudges whichever control has focus.
      if ((event.target as Element | null)?.closest('input, select, textarea, button, summary')) return
      event.preventDefault()
      togglePlay()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, togglePlay])

  // Destructive actions ask first. The hook stays free of dialogs.
  const handlers = useMemo<PanelHandlers>(
    () => ({
      ...panelHandlers,
      onClear: (id) => {
        if (window.confirm('Clear this loop? Its recording is deleted.')) panelHandlers.onClear(id)
      },
      onRemove: (id) => {
        const panel = panels.find((p) => p.id === id)
        if (!panel?.take || window.confirm('Remove this panel and delete its loop?')) panelHandlers.onRemove(id)
      },
    }),
    [panelHandlers, panels],
  )

  if (phase !== 'ready') {
    return <StartGate starting={phase === 'starting'} error={looper.gateError} onEnable={() => void looper.enable()} />
  }

  const exporting = looper.exportState !== null

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Live Looping
        </h1>
        <DeviceBar
          devices={looper.devices}
          settings={looper.settings}
          speakerSupported={looper.speakerSupported}
          disabled={exporting || looper.busyPanelId !== null}
          onSettings={looper.updateSettings}
          registerLevel={looper.registerLevel}
        />
      </header>

      <TransportBar
        running={looper.running}
        disabled={exporting}
        tempo={looper.tempo}
        beatsPerBar={looper.beatsPerBar}
        meterLocked={looper.meterLocked}
        settings={looper.settings}
        hasLoops={looper.hasLoops}
        onTogglePlay={togglePlay}
        onTempo={looper.setTempo}
        onBeatsPerBar={looper.setBeatsPerBar}
        onSettings={looper.updateSettings}
        onExportAll={looper.exportAll}
        onClearAll={() => {
          if (window.confirm('Clear every loop? All recordings are deleted.')) clearAll()
        }}
        registerBeatDisplay={looper.registerBeatDisplay}
      />

      {looper.notice && (
        <div className="notice" role="status">
          <span>{looper.notice}</span>
          <button className="text-button" onClick={looper.dismissNotice}>
            Dismiss
          </button>
        </div>
      )}

      <main>
        <PanelGrid
          panels={panels}
          videoUrls={looper.videoUrls}
          cameraStream={looper.cameraStream}
          globalNote={looper.settings.referenceNote}
          beatsPerBar={looper.beatsPerBar}
          busyPanelId={looper.busyPanelId}
          exporting={exporting}
          canAdd={looper.canAddPanel}
          handlers={handlers}
          onAdd={looper.addPanel}
          registerRoot={looper.registerPanel}
          registerVideo={looper.registerVideo}
        />
      </main>

      {looper.exportState && (
        <ExportDialog
          label={looper.exportState.label}
          progress={looper.exportState.progress}
          onCancel={looper.cancelExport}
        />
      )}
    </div>
  )
}

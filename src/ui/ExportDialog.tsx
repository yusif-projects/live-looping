interface ExportDialogProps {
  readonly label: string
  readonly progress: number
  onCancel(): void
}

export function ExportDialog({ label, progress, onCancel }: ExportDialogProps) {
  const percent = Math.round(progress * 100)
  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <h2 id="export-title" className="dialog-title">
          {label}
        </h2>
        <p className="dialog-copy">
          Export records in real time, one full cycle of the longest loop. Keep this tab in front until it finishes.
        </p>
        <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="meter-fill" style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
        <div className="dialog-actions">
          <span className="dialog-percent">{percent}%</span>
          <button className="button" onClick={onCancel} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

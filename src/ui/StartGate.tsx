interface StartGateProps {
  readonly starting: boolean
  readonly error: string | null
  onEnable(): void
}

export function StartGate({ starting, error, onEnable }: StartGateProps) {
  return (
    <main className="gate">
      <div className="gate-card">
        <p className="eyebrow">Live Looping</p>
        <h1 className="gate-title">Record video loops that play in time.</h1>
        <p className="gate-copy">
          Set a tempo, count in on a reference note, and stack up to sixteen loops of different lengths. Everything
          stays in this browser.
        </p>
        <button className="button button-primary button-large" onClick={onEnable} disabled={starting}>
          {starting ? 'Starting…' : 'Enable camera & microphone'}
        </button>
        {error && (
          <p className="gate-error" role="alert">
            {error}
          </p>
        )}
        <p className="gate-hint">
          Wear headphones. The mic records without echo cancellation, so sound from speakers bleeds into your loops.
        </p>
      </div>
    </main>
  )
}

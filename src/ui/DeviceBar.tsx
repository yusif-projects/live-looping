import type { ReactNode } from 'react'
import type { DeviceLists } from '../media/devices'
import type { Settings } from '../state/settings'
import { LATENCY_OFFSET_RANGE_MS, VIDEO_OFFSET_RANGE_MS } from '../state/settings'

// Chromium lists these as extra entries that alias whichever real device is the system
// default. "System default" already covers them.
const ALIAS_IDS = new Set(['default', 'communications'])

interface DeviceBarProps {
  readonly devices: DeviceLists
  readonly settings: Settings
  readonly speakerSupported: boolean
  readonly disabled: boolean
  onSettings(patch: Partial<Settings>): void
  /** Receives the input level bar, which the frame loop writes to directly rather than re-rendering. */
  registerLevel(el: HTMLElement | null): void
}

interface DeviceSelectProps {
  readonly label: string
  readonly devices: readonly MediaDeviceInfo[]
  readonly value: string | null
  readonly disabled: boolean
  /** Drawn over the select, such as the microphone's level bar. */
  readonly children?: ReactNode
  onChange(deviceId: string | null): void
}

function DeviceSelect({ label, devices, value, disabled, children, onChange }: DeviceSelectProps) {
  const options = devices.filter((d) => !ALIAS_IDS.has(d.deviceId))
  // A remembered device that's unplugged shows as the default, which is what is actually in use.
  const selected = options.some((d) => d.deviceId === value) ? (value ?? '') : ''
  return (
    <label className="field device-field">
      <span className="field-label">{label}</span>
      <select value={selected} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">System default</option>
        {options.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
      {children}
    </label>
  )
}

export function DeviceBar({ devices, settings, speakerSupported, disabled, onSettings, registerLevel }: DeviceBarProps) {
  return (
    <section className="devices" aria-label="Devices">
      <DeviceSelect
        label="Camera"
        devices={devices.cameras}
        value={settings.cameraId}
        disabled={disabled}
        onChange={(cameraId) => onSettings({ cameraId })}
      />
      <DeviceSelect
        label="Microphone"
        devices={devices.mics}
        value={settings.micId}
        disabled={disabled}
        onChange={(micId) => onSettings({ micId })}
      >
        <span className="input-level" ref={registerLevel} aria-hidden="true" />
      </DeviceSelect>
      {/* Not locked with the devices: the middle of a take is exactly when monitoring needs adjusting. */}
      <div className="field" title="Hear the microphone as you play. Use headphones: speakers feed back into the mic.">
        <span className="field-label">Monitor</span>
        <div className="inline">
          <button
            className="toggle"
            aria-pressed={settings.monitorOn}
            onClick={() => onSettings({ monitorOn: !settings.monitorOn })}
          >
            {settings.monitorOn ? 'On' : 'Off'}
          </button>
          <input
            type="range"
            className="volume"
            aria-label="Monitor volume"
            min={0}
            max={1}
            step={0.01}
            value={settings.monitorVolume}
            disabled={!settings.monitorOn}
            onChange={(e) => onSettings({ monitorVolume: Number(e.target.value) })}
          />
        </div>
      </div>
      {speakerSupported && (
        <DeviceSelect
          label="Speaker"
          devices={devices.speakers}
          value={settings.speakerId}
          disabled={disabled}
          onChange={(speakerId) => onSettings({ speakerId })}
        />
      )}
      <details className="sync">
        <summary>Sync</summary>
        <div className="sync-body">
          <label className="field">
            <span className="field-label">
              Audio latency <output>{settings.latencyOffsetMs} ms</output>
            </span>
            <input
              type="range"
              min={-LATENCY_OFFSET_RANGE_MS}
              max={LATENCY_OFFSET_RANGE_MS}
              step={1}
              value={settings.latencyOffsetMs}
              onChange={(e) => onSettings({ latencyOffsetMs: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Video offset <output>{settings.videoOffsetMs} ms</output>
            </span>
            <input
              type="range"
              min={-VIDEO_OFFSET_RANGE_MS}
              max={VIDEO_OFFSET_RANGE_MS}
              step={1}
              value={settings.videoOffsetMs}
              onChange={(e) => onSettings({ videoOffsetMs: Number(e.target.value) })}
            />
          </label>
          <p className="hint">
            If new loops land late against the click, raise audio latency. It applies to the next take. Video offset
            moves picture against sound for every loop at once.
          </p>
        </div>
      </details>
    </section>
  )
}

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { ArchiveRestore, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { backupToState, stateToBackup } from '../backup'
import { csvToHistory, historyToCsv } from '../csv'
import { lbToInputWeight, maximumInputWeight, parseWeightInput } from '../lifting'
import { requestPersistentStorage } from '../db'
import { shareOrDownload } from '../share'
import type { AppState, WorkoutSession } from '../types'

export default function SettingsView({ state, onChange, onImported, onRestored, onReset }: { state: AppState; onChange: Dispatch<SetStateAction<AppState | null>>; onImported: (history: WorkoutSession[]) => void; onRestored: (state: AppState) => void; onReset: () => Promise<void> }) {
  const maxInputWeight = maximumInputWeight(state.settings.unit)
  const plateDisplay = () => state.settings.platesLb.map((plate) => Number((state.settings.unit === 'kg' ? plate * 0.45359237 : plate).toFixed(3))).join(', ')
  const [csvMessage, setCsvMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [storageStatus, setStorageStatus] = useState<string | null>(null)
  const [plateText, setPlateText] = useState(plateDisplay)
  const [platesDirty, setPlatesDirty] = useState(false)
  useEffect(() => { setPlateText(plateDisplay()); setPlatesDirty(false) }, [state.settings.unit, state.settings.platesLb])
  const patchSettings = (patch: Partial<AppState['settings']>) => onChange((current) => current ? { ...current, settings: { ...current.settings, ...patch } } : current)
  const commitPlates = () => {
    if (!platesDirty) return
    const values = plateText.split(',').map((value) => parseWeightInput(value, state.settings.unit)).filter((value): value is number => value != null && value > 0)
    patchSettings({ platesLb: [...new Set(values)].sort((a, b) => b - a).slice(0, 32) })
    setPlatesDirty(false)
  }
  const exportBackup = async () => {
    const fileName = `lift-full-backup-${new Date().toISOString().slice(0, 10)}.json`
    try {
      await shareOrDownload(new File([stateToBackup(state)], fileName, { type: 'application/json' }), 'Lift full app backup')
      setBackupMessage('Full backup saved. Keep it in Files or iCloud Drive.')
    } catch (error) { if ((error as DOMException).name !== 'AbortError') setBackupMessage('The full backup could not be saved.') }
  }
  const importBackup = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 25_000_000) { setBackupMessage('This backup is too large to import.'); return }
    try {
      const restored = backupToState(await file.text())
      if (!window.confirm('Replace all current Lift data with this backup?')) return
      onRestored(restored)
      setBackupMessage('Full app data restored.')
    } catch (error) { setBackupMessage(error instanceof Error ? error.message : 'Could not restore this backup.') }
  }
  const exportCsv = async () => {
    const fileName = `lift-history-${new Date().toISOString().slice(0, 10)}.csv`
    try {
      await shareOrDownload(new File([historyToCsv(state.history)], fileName, { type: 'text/csv;charset=utf-8' }), 'Lift workout history')
      setCsvMessage(`Exported ${state.history.length} workout${state.history.length === 1 ? '' : 's'}.`)
    } catch (error) { if ((error as DOMException).name !== 'AbortError') setCsvMessage('The CSV export could not be completed.') }
  }
  const importCsv = async (file: File | undefined) => {
    if (!file) return
    try { const imported = csvToHistory(await file.text()); onImported(imported); setCsvMessage(`Imported ${imported.length} workout${imported.length === 1 ? '' : 's'}. Existing duplicates were updated.`) }
    catch (error) { setCsvMessage(error instanceof Error ? error.message : 'Could not import this CSV.') }
  }
  const updateNumericSetting = (key: 'bodyweightLb' | 'barWeightLb', text: string) => { const value = parseWeightInput(text, state.settings.unit); if (value != null) patchSettings({ [key]: value }) }
  const requestStorage = async () => {
    patchSettings({ persistentStorageRequested: true })
    try {
      const result = await requestPersistentStorage()
      setStorageStatus(result === true ? 'Persistent local storage enabled.' : result === false ? 'iOS kept standard storage protection. Keep a full backup in Files.' : 'This browser does not expose persistent-storage controls.')
    } catch {
      setStorageStatus('Persistent storage could not be requested. Keep a full backup in Files.')
    }
  }

  return <section className="page" aria-labelledby="settings-heading"><div className="eyebrow">LOCAL APP</div><h1 id="settings-heading">Settings</h1>
    <article className="settings-card"><h2>Training</h2><label className="settings-row"><span>Units<small>Stored internally in pounds</small></span><select value={state.settings.unit} onChange={(event) => patchSettings({ unit: event.target.value as 'lb' | 'kg' })}><option value="lb">Pounds</option><option value="kg">Kilograms</option></select></label><label className="settings-row"><span>Bodyweight</span><div className="inline-input"><input type="number" inputMode="decimal" min="0" max={maxInputWeight} value={lbToInputWeight(state.settings.bodyweightLb, state.settings.unit)} onChange={(event) => updateNumericSetting('bodyweightLb', event.target.value)} /><b>{state.settings.unit}</b></div></label><label className="settings-row"><span>Bar weight</span><div className="inline-input"><input type="number" inputMode="decimal" min="0" max={maxInputWeight} value={lbToInputWeight(state.settings.barWeightLb, state.settings.unit)} onChange={(event) => updateNumericSetting('barWeightLb', event.target.value)} /><b>{state.settings.unit}</b></div></label><label className="settings-row plate-setting"><span>Available plates<small>Comma-separated, per side</small></span><input aria-label="Available plates" value={plateText} onChange={(event) => { setPlateText(event.target.value); setPlatesDirty(true) }} onBlur={commitPlates} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label><label className="settings-row toggle-row"><span>Start rest timer automatically</span><input type="checkbox" checked={state.settings.autoStartRest} onChange={(event) => patchSettings({ autoStartRest: event.target.checked })} /></label></article>
    <article className="settings-card backup-card"><div className="settings-title"><ArchiveRestore /><div><h2>Full app backup</h2><small>Recommended before reinstalling</small></div></div><p>Saves everything: history, in-progress workout, programs, progression, weights, plates, units, and settings.</p><button className="primary-button" onClick={() => void exportBackup()}><Download /> Save full backup</button><label className="secondary-button file-button"><Upload /> Restore full backup<input type="file" accept=".json,application/json" onChange={(event) => { void importBackup(event.target.files?.[0]); event.target.value = '' }} /></label>{backupMessage && <p className="status-message" role="status">{backupMessage}</p>}<p className="backup-note">The backup is a readable local file. Store it somewhere private.</p></article>
    <article className="settings-card"><div className="settings-title"><FileSpreadsheet /><div><h2>Workout CSV</h2><small>History only</small></div></div><p>CSV is for workout and set history that you can open in a spreadsheet. It does not contain app settings or programs.</p><button className="secondary-button" onClick={exportCsv}>Export history CSV</button><label className="secondary-button file-button">Import history CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { void importCsv(event.target.files?.[0]); event.target.value = '' }} /></label>{csvMessage && <p className="status-message" role="status">{csvMessage}</p>}</article>
    <article className="settings-card"><h2>iPhone storage</h2><p>Install from Safari using Share → Add to Home Screen. The app and workouts remain available offline.</p><button className="secondary-button" onClick={() => void requestStorage()}>Request persistent storage</button>{storageStatus && <p className="status-message" role="status">{storageStatus}</p>}</article>
    <article className="settings-card danger-zone"><h2>Reset</h2><p>Deletes all workouts and restores your original starting weights.</p><button className="danger-button" onClick={() => { if (window.confirm('Delete all local Lift data? Save a full backup first if you may want it later.')) void onReset() }}>Erase all local data</button></article><p className="version">Lift 2.3 · No account · No analytics</p>
  </section>
}

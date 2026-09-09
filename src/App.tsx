import { useEffect, useRef, useState, type ReactElement } from 'react'
import { BarChart3, ClipboardList, Dumbbell, History, Home, Settings as SettingsIcon, ShieldCheck } from 'lucide-react'
import { stateToBackup } from './backup'
import BrandMark from './components/BrandMark'
import ErrorBoundary from './components/ErrorBoundary'
import { clearStoredState, loadState, persistActiveDraft, requestPersistentStorage, saveState } from './db'
import { applyProgression } from './progression'
import { advanceRuntime, createInitialState, createProgramRuntime, createWorkout, getProgram } from './program'
import { shareOrDownload } from './share'
import type { AppState, Tab, WorkoutSession } from './types'
import HistoryView from './views/HistoryView'
import CompletionView from './views/CompletionView'
import PlanView from './views/PlanView'
import ProgressView from './views/ProgressView'
import SettingsView from './views/SettingsView'
import TodayView from './views/TodayView'
import WorkoutView from './views/WorkoutView'

function mergeImportedHistory(existing: WorkoutSession[], imported: WorkoutSession[]): WorkoutSession[] {
  const sessions = new Map(existing.map((session) => [session.id, session]))
  imported.forEach((session) => sessions.set(session.id, session))
  return Array.from(sessions.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

function completeActiveWorkout(state: AppState, completedAt = new Date()): AppState {
  if (!state.activeSession) return state
  const completed = { ...state.activeSession, completedAt: completedAt.toISOString() }
  const program = getProgram(state, completed.programId)
  const runtime = state.programStates[program.id] ?? createProgramRuntime(program)
  const adjustedProgress = structuredClone(runtime.progress)
  for (const exercise of completed.exercises) {
    if (exercise.baseWeightLb == null || !Number.isFinite(exercise.baseWeightLb)) continue
    const saved = adjustedProgress[exercise.progressionKey] ?? { workingWeightLb: exercise.baseWeightLb, consecutiveFailures: 0 }
    adjustedProgress[exercise.progressionKey] = { ...saved, workingWeightLb: exercise.baseWeightLb }
  }
  const progressed = applyProgression(adjustedProgress, completed)
  return { ...state, activeSession: null, restTimerEnd: null, settings: state.settings.persistentStorageRequested ? state.settings : { ...state.settings, persistentStorageRequested: true }, programStates: { ...state.programStates, [program.id]: advanceRuntime(program, runtime, progressed, completed.workoutIndex) }, history: [completed, ...state.history] }
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved')
  const [loadError, setLoadError] = useState(false)
  const [completedSummary, setCompletedSummary] = useState<WorkoutSession | null>(null)
  const [resumedSessionId, setResumedSessionId] = useState<string | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveGeneration = useRef(0)

  const acceptLoadedState = (loaded: AppState) => {
    setState(loaded)
    setResumedSessionId(loaded.activeSession?.id ?? null)
  }

  const reload = () => {
    setLoadError(false)
    loadState().then(acceptLoadedState).catch(() => setLoadError(true))
  }

  useEffect(() => {
    let cancelled = false
    loadState().then((loaded) => { if (!cancelled) acceptLoadedState(loaded) }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!state) return
    persistActiveDraft(state)
    const generation = ++saveGeneration.current
    setSaveStatus('saving')
    const handle = window.setTimeout(() => {
      const operation = saveQueue.current.catch(() => undefined).then(() => saveState(state))
      saveQueue.current = operation
      void operation.then(() => {
        if (saveGeneration.current === generation) {
          setSaveError(null)
          setSaveStatus('saved')
        }
      }).catch(() => {
        if (saveGeneration.current === generation) {
          setSaveError('Could not save on this device.')
          setSaveStatus('error')
        }
      })
    }, 80)
    return () => window.clearTimeout(handle)
  }, [state])

  useEffect(() => {
    if (!state) return
    const flush = () => { persistActiveDraft(state); void saveState(state) }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', onVisibilityChange); window.removeEventListener('pagehide', flush) }
  }, [state])

  if (!state && loadError) return <main className="recovery-screen"><Dumbbell aria-hidden="true" /><h1>Could not open your local data</h1><p>Lift will not overwrite it. Retry first; only start fresh if you intend to erase the saved copy on this device.</p><button className="primary-button" onClick={reload}>Retry</button><button className="secondary-button" onClick={() => { if (window.confirm('Erase the unreadable local data and start fresh?')) void clearStoredState().then(() => { setState(createInitialState()); setLoadError(false) }).catch(() => setLoadError(true)) }}>Erase and start fresh</button></main>
  if (!state) return <main className="loading-screen"><span className="loading-mark"><BrandMark /></span><span>Loading your log…</span></main>

  const startWorkout = (workoutIndex: number) => { setResumedSessionId(null); setState((current) => { if (!current) return current; const next = { ...current, activeSession: createWorkout(current, new Date(), workoutIndex) }; persistActiveDraft(next); return next }) }
  const updateActive = (updater: (session: WorkoutSession) => WorkoutSession) => setState((current) => { if (!current?.activeSession) return current; const next = { ...current, activeSession: updater(current.activeSession) }; persistActiveDraft(next); return next })
  const finishWorkout = () => {
    if (!state.activeSession) return
    const shouldRequestPersistentStorage = !state.settings.persistentStorageRequested
    const nextState = completeActiveWorkout(state)
    persistActiveDraft(nextState)
    setState(nextState)
    setResumedSessionId(null)
    setCompletedSummary(nextState.history[0] ?? null)
    if (shouldRequestPersistentStorage) void requestPersistentStorage().catch(() => null)
    setTab('today')
  }
  const exportFullBackup = async () => {
    const fileName = `lift-full-backup-${new Date().toISOString().slice(0, 10)}.json`
    await shareOrDownload(new File([stateToBackup(state)], fileName, { type: 'application/json' }), 'Lift full app backup')
  }
  const recover = () => {
    setState((current) => { const next = current ? { ...current, activeSession: null, restTimerEnd: null } : createInitialState(); persistActiveDraft(next); return next })
    setResumedSessionId(null)
    setCompletedSummary(null)
    setTab('today')
  }

  return <ErrorBoundary onRecover={recover}>{saveError && <div className="error-banner" role="alert">{saveError}</div>}{completedSummary ? <CompletionView session={completedSummary} unit={state.settings.unit} onDone={() => { setCompletedSummary(null); setTab('today') }} onHistory={() => { setCompletedSummary(null); setTab('history') }} /> : state.activeSession ? <WorkoutView session={state.activeSession} settings={state.settings} restTimerEnd={state.restTimerEnd} saveStatus={saveStatus} resumed={resumedSessionId === state.activeSession.id} onUpdate={updateActive} onStartRest={(seconds) => setState((current) => { if (!current) return current; const next = { ...current, restTimerEnd: new Date(Date.now() + seconds * 1000).toISOString() }; persistActiveDraft(next); return next })} onDismissRest={() => setState((current) => { if (!current) return current; const next = { ...current, restTimerEnd: null }; persistActiveDraft(next); return next })} onBackup={exportFullBackup} onFinish={finishWorkout} onCancel={() => { setResumedSessionId(null); setState((current) => { if (!current) return current; const next = { ...current, activeSession: null, restTimerEnd: null }; persistActiveDraft(next); return next }) }} /> : <div className="app-shell">
    <header className="app-header"><div className="wordmark"><span className="mark"><BrandMark /></span><span>LIFT<small>Training log</small></span></div><span className="local-badge"><ShieldCheck size={14} /> On device</span></header>
    <main className="page-content">
      {tab === 'today' && <TodayView state={state} onStart={startWorkout} />}
      {tab === 'history' && <HistoryView history={state.history} unit={state.settings.unit} />}
      {tab === 'progress' && <ProgressView state={state} />}
      {tab === 'plan' && <PlanView state={state} onChange={setState} onActivated={() => setTab('today')} />}
      {tab === 'settings' && <SettingsView state={state} onChange={setState} onImported={(history) => setState((current) => current ? { ...current, history: mergeImportedHistory(current.history, history) } : current)} onRestored={(restored) => { persistActiveDraft(restored); setResumedSessionId(restored.activeSession?.id ?? null); setCompletedSummary(null); setState(restored) }} onReset={async () => { await clearStoredState(); setState(createInitialState()); setTab('today') }} />}
    </main>
    <nav className="bottom-nav" aria-label="Primary navigation"><NavButton active={tab === 'today'} label="Today" onClick={() => setTab('today')} icon={<Home />} /><NavButton active={tab === 'history'} label="History" onClick={() => setTab('history')} icon={<History />} /><NavButton active={tab === 'progress'} label="Progress" onClick={() => setTab('progress')} icon={<BarChart3 />} /><NavButton active={tab === 'plan'} label="Plan" onClick={() => setTab('plan')} icon={<ClipboardList />} /><NavButton active={tab === 'settings'} label="Settings" onClick={() => setTab('settings')} icon={<SettingsIcon />} /></nav>
  </div>}</ErrorBoundary>
}

function NavButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: ReactElement }) {
  return <button className={active ? 'nav-button active' : 'nav-button'} aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span></button>
}

export { completeActiveWorkout, mergeImportedHistory }

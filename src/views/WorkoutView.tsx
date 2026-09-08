import { useEffect, useRef, useState } from 'react'
import { ChevronDown, CircleCheck, Download, RotateCcw, ShieldCheck, TimerReset } from 'lucide-react'
import { calculatePlates, completedSetCount, displayWeight, lbToInputWeight, MAX_SUPPORTED_WEIGHT_LB, maximumInputWeight, parseWeightInput, roundToIncrement, warmupSets as buildWarmupSets } from '../lifting'
import { EXERCISES } from '../program'
import type { AppState, ExerciseLog, SetLog, WorkoutSession } from '../types'
import { exerciseScheme, formatDuration } from '../ui'

export default function WorkoutView({ session, settings, restTimerEnd, saveStatus, resumed, onUpdate, onStartRest, onDismissRest, onBackup, onFinish, onCancel }: {
  session: WorkoutSession
  settings: AppState['settings']
  restTimerEnd: string | null
  saveStatus: 'saving' | 'saved' | 'error'
  resumed: boolean
  onUpdate: (updater: (session: WorkoutSession) => WorkoutSession) => void
  onStartRest: (seconds: number) => void
  onDismissRest: () => void
  onBackup: () => Promise<void>
  onFinish: () => void
  onCancel: () => void
}) {
  const [backupStatus, setBackupStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const activeExercises = session.exercises.filter((exercise) => !exercise.skipped)
  const completed = session.exercises.reduce((sum, exercise) => sum + completedSetCount(exercise), 0)
  const workingCompleted = activeExercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.complete).length, 0)
  const warmupCompleted = activeExercises.reduce((sum, exercise) => sum + exercise.warmupSets.filter((set) => set.complete).length, 0)
  const workingTotal = activeExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const warmupTotal = activeExercises.reduce((sum, exercise) => sum + exercise.warmupSets.length, 0)
  const total = workingTotal + warmupTotal
  const completionPercent = total ? Math.round(completed / total * 100) : 100
  const nextExerciseIndex = session.exercises.findIndex((exercise) => !exercise.skipped && exercise.sets.some((set) => !set.complete))
  const nextExercise = nextExerciseIndex >= 0 ? session.exercises[nextExerciseIndex] : null
  const nextSet = nextExercise?.sets.find((set) => !set.complete) ?? null
  const updateExercise = (exerciseIndex: number, updater: (exercise: ExerciseLog) => ExerciseLog) => onUpdate((current) => ({ ...current, exercises: current.exercises.map((exercise, index) => index === exerciseIndex ? updater(exercise) : exercise) }))
  const finish = () => { if (completed === total || window.confirm(`Finish with ${total - completed} incomplete sets?`)) onFinish() }
  const cancel = () => { if (window.confirm('Discard this active workout? Your completed history will not be affected.')) onCancel() }
  const backup = async () => {
    setBackupStatus('saving')
    try { await onBackup(); setBackupStatus('saved') }
    catch (error) { setBackupStatus((error as DOMException).name === 'AbortError' ? 'idle' : 'error') }
  }

  return <div className="workout-shell">
    <header className="workout-header"><button className="text-button danger-text" onClick={cancel}>Cancel</button><div><strong>{session.name}</strong><span><ElapsedTimer startedAt={session.startedAt} /> · {completionPercent}% · <i className={`save-state ${saveStatus}`} aria-live="polite">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved'}</i></span></div><button className="text-button accent-text" onClick={finish}>Finish</button></header>
    <div className="session-progress" role="progressbar" aria-label="Workout completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}><span style={{ width: `${completionPercent}%` }} /></div>
    <main className="workout-content">
      <div className="workout-title"><div className="eyebrow">{session.programName} · {session.day}</div><h1>{session.variation ?? session.name}</h1><div className="workout-metrics"><span><b>{workingCompleted}/{workingTotal} work</b> sets</span><span><b>{warmupCompleted}/{warmupTotal} warm-up</b> sets</span></div>{resumed && (nextExercise ? <button className="resume-session" onClick={() => document.getElementById(`exercise-${nextExercise.logId}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })}><RotateCcw /><span><strong>Workout restored</strong><small>Continue {nextExercise.name} · set {nextSet?.number}</small></span><ChevronDown /></button> : <div className="resume-session complete"><CircleCheck /><span><strong>Workout restored</strong><small>All working sets are done—finish when ready.</small></span></div>)}</div>
      {session.exercises.map((exercise, exerciseIndex) => <ExerciseCard key={exercise.logId} index={exerciseIndex + 1} isNext={exerciseIndex === nextExerciseIndex} exercise={exercise} unit={settings.unit} barWeight={settings.barWeightLb} plates={settings.platesLb} onUpdate={(updater) => updateExercise(exerciseIndex, updater)} onSetCompleted={(seconds) => { if (settings.autoStartRest) onStartRest(seconds) }} />)}
      <label className="notes-field"><span>Workout notes</span><textarea value={session.notes} placeholder="How did the session feel?" onChange={(event) => onUpdate((current) => ({ ...current, notes: event.target.value }))} /></label>
      <aside className="workout-backup"><ShieldCheck /><span><strong>Your progress is autosaved</strong><small>Save a full file before reinstalling the app.</small></span><button type="button" disabled={backupStatus === 'saving'} onClick={() => void backup()}><Download />{backupStatus === 'saving' ? 'Saving…' : backupStatus === 'saved' ? 'Saved' : 'Backup'}</button>{backupStatus === 'error' && <p role="alert">Could not save the backup.</p>}</aside>
      <button className="primary-button finish-button" onClick={finish}><CircleCheck /> Finish workout</button>
    </main>
    {restTimerEnd && <RestTimer end={restTimerEnd} onAdd={onStartRest} onDismiss={onDismissRest} />}
  </div>
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)))
  useEffect(() => {
    const interval = window.setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))), 1000)
    return () => window.clearInterval(interval)
  }, [startedAt])
  return <>{formatDuration(elapsed)}</>
}

function ExerciseCard({ index, isNext, exercise, unit, barWeight, plates, onUpdate, onSetCompleted }: {
  index: number
  isNext: boolean
  exercise: ExerciseLog
  unit: 'lb' | 'kg'
  barWeight: number
  plates: number[]
  onUpdate: (updater: (exercise: ExerciseLog) => ExerciseLog) => void
  onSetCompleted: (seconds: number) => void
}) {
  const maxInputWeight = maximumInputWeight(unit)
  const definition = EXERCISES[exercise.exerciseId]
  const loadedWeights = exercise.sets.map((set) => set.weightLb).filter((weight): weight is number => weight != null)
  const topSetWeight = loadedWeights.length ? Math.max(...loadedWeights) : null
  const ramped = new Set(loadedWeights).size > 1
  const plateResult = definition?.barbell && topSetWeight != null ? calculatePlates(topSetWeight, barWeight, plates) : null
  const workingSetsCompleted = exercise.sets.filter((set) => set.complete).length
  const warmupSetsCompleted = exercise.warmupSets.filter((set) => set.complete).length
  const workingSetsComplete = exercise.sets.length > 0 && workingSetsCompleted === exercise.sets.length
  const nextWarmupIndex = exercise.warmupSets.findIndex((set) => !set.complete)
  const nextWorkingIndex = exercise.sets.findIndex((set) => !set.complete)
  const warmupsComplete = exercise.warmupSets.length > 0 && warmupSetsCompleted === exercise.warmupSets.length
  const [expanded, setExpanded] = useState(() => !workingSetsComplete)
  const [warmupsExpanded, setWarmupsExpanded] = useState(false)
  const wasComplete = useRef(workingSetsComplete)
  const wereWarmupsComplete = useRef(warmupsComplete)
  const bodyId = `exercise-body-${exercise.logId}`
  const warmupId = `warmups-${exercise.logId}`

  useEffect(() => {
    if (workingSetsComplete && !wasComplete.current) setExpanded(false)
    if (!workingSetsComplete && wasComplete.current) setExpanded(true)
    wasComplete.current = workingSetsComplete
  }, [workingSetsComplete])

  useEffect(() => {
    if (warmupsComplete && !wereWarmupsComplete.current) setWarmupsExpanded(false)
    wereWarmupsComplete.current = warmupsComplete
  }, [warmupsComplete])

  const updateSet = (setIndex: number, patch: Partial<SetLog>) => onUpdate((current) => ({
    ...current,
    sets: current.sets.map((set, index) => index === setIndex ? { ...set, ...patch } : set),
  }))
  const updateWarmupSet = (setIndex: number, patch: Partial<ExerciseLog['warmupSets'][number]>) => onUpdate((current) => ({
    ...current,
    warmupSets: current.warmupSets.map((set, index) => index === setIndex ? { ...set, ...patch } : set),
  }))
  const updateBaseWeight = (value: number | null) => onUpdate((current) => {
    const oldBase = current.baseWeightLb
    const sets = current.sets.map((set) => ({
      ...set,
      weightLb: value == null ? null : oldBase && set.weightLb != null
        ? roundToIncrement(value * set.weightLb / oldBase, current.incrementLb || 5)
        : value,
    }))
    const nextFirstWeight = sets.find((set) => set.weightLb != null)?.weightLb ?? null
    return {
      ...current,
      baseWeightLb: value,
      sets,
      warmupSets: current.warmupSets.some((set) => set.complete) ? current.warmupSets : definition?.barbell && nextFirstWeight != null ? buildWarmupSets(nextFirstWeight, barWeight).map((set, index) => ({ number: index + 1, weightLb: set.weight, reps: set.reps, complete: false })) : [],
    }
  })

  return (
    <article id={`exercise-${exercise.logId}`} className={['exercise-card', exercise.skipped ? 'skipped' : '', workingSetsComplete ? 'is-complete' : '', !exercise.skipped && !expanded ? 'collapsed' : ''].filter(Boolean).join(' ')}>
      <div className="exercise-heading">
        <div><span className={`category-dot ${definition?.category ?? 'pull'}`} /><span className="exercise-order">{String(index).padStart(2, '0')}</span><h2>{exercise.name}</h2><p>{exerciseScheme(exercise)} · target RPE {exercise.targetRpe}</p></div>
        <div className="exercise-actions">
          {workingSetsComplete && !exercise.skipped && <span className="exercise-done"><CircleCheck />Done</span>}
          {(!workingSetsComplete || exercise.skipped) && <button className="skip-button" onClick={() => onUpdate((current) => ({ ...current, skipped: !current.skipped }))}>{exercise.skipped ? 'Undo' : exercise.optional ? 'Skip optional' : 'Skip'}</button>}
          {!exercise.skipped && <button className="collapse-button" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${exercise.name}`} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((current) => !current)}><ChevronDown /></button>}
        </div>
      </div>
      {!exercise.skipped && <div id={bodyId} className={expanded ? 'exercise-body' : 'exercise-body collapsed-body'}>
        {!expanded ? <button className="exercise-summary" onClick={() => setExpanded(true)}><CircleCheck /><span><strong>{workingSetsCompleted}/{exercise.sets.length} working sets complete</strong><small>{exercise.warmupSets.length ? `${warmupSetsCompleted}/${exercise.warmupSets.length} warm-ups logged` : 'Tap to review or edit'}</small></span><b>Review</b></button> : <>
        {definition?.weightMode !== 'none' && (
          <div className="working-weight">
            <label>
              <span>{definition?.weightMode === 'bodyweight' ? 'Added weight' : ramped ? 'Top set / training max' : 'Working weight'}</span>
              <div className="weight-stepper">
                <button aria-label={`Decrease ${exercise.name} weight`} onClick={() => updateBaseWeight(Math.max(0, (exercise.baseWeightLb ?? 0) - exercise.incrementLb))}>−</button>
                <div className="weight-input-wrap">
                  {definition?.weightMode === 'bodyweight' && <small>BW +</small>}
                  <input aria-label={`${exercise.name} working weight`} inputMode="decimal" type="number" min="0" max={maxInputWeight} step={unit === 'kg' ? 0.5 : 2.5} value={lbToInputWeight(exercise.baseWeightLb, unit)} placeholder="—" onChange={(event) => updateBaseWeight(parseWeightInput(event.target.value, unit))} />
                  <b>{unit}</b>
                </div>
                <button aria-label={`Increase ${exercise.name} weight`} onClick={() => updateBaseWeight(Math.min(MAX_SUPPORTED_WEIGHT_LB, (exercise.baseWeightLb ?? 0) + exercise.incrementLb))}>+</button>
              </div>
            </label>
            {plateResult && <span className="plate-summary">Top: {displayWeight(topSetWeight, unit)}<br />{plateResult.plates.length ? `${plateResult.plates.map((plate) => Number((unit === 'kg' ? plate * 0.45359237 : plate).toFixed(1))).join(' · ')} ${unit} / side` : 'Empty bar'}{!plateResult.exact ? ` (${displayWeight(plateResult.actualWeight, unit)})` : ''}</span>}
          </div>
        )}
        {exercise.warmupSets.length > 0 && <section className={warmupsExpanded ? 'warmup-block' : 'warmup-block collapsed'} aria-label={`${exercise.name} warm-up sets`}>
          <button type="button" className="warmup-toggle" aria-label={`${warmupsExpanded ? 'Collapse' : 'Expand'} ${exercise.name} warm-ups`} aria-expanded={warmupsExpanded} aria-controls={warmupId} onClick={() => setWarmupsExpanded((current) => !current)}><span><strong>Warm-up</strong><small>{exercise.warmupSets.length} preparation sets</small></span><b>{warmupSetsCompleted}/{exercise.warmupSets.length}</b><ChevronDown /></button>
          {warmupsExpanded && <div className="warmup-list" id={warmupId}>{exercise.warmupSets.map((set, setIndex) => {
            const current = isNext && setIndex === nextWarmupIndex
            const weightInput = lbToInputWeight(set.weightLb, unit)
            return <div className={['warmup-row', set.complete ? 'complete' : '', current ? 'current' : ''].filter(Boolean).join(' ')} key={set.number} aria-current={current ? 'step' : undefined}>
              <div className="set-row-top"><div className="set-row-title"><strong>Warm-up {set.number}</strong><small>{displayWeight(set.weightLb, unit)} × {set.reps}</small></div>{current && <span className="next-set-badge">Next</span>}<button className="warmup-complete" aria-label={`${set.complete ? 'Undo' : 'Complete'} ${exercise.name} warm-up ${set.number}`} aria-pressed={set.complete} onClick={() => { updateWarmupSet(setIndex, { complete: !set.complete }); if (!set.complete) onSetCompleted(Math.min(90, exercise.restSeconds)) }}><CircleCheck /><span>{set.complete ? 'Undo' : 'Done'}</span></button></div>
              <div className="set-adjusters">
                <NumberStepper label="Weight" unit={unit} inputLabel={`${exercise.name} warm-up ${set.number} weight`} value={weightInput} inputMode="decimal" minimum={0} maximum={maxInputWeight} inputStep={unit === 'kg' ? 0.5 : 2.5} onInput={(text) => { const value = parseWeightInput(text, unit); if (value != null) updateWarmupSet(setIndex, { weightLb: value }) }} onDecrease={() => updateWarmupSet(setIndex, { weightLb: Math.max(0, set.weightLb - exercise.incrementLb) })} onIncrease={() => updateWarmupSet(setIndex, { weightLb: Math.min(MAX_SUPPORTED_WEIGHT_LB, set.weightLb + exercise.incrementLb) })} />
                <NumberStepper label="Reps" inputLabel={`${exercise.name} warm-up ${set.number} reps`} value={set.reps} inputMode="numeric" minimum={0} maximum={100} inputStep={1} onInput={(text) => { const value = finiteNumberOrNull(text, 100); if (value != null) updateWarmupSet(setIndex, { reps: value }) }} onDecrease={() => updateWarmupSet(setIndex, { reps: Math.max(0, set.reps - 1) })} onIncrease={() => updateWarmupSet(setIndex, { reps: Math.min(100, set.reps + 1) })} />
              </div>
            </div>
          })}</div>}
        </section>}
        <div className="set-section-heading working-heading"><strong>Working sets</strong><span>{exercise.sets.filter((set) => set.complete).length}/{exercise.sets.length}</span></div>
        <div className="set-list" role="group" aria-label={`${exercise.name} sets`}>
          {exercise.sets.map((set, setIndex) => {
            const timed = definition?.progression === 'timed'
            const value = timed ? set.seconds : set.reps
            const valueMaximum = timed ? 86400 : 999
            const valueStep = timed ? 5 : 1
            const valueLabel = timed ? 'Seconds' : 'Reps'
            const inputLabel = `${exercise.name} set ${set.number} ${timed ? 'seconds' : 'reps'}`
            const current = isNext && (!warmupsExpanded || nextWarmupIndex < 0) && setIndex === nextWorkingIndex
            const weightInput = lbToInputWeight(set.weightLb, unit)
            return <div className={['set-row', set.complete ? 'complete' : '', current ? 'current' : ''].filter(Boolean).join(' ')} key={set.number} aria-current={current ? 'step' : undefined}>
              <div className="set-row-top">
                <div className="set-row-title"><strong>Set {set.number}{set.plusSet ? '+' : ''}</strong><small>{setTargetLabel(set, timed)}</small></div>
                {current && <span className="next-set-badge">Next</span>}
                <button className="complete-set-button" aria-label={`${set.complete ? 'Undo' : 'Complete'} ${exercise.name} set ${set.number}`} aria-pressed={set.complete} onClick={() => { updateSet(setIndex, { complete: !set.complete }); if (!set.complete) onSetCompleted(exercise.restSeconds) }}><CircleCheck /><span>{set.complete ? 'Undo' : 'Done'}</span></button>
              </div>
              <div className={definition?.weightMode === 'none' ? 'set-adjusters single' : 'set-adjusters'}>
                {definition?.weightMode !== 'none' && <NumberStepper label={definition?.weightMode === 'bodyweight' ? 'Added' : 'Weight'} unit={unit} inputLabel={`${exercise.name} set ${set.number} weight`} value={weightInput} inputMode="decimal" minimum={0} maximum={maxInputWeight} inputStep={unit === 'kg' ? 0.5 : 2.5} onInput={(text) => updateSet(setIndex, { weightLb: parseWeightInput(text, unit) })} onDecrease={() => updateSet(setIndex, { weightLb: Math.max(0, (set.weightLb ?? 0) - exercise.incrementLb) })} onIncrease={() => updateSet(setIndex, { weightLb: Math.min(MAX_SUPPORTED_WEIGHT_LB, (set.weightLb ?? 0) + exercise.incrementLb) })} />}
                <NumberStepper label={valueLabel} inputLabel={inputLabel} value={value ?? ''} inputMode="numeric" minimum={0} maximum={valueMaximum} inputStep={valueStep} placeholder={set.plusSet ? `${set.minReps}+` : undefined} onInput={(text) => updateSet(setIndex, timed ? { seconds: finiteNumberOrNull(text, valueMaximum) } : { reps: finiteNumberOrNull(text, valueMaximum) })} onDecrease={() => updateSet(setIndex, timed ? { seconds: Math.max(0, (set.seconds ?? set.targetSeconds ?? 0) - valueStep) } : { reps: Math.max(0, (set.reps ?? set.minReps) - valueStep) })} onIncrease={() => updateSet(setIndex, timed ? { seconds: Math.min(valueMaximum, (set.seconds ?? set.targetSeconds ?? 0) + valueStep) } : { reps: Math.min(valueMaximum, (set.reps ?? set.minReps) + valueStep) })} />
              </div>
            </div>
          })}
        </div>
        <label className="exercise-notes"><span>Notes</span><input value={exercise.notes} placeholder="Optional" onChange={(event) => onUpdate((current) => ({ ...current, notes: event.target.value }))} /></label>
        </>}
      </div>}
    </article>
  )
}

function setTargetLabel(set: SetLog, timed: boolean): string {
  if (timed) return `Target ${set.targetSeconds ?? set.seconds ?? 0}s`
  if (set.plusSet) return `Target ${set.minReps}+ reps`
  if (set.minReps === set.maxReps) return `Target ${set.minReps} reps`
  return `Target ${set.minReps}–${set.maxReps} reps`
}

function NumberStepper({ label, unit, inputLabel, value, inputMode, minimum, maximum, inputStep, placeholder, onInput, onDecrease, onIncrease }: {
  label: string
  unit?: string
  inputLabel: string
  value: number | ''
  inputMode: 'numeric' | 'decimal'
  minimum: number
  maximum: number
  inputStep: number
  placeholder?: string
  onInput: (text: string) => void
  onDecrease: () => void
  onIncrease: () => void
}) {
  const number = value === '' ? null : value
  return <div className="number-stepper">
    <span className="number-stepper-label">{label}{unit && <small>{unit}</small>}</span>
    <div className="number-stepper-control">
      <button type="button" aria-label={`Decrease ${inputLabel}`} disabled={number == null || number <= minimum} onClick={onDecrease}>−</button>
      <input aria-label={inputLabel} type="number" inputMode={inputMode} min={minimum} max={maximum} step={inputStep} value={value} placeholder={placeholder} onChange={(event) => onInput(event.target.value)} />
      <button type="button" aria-label={`Increase ${inputLabel}`} disabled={number != null && number >= maximum} onClick={onIncrease}>+</button>
    </div>
  </div>
}

function finiteNumberOrNull(text: string, maximum = Number.POSITIVE_INFINITY): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) && value >= 0 && value <= maximum ? value : null
}

function RestTimer({ end, onAdd, onDismiss }: { end: string; onAdd: (seconds: number) => void; onDismiss: () => void }) {
  const remainingNow = () => Math.max(0, Math.ceil((Date.parse(end) - Date.now()) / 1000))
  const [remaining, setRemaining] = useState(remainingNow)
  useEffect(() => {
    setRemaining(remainingNow())
    const interval = window.setInterval(() => setRemaining(remainingNow()), 1000)
    return () => window.clearInterval(interval)
  }, [end])
  return <aside className={remaining ? 'rest-timer' : 'rest-timer done'}><span className="sr-only" aria-live="polite">{remaining === 0 ? 'Rest complete' : ''}</span><TimerReset /><div><small>{remaining ? 'RESTING' : 'REST COMPLETE'}</small><strong>{formatDuration(remaining)}</strong></div>{remaining > 0 && <button onClick={() => onAdd(remaining + 30)}>+30s</button>}<button onClick={onDismiss}>{remaining ? 'Skip' : 'Done'}</button></aside>
}

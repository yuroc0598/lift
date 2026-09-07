import { useEffect, useState } from 'react'
import { CircleCheck, TimerReset } from 'lucide-react'
import { calculatePlates, completedSetCount, displayWeight, lbToInputWeight, MAX_SUPPORTED_WEIGHT_LB, maximumInputWeight, parseWeightInput, roundToIncrement, warmupSets as buildWarmupSets } from '../lifting'
import { EXERCISES } from '../program'
import type { AppState, ExerciseLog, SetLog, WorkoutSession } from '../types'
import { exerciseScheme, formatDuration } from '../ui'

export default function WorkoutView({ session, settings, restTimerEnd, onUpdate, onStartRest, onDismissRest, onFinish, onCancel }: {
  session: WorkoutSession
  settings: AppState['settings']
  restTimerEnd: string | null
  onUpdate: (updater: (session: WorkoutSession) => WorkoutSession) => void
  onStartRest: (seconds: number) => void
  onDismissRest: () => void
  onFinish: () => void
  onCancel: () => void
}) {
  const activeExercises = session.exercises.filter((exercise) => !exercise.skipped)
  const completed = session.exercises.reduce((sum, exercise) => sum + completedSetCount(exercise), 0)
  const workingCompleted = activeExercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.complete).length, 0)
  const warmupCompleted = activeExercises.reduce((sum, exercise) => sum + exercise.warmupSets.filter((set) => set.complete).length, 0)
  const workingTotal = activeExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const warmupTotal = activeExercises.reduce((sum, exercise) => sum + exercise.warmupSets.length, 0)
  const total = workingTotal + warmupTotal
  const completionPercent = total ? Math.round(completed / total * 100) : 100
  const updateExercise = (exerciseIndex: number, updater: (exercise: ExerciseLog) => ExerciseLog) => onUpdate((current) => ({ ...current, exercises: current.exercises.map((exercise, index) => index === exerciseIndex ? updater(exercise) : exercise) }))
  const finish = () => { if (completed === total || window.confirm(`Finish with ${total - completed} incomplete sets?`)) onFinish() }
  const cancel = () => { if (window.confirm('Discard this active workout? Your completed history will not be affected.')) onCancel() }

  return <div className="workout-shell">
    <header className="workout-header"><button className="text-button danger-text" onClick={cancel}>Cancel</button><div><strong>{session.name}</strong><span><ElapsedTimer startedAt={session.startedAt} /> · {workingCompleted}/{workingTotal} work · {warmupCompleted}/{warmupTotal} warm-up</span></div><button className="text-button accent-text" onClick={finish}>Finish</button></header>
    <div className="session-progress" role="progressbar" aria-label="Workout completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}><span style={{ width: `${completionPercent}%` }} /></div>
    <main className="workout-content">
      <div className="workout-title"><div className="eyebrow">{session.programName} · {session.day}</div><h1>{session.variation ?? session.name}</h1></div>
      {session.exercises.map((exercise, exerciseIndex) => <ExerciseCard key={exercise.logId} exercise={exercise} unit={settings.unit} barWeight={settings.barWeightLb} plates={settings.platesLb} onUpdate={(updater) => updateExercise(exerciseIndex, updater)} onSetCompleted={(seconds) => { if (settings.autoStartRest) onStartRest(seconds) }} />)}
      <label className="notes-field"><span>Workout notes</span><textarea value={session.notes} placeholder="How did the session feel?" onChange={(event) => onUpdate((current) => ({ ...current, notes: event.target.value }))} /></label>
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

function ExerciseCard({ exercise, unit, barWeight, plates, onUpdate, onSetCompleted }: {
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
    <article className={exercise.skipped ? 'exercise-card skipped' : 'exercise-card'}>
      <div className="exercise-heading">
        <div><span className={`category-dot ${definition?.category ?? 'pull'}`} /><h2>{exercise.name}</h2><p>{exerciseScheme(exercise)} · target RPE {exercise.targetRpe}</p></div>
        <button className="skip-button" onClick={() => onUpdate((current) => ({ ...current, skipped: !current.skipped }))}>{exercise.skipped ? 'Undo' : exercise.optional ? 'Skip optional' : 'Skip'}</button>
      </div>
      {!exercise.skipped && <>
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
        {exercise.warmupSets.length > 0 && <section className="warmup-block" aria-label={`${exercise.name} warm-up sets`}><div className="set-section-heading"><strong>Warm-up</strong><span>{exercise.warmupSets.filter((set) => set.complete).length}/{exercise.warmupSets.length}</span></div><div className="warmup-list">{exercise.warmupSets.map((set, setIndex) => <div className={set.complete ? 'warmup-row complete' : 'warmup-row'} key={set.number}><span>W{set.number}</span><input aria-label={`${exercise.name} warm-up ${set.number} weight`} type="number" inputMode="decimal" min="0" max={maxInputWeight} step={unit === 'kg' ? 0.5 : 2.5} value={lbToInputWeight(set.weightLb, unit)} onChange={(event) => { const value = parseWeightInput(event.target.value, unit); if (value != null) updateWarmupSet(setIndex, { weightLb: value }) }} /><b>{unit}</b><span>×</span><input aria-label={`${exercise.name} warm-up ${set.number} reps`} type="number" inputMode="numeric" min="0" max="100" value={set.reps} onChange={(event) => { const value = finiteNumberOrNull(event.target.value, 100); if (value != null) updateWarmupSet(setIndex, { reps: value }) }} /><button className="warmup-complete" aria-label={`${set.complete ? 'Undo' : 'Complete'} ${exercise.name} warm-up ${set.number}`} aria-pressed={set.complete} onClick={() => { updateWarmupSet(setIndex, { complete: !set.complete }); if (!set.complete) onSetCompleted(Math.min(90, exercise.restSeconds)) }}><CircleCheck /></button></div>)}</div></section>}
        <div className="set-section-heading working-heading"><strong>Working sets</strong><span>{exercise.sets.filter((set) => set.complete).length}/{exercise.sets.length}</span></div>
        <div className="set-table" role="group" aria-label={`${exercise.name} sets`}>
          <div className="set-table-head"><span>Set</span><span>Weight</span><span>{definition?.progression === 'timed' ? 'Seconds' : 'Reps'}</span><span>RPE</span><span>Done</span></div>
          {exercise.sets.map((set, setIndex) => (
            <div className={set.complete ? 'set-row complete' : 'set-row'} key={set.number}>
              <span className="set-number">{set.number}</span>
              {definition?.weightMode === 'none' ? <span className="no-weight">—</span> : <input aria-label={`${exercise.name} set ${set.number} weight`} inputMode="decimal" type="number" min="0" max={maxInputWeight} step={unit === 'kg' ? 0.5 : 2.5} value={lbToInputWeight(set.weightLb, unit)} onChange={(event) => updateSet(setIndex, { weightLb: parseWeightInput(event.target.value, unit) })} />}
              <input aria-label={`${exercise.name} set ${set.number} ${definition?.progression === 'timed' ? 'seconds' : 'reps'}`} inputMode="numeric" type="number" min="0" max={definition?.progression === 'timed' ? 86400 : 999} value={(definition?.progression === 'timed' ? set.seconds : set.reps) ?? ''} placeholder={set.plusSet ? `${set.minReps}+` : undefined} onChange={(event) => updateSet(setIndex, definition?.progression === 'timed' ? { seconds: finiteNumberOrNull(event.target.value, 86400) } : { reps: finiteNumberOrNull(event.target.value, 999) })} />
              <select aria-label={`${exercise.name} set ${set.number} RPE`} value={set.rpe ?? ''} onChange={(event) => updateSet(setIndex, { rpe: finiteNumberOrNull(event.target.value) })}><option value="">—</option>{[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((rpe) => <option key={rpe} value={rpe}>{rpe}</option>)}</select>
              <button className="complete-set-button" aria-label={`${set.complete ? 'Undo' : 'Complete'} ${exercise.name} set ${set.number}`} aria-pressed={set.complete} onClick={() => { updateSet(setIndex, { complete: !set.complete }); if (!set.complete) onSetCompleted(exercise.restSeconds) }}><CircleCheck /></button>
            </div>
          ))}
        </div>
        <label className="exercise-notes"><span>Notes</span><input value={exercise.notes} placeholder="Optional" onChange={(event) => onUpdate((current) => ({ ...current, notes: event.target.value }))} /></label>
      </>}
    </article>
  )
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

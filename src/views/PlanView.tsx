import { useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { Check, ChevronRight, CircleCheck, Layers3, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { allPrograms, createProgramRuntime, EXERCISES, getProgram, MAX_CUSTOM_EXERCISES, MAX_CUSTOM_REPS, MAX_CUSTOM_SETS, MAX_CUSTOM_WORKOUTS, normalizeProgramRuntime, suggestedCustomProgram } from '../program'
import type { AppState, Prescription, ProgramDefinition, WorkoutTemplate } from '../types'
import { prescriptionLabel } from '../ui'

function planPrescriptionLabel(prescription: Prescription): string {
  if (prescription.setTargets) return prescription.setTargets.map((set) => `${Math.round((set.weightMultiplier ?? 1) * 100)}%×${set.minReps}${set.plusSet ? '+' : ''}`).join(' · ')
  const scheme = prescriptionLabel(prescription.sets ?? 1, prescription.minReps ?? 0, prescription.maxReps ?? prescription.minReps ?? 0, prescription.targetSeconds)
  return prescription.weightMultiplier == null ? scheme : `${scheme} @ ${Math.round(prescription.weightMultiplier * 100)}%`
}

export default function PlanView({ state, onChange, onActivated }: { state: AppState; onChange: Dispatch<SetStateAction<AppState | null>>; onActivated: () => void }) {
  const programs = allPrograms(state)
  const [selectedId, setSelectedId] = useState(state.activeProgramId)
  const [editing, setEditing] = useState<ProgramDefinition | null>(null)
  const selected = programs.find((program) => program.id === selectedId) ?? getProgram(state)
  const active = getProgram(state)
  const runtime = normalizeProgramRuntime(selected, state.programStates[selected.id] ?? createProgramRuntime(selected))
  const activate = () => {
    onChange((current) => current ? { ...current, activeProgramId: selected.id, programStates: current.programStates[selected.id] ? current.programStates : { ...current.programStates, [selected.id]: createProgramRuntime(selected) } } : current)
    onActivated()
  }
  const saveCustom = (program: ProgramDefinition) => {
    onChange((current) => {
      if (!current) return current
      const exists = current.customPrograms.some((item) => item.id === program.id)
      const savedRuntime = current.programStates[program.id]
      return { ...current, customPrograms: exists ? current.customPrograms.map((item) => item.id === program.id ? program : item) : [...current.customPrograms, program], programStates: { ...current.programStates, [program.id]: savedRuntime ? normalizeProgramRuntime(program, savedRuntime) : createProgramRuntime(program) } }
    })
    setSelectedId(program.id)
    setEditing(null)
  }
  if (editing) return <CustomProgramEditor program={editing} onCancel={() => setEditing(null)} onSave={saveCustom} />

  return <section className="page plan-page" aria-labelledby="plan-heading">
    <div className="eyebrow">PROGRAM LIBRARY</div><h1 id="plan-heading">Choose your method</h1><p className="page-lead">Switch anytime. Every plan keeps its own weights and place in the cycle.</p>
    <div className="program-carousel" aria-label="Available programs">
      {programs.map((program) => {
        const saved = state.programStates[program.id]
        return <button type="button" className={`program-card ${program.id === selected.id ? 'selected' : ''}`} key={program.id} onClick={() => setSelectedId(program.id)} style={{ '--program-color': program.color } as CSSProperties}><span className="program-icon"><Layers3 /></span><span className="program-card-copy"><b>{program.name}</b><small>{program.level} · {program.schedule}</small></span>{program.id === state.activeProgramId ? <span className="active-label"><Check /> Active</span> : saved?.completedWorkouts ? <span className="resume-label">Resume {saved.nextWorkoutIndex + 1}/{program.workouts.length}</span> : null}</button>
      })}
      <button type="button" className="program-card add-program-card" onClick={() => setEditing(suggestedCustomProgram('My Program'))}><span className="program-icon"><Plus /></span><span className="program-card-copy"><b>Build a program</b><small>Create your own sessions</small></span></button>
    </div>
    <article className="selected-program" style={{ '--program-color': selected.color } as CSSProperties}><div className="selected-program-top"><div><span className="method-label">{selected.level}</span><h2>{selected.name}</h2><p>{selected.description}</p></div><span className="cycle-badge">{runtime.nextWorkoutIndex + 1}<small>of {selected.workouts.length}</small></span></div><div className="program-actions">{selected.id !== active.id && <button className="primary-button" onClick={activate}>Use this program <ChevronRight /></button>}{selected.id === active.id && <div className="current-program-message"><CircleCheck /> Current program</div>}{selected.custom && <button className="secondary-button compact-button" onClick={() => setEditing(structuredClone(selected))}>Edit program</button>}<button className="ghost-button" onClick={() => { if (window.confirm(`Restart ${selected.name} from its first workout and starting weights?`)) onChange((current) => current ? { ...current, programStates: { ...current.programStates, [selected.id]: createProgramRuntime(selected) } } : current) }}><RotateCcw /> Restart progression</button></div></article>
    <div className="section-heading plan-sequence-heading"><h2>Workout sequence</h2><span>{selected.schedule}</span></div><div className="sequence-rail" aria-label={`${selected.name} workout sequence`}>{selected.workouts.map((item, index) => <span className={index === runtime.nextWorkoutIndex ? 'current' : ''} key={item.id}>{item.day}</span>)}</div>
    <div className="plan-workouts">{selected.workouts.map((item, index) => <details className="plan-card" key={item.id} open={index === runtime.nextWorkoutIndex}><summary className="plan-heading"><span className="day-token" style={{ background: selected.color }}>{item.day}</span><div><h2>{item.name}</h2><p>{item.focus}</p></div><ChevronRight /></summary><div className="plan-exercises">{item.prescriptions.map((prescription, exerciseIndex) => { const exercise = EXERCISES[prescription.exerciseId]; return <div className="plan-row" key={`${exercise.id}-${exerciseIndex}`}><div><strong>{prescription.displayName ?? exercise.name}</strong>{prescription.optional && <small>Optional</small>}</div><span>{planPrescriptionLabel(prescription)} · RPE {prescription.targetRpe}</span></div> })}</div></details>)}</div>
    <article className="subtle-card rules-card"><RotateCcw /><div><strong>History is never replaced</strong><p>Switching deletes nothing. Returning to a plan resumes its next workout and progression weights.</p></div></article>
  </section>
}

function CustomProgramEditor({ program, onCancel, onSave }: { program: ProgramDefinition; onCancel: () => void; onSave: (program: ProgramDefinition) => void }) {
  const [draft, setDraft] = useState(() => structuredClone(program))
  const updateWorkout = (index: number, updater: (workout: WorkoutTemplate) => WorkoutTemplate) => setDraft((current) => ({ ...current, workouts: current.workouts.map((item, itemIndex) => itemIndex === index ? updater(item) : item) }))
  const updatePrescription = (workoutIndex: number, exerciseIndex: number, patch: Partial<Prescription>) => updateWorkout(workoutIndex, (current) => ({ ...current, prescriptions: current.prescriptions.map((item, itemIndex) => itemIndex === exerciseIndex ? { ...item, setTargets: undefined, ...patch } : item) }))
  const integer = (text: string, fallback: number, maximum: number) => { const value = Number(text); return Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.round(value))) : fallback }
  const valid = draft.name.trim() !== '' && draft.workouts.length > 0 && draft.workouts.length <= MAX_CUSTOM_WORKOUTS && draft.workouts.every((item) => item.prescriptions.length > 0 && item.prescriptions.length <= MAX_CUSTOM_EXERCISES && item.prescriptions.every((prescription) => {
    const definition = EXERCISES[prescription.exerciseId]
    const sets = prescription.sets ?? 0
    if (!definition || sets < 1 || sets > MAX_CUSTOM_SETS) return false
    return definition.progression === 'timed'
      ? (prescription.targetSeconds ?? 0) > 0 && (prescription.targetSeconds ?? 0) <= 3600
      : (prescription.minReps ?? 0) >= 0 && (prescription.maxReps ?? 0) <= MAX_CUSTOM_REPS && (prescription.minReps ?? 0) <= (prescription.maxReps ?? 0)
  }))
  const changeExercise = (workoutIndex: number, exerciseIndex: number, exerciseId: string) => {
    const timed = EXERCISES[exerciseId]?.progression === 'timed'
    updatePrescription(workoutIndex, exerciseIndex, timed
      ? { exerciseId, minReps: 0, maxReps: 0, targetSeconds: 45 }
      : { exerciseId, minReps: 5, maxReps: 5, targetSeconds: undefined })
  }

  return <section className="custom-editor" aria-labelledby="editor-heading">
    <header className="editor-header"><button className="icon-button" aria-label="Cancel editing" onClick={onCancel}><X /></button><div><div className="eyebrow">CUSTOM BUILDER</div><h1 id="editor-heading">Edit program</h1></div><button className="save-button" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim(), shortName: draft.name.trim().slice(0, 18), schedule: `${draft.workouts.length} sessions / cycle`, version: draft.version + 1 })}>Save</button></header>
    <label className="builder-name"><span>Program name</span><input aria-label="Program name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
    <div className="builder-days">{draft.workouts.map((item, workoutIndex) => <article className="builder-day" key={item.id}>
      <div className="builder-day-header"><span className="day-token small">{item.day}</span><input aria-label={`Workout ${item.day} name`} value={item.name} onChange={(event) => updateWorkout(workoutIndex, (current) => ({ ...current, name: event.target.value }))} /><button className="icon-button danger-text" aria-label={`Delete workout ${item.day}`} disabled={draft.workouts.length === 1} onClick={() => setDraft((current) => ({ ...current, workouts: current.workouts.filter((_, index) => index !== workoutIndex) }))}><Trash2 /></button></div>
      {item.prescriptions.map((prescription, exerciseIndex) => {
        const definition = EXERCISES[prescription.exerciseId]
        const timed = definition?.progression === 'timed'
        return <div className="builder-exercise" key={`${workoutIndex}-${exerciseIndex}`}>
          <select aria-label={`Workout ${item.day} exercise ${exerciseIndex + 1}`} value={prescription.exerciseId} onChange={(event) => changeExercise(workoutIndex, exerciseIndex, event.target.value)}>{Object.values(EXERCISES).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select>
          <label><span>Sets</span><input type="number" min="1" max={MAX_CUSTOM_SETS} value={prescription.sets ?? prescription.setTargets?.length ?? 3} onChange={(event) => updatePrescription(workoutIndex, exerciseIndex, { sets: Math.max(1, integer(event.target.value, 1, MAX_CUSTOM_SETS)) })} /></label>
          {timed ? <><label><span>Seconds</span><input type="number" min="1" max="3600" value={prescription.targetSeconds ?? 45} onChange={(event) => updatePrescription(workoutIndex, exerciseIndex, { targetSeconds: Math.max(1, integer(event.target.value, 45, 3600)) })} /></label><label><span>Rest</span><input type="number" min="0" max="3600" value={prescription.restSeconds} onChange={(event) => updatePrescription(workoutIndex, exerciseIndex, { restSeconds: integer(event.target.value, 60, 3600) })} /></label></> : <><label><span>Min reps</span><input type="number" min="0" max={MAX_CUSTOM_REPS} value={prescription.minReps ?? 5} onChange={(event) => updatePrescription(workoutIndex, exerciseIndex, { minReps: integer(event.target.value, 0, MAX_CUSTOM_REPS) })} /></label><label><span>Max reps</span><input type="number" min="0" max={MAX_CUSTOM_REPS} value={prescription.maxReps ?? prescription.minReps ?? 5} onChange={(event) => updatePrescription(workoutIndex, exerciseIndex, { maxReps: integer(event.target.value, 0, MAX_CUSTOM_REPS) })} /></label></>}
          <button className="icon-button danger-text" aria-label={`Remove ${definition?.name ?? 'exercise'}`} disabled={item.prescriptions.length === 1} onClick={() => updateWorkout(workoutIndex, (current) => ({ ...current, prescriptions: current.prescriptions.filter((_, index) => index !== exerciseIndex) }))}><Trash2 /></button>
        </div>
      })}
      <button className="add-row-button" disabled={item.prescriptions.length >= MAX_CUSTOM_EXERCISES} onClick={() => updateWorkout(workoutIndex, (current) => ({ ...current, prescriptions: [...current.prescriptions, { exerciseId: 'bench', sets: 3, minReps: 5, maxReps: 5, targetRpe: 8, restSeconds: 120 }] }))}><Plus /> Add exercise</button>
    </article>)}</div>
    <button className="secondary-button" disabled={draft.workouts.length >= MAX_CUSTOM_WORKOUTS} onClick={() => setDraft((current) => { const day = String.fromCharCode(65 + current.workouts.length); return { ...current, workouts: [...current.workouts, { id: `${current.id}-${Date.now()}`, day, name: `Custom ${day}`, focus: 'Custom session', prescriptions: [{ exerciseId: 'squat', sets: 3, minReps: 5, maxReps: 5, targetRpe: 8, restSeconds: 180 }] }] } })}><Plus /> Add workout day</button>
  </section>
}

import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarCheck2, CalendarDays, ChevronDown, Layers3 } from 'lucide-react'
import { allPrograms, EXERCISES, previewNextWorkout } from '../program'
import { completedSetCount, displayWeight } from '../lifting'
import type { AppState } from '../types'
import { DATE_FORMAT, exerciseScheme } from '../ui'
import { displayVolume, sessionVolumeLb } from '../volume'

export default function TodayView({ state, onStart }: { state: AppState; onStart: (workoutIndex: number) => void }) {
  const scheduled = previewNextWorkout(state)
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(scheduled.runtime.nextWorkoutIndex)
  useEffect(() => setSelectedWorkoutIndex(scheduled.runtime.nextWorkoutIndex), [state.activeProgramId, scheduled.runtime.nextWorkoutIndex])
  const { program, runtime, template, workoutIndex, exercises } = previewNextWorkout(state, selectedWorkoutIndex)
  const isOverride = workoutIndex !== runtime.nextWorkoutIndex
  const nextTemplate = program.workouts[(workoutIndex + 1) % program.workouts.length]
  const last = state.history[0]
  const completedThisMonth = state.history.filter((session) => Date.now() - Date.parse(session.startedAt) < 30 * 86400000).length
  const workingSets = exercises.reduce((total, exercise) => total + exercise.sets.length, 0)

  return (
    <section className="page" aria-labelledby="today-heading">
      <div className="today-intro">
        <div className="program-chip"><span style={{ background: program.color }} /><b>{program.shortName}</b><small>{program.schedule}</small></div>
        <div className="eyebrow">{isOverride ? 'SESSION OVERRIDE' : 'UP NEXT'} · SESSION {workoutIndex + 1} OF {program.workouts.length}</div>
        <h1 id="today-heading">{template.name}</h1>
        <p className="page-lead">{template.focus}</p>
      </div>

      <section className="session-choice" aria-labelledby="session-choice-heading">
        <div className="session-choice-heading"><span className="session-choice-icon"><CalendarCheck2 /></span><div><strong id="session-choice-heading">Workout this session</strong><small>Scheduled: {runtime.nextWorkoutIndex + 1}. {scheduled.template.day} · {scheduled.template.name}</small></div></div>
        <div className="session-select-wrap">
          <select aria-label="Workout this session" value={workoutIndex} onChange={(event) => setSelectedWorkoutIndex(Number(event.target.value))}>
            {program.workouts.map((workout, index) => <option key={workout.id} value={index}>{index + 1}. {workout.day} · {workout.name} — {workout.focus}{index === runtime.nextWorkoutIndex ? ' (Scheduled)' : ''}</option>)}
          </select>
          <ChevronDown aria-hidden="true" />
        </div>
        {isOverride && <p className="session-override-note"><b>Override selected.</b> After this workout, {nextTemplate.day} · {nextTemplate.name} will be next.</p>}
      </section>

      <article className="hero-card">
        <div className="hero-topline">
          <span className="day-token" style={{ background: program.color }}>{template.day}</span>
          <div><strong>Today’s prescription</strong><small>{exercises.length} exercises · {workingSets} working sets</small></div>
        </div>
        <div className="preview-list">
          {exercises.slice(0, 4).map((exercise, index) => {
            const topWeight = exercise.sets.reduce<number | null>((top, set) => set.weightLb == null ? top : Math.max(top ?? 0, set.weightLb), null)
            const definition = EXERCISES[exercise.exerciseId]
            return <div className="preview-row" key={exercise.logId}><span className="preview-index">{String(index + 1).padStart(2, '0')}</span><div><span>{exercise.name}</span><small>{definition?.category ?? 'strength'}</small></div><strong>{exerciseScheme(exercise)}{topWeight != null && definition?.weightMode !== 'none' ? <small>up to {displayWeight(topWeight, state.settings.unit)}</small> : null}</strong></div>
          })}
          {exercises.length > 4 && <div className="preview-more">+ {exercises.length - 4} accessories</div>}
        </div>
        <button className="primary-button start-workout-button" aria-label={`Start workout ${template.day}`} onClick={() => onStart(workoutIndex)}><span><small>{isOverride ? `${template.day} selected instead` : 'Following your schedule'}</small><b>Start {template.day} workout</b></span><ArrowUpRight /></button>
      </article>

      <div className="stat-grid">
        <div className="stat-card"><span className="stat-icon"><Layers3 /></span><div><strong>{runtime.completedWorkouts}</strong><span>Plan sessions</span></div></div>
        <div className="stat-card"><span className="stat-icon"><CalendarDays /></span><div><strong>{completedThisMonth}</strong><span>Last 30 days</span></div></div>
      </div>
      {last && <article className="last-session"><div className="section-heading"><h2>Last session</h2><span>{DATE_FORMAT.format(new Date(last.startedAt))}</span></div><div className="history-card compact"><span className="day-token small" style={{ background: allPrograms(state).find((item) => item.id === last.programId)?.color }}>{last.day}</span><div><strong>{last.name}</strong><small>{last.programName} · {last.exercises.reduce((sum, exercise) => sum + completedSetCount(exercise), 0)} sets · {displayVolume(sessionVolumeLb(last), state.settings.unit)} lifted</small></div></div></article>}
    </section>
  )
}

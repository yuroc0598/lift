import { ArrowUpRight, CalendarDays, Layers3 } from 'lucide-react'
import { allPrograms, EXERCISES, previewNextWorkout } from '../program'
import { completedSetCount, displayWeight } from '../lifting'
import type { AppState } from '../types'
import { DATE_FORMAT, exerciseScheme } from '../ui'
import { displayVolume, sessionVolumeLb } from '../volume'

export default function TodayView({ state, onStart }: { state: AppState; onStart: () => void }) {
  const { program, runtime, template, exercises } = previewNextWorkout(state)
  const last = state.history[0]
  const completedThisMonth = state.history.filter((session) => Date.now() - Date.parse(session.startedAt) < 30 * 86400000).length
  const workingSets = exercises.reduce((total, exercise) => total + exercise.sets.length, 0)

  return (
    <section className="page" aria-labelledby="today-heading">
      <div className="today-intro">
        <div className="program-chip"><span style={{ background: program.color }} /><b>{program.shortName}</b><small>{program.schedule}</small></div>
        <div className="eyebrow">UP NEXT · SESSION {runtime.nextWorkoutIndex + 1} OF {program.workouts.length}</div>
        <h1 id="today-heading">{template.name}</h1>
        <p className="page-lead">{template.focus}</p>
      </div>

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
        <button className="primary-button start-workout-button" onClick={onStart}><span><small>Ready when you are</small><b>Start workout</b></span><ArrowUpRight /></button>
      </article>

      <div className="stat-grid">
        <div className="stat-card"><span className="stat-icon"><Layers3 /></span><div><strong>{runtime.completedWorkouts}</strong><span>Plan sessions</span></div></div>
        <div className="stat-card"><span className="stat-icon"><CalendarDays /></span><div><strong>{completedThisMonth}</strong><span>Last 30 days</span></div></div>
      </div>
      {last && <article className="last-session"><div className="section-heading"><h2>Last session</h2><span>{DATE_FORMAT.format(new Date(last.startedAt))}</span></div><div className="history-card compact"><span className="day-token small" style={{ background: allPrograms(state).find((item) => item.id === last.programId)?.color }}>{last.day}</span><div><strong>{last.name}</strong><small>{last.programName} · {last.exercises.reduce((sum, exercise) => sum + completedSetCount(exercise), 0)} sets · {displayVolume(sessionVolumeLb(last), state.settings.unit)} lifted</small></div></div></article>}
    </section>
  )
}

import { ChevronRight, ShieldCheck } from 'lucide-react'
import { allPrograms, EXERCISES, previewNextWorkout } from '../program'
import { completedSetCount, displayWeight } from '../lifting'
import type { AppState } from '../types'
import { DATE_FORMAT, exerciseScheme } from '../ui'
import { displayVolume, sessionVolumeLb } from '../volume'

export default function TodayView({ state, onStart }: { state: AppState; onStart: () => void }) {
  const { program, runtime, template, exercises } = previewNextWorkout(state)
  const last = state.history[0]
  const completedThisMonth = state.history.filter((session) => Date.now() - Date.parse(session.startedAt) < 30 * 86400000).length

  return (
    <section className="page" aria-labelledby="today-heading">
      <div className="program-chip"><span style={{ background: program.color }} /><b>{program.shortName}</b><small>{program.schedule}</small></div>
      <div className="eyebrow">NEXT SESSION · {runtime.nextWorkoutIndex + 1} OF {program.workouts.length}</div>
      <h1 id="today-heading">{template.name}</h1>
      <p className="page-lead">{template.focus}</p>

      <article className="hero-card">
        <div className="hero-topline">
          <span className="day-token" style={{ background: program.color }}>{template.day}</span>
          <div><strong>{exercises.length} exercises</strong><small>{runtime.completedWorkouts} workouts completed in this plan</small></div>
        </div>
        <div className="preview-list">
          {exercises.slice(0, 4).map((exercise) => {
            const topWeight = exercise.sets.reduce<number | null>((top, set) => set.weightLb == null ? top : Math.max(top ?? 0, set.weightLb), null)
            return <div className="preview-row" key={exercise.logId}><span>{exercise.name}</span><strong>{exerciseScheme(exercise)}{topWeight != null && EXERCISES[exercise.exerciseId]?.weightMode !== 'none' ? ` · up to ${displayWeight(topWeight, state.settings.unit)}` : ''}</strong></div>
          })}
          {exercises.length > 4 && <div className="preview-more">+ {exercises.length - 4} accessories</div>}
        </div>
        <button className="primary-button" onClick={onStart}>Start workout <ChevronRight /></button>
      </article>

      <div className="stat-grid">
        <div className="stat-card"><strong>{state.history.length}</strong><span>Total workouts</span></div>
        <div className="stat-card"><strong>{completedThisMonth}</strong><span>Sessions · 30 days</span></div>
      </div>
      <article className="subtle-card install-card"><div className="icon-box"><ShieldCheck /></div><div><strong>Private by design</strong><p>Your log stays in this browser. Export a CSV periodically from Settings.</p></div></article>
      {last && <article className="last-session"><div className="section-heading"><h2>Last session</h2><span>{DATE_FORMAT.format(new Date(last.startedAt))}</span></div><div className="history-card compact"><span className="day-token small" style={{ background: allPrograms(state).find((item) => item.id === last.programId)?.color }}>{last.day}</span><div><strong>{last.name}</strong><small>{last.programName} · {last.exercises.reduce((sum, exercise) => sum + completedSetCount(exercise), 0)} sets · {displayVolume(sessionVolumeLb(last), state.settings.unit)} lifted</small></div></div></article>}
    </section>
  )
}

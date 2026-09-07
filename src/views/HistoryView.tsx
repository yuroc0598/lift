import { CalendarDays, ChevronRight } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { completedSetCount, displayWeight } from '../lifting'
import type { ExerciseLog, WorkoutSession } from '../types'
import { DATE_FORMAT, TIME_FORMAT } from '../ui'
import { displayVolume, sessionVolumeLb } from '../volume'

function workingSetSummary(exercise: ExerciseLog, unit: 'lb' | 'kg'): string {
  return exercise.sets.filter((set) => set.complete).map((set) => `${set.weightLb == null ? '' : `${displayWeight(set.weightLb, unit)} × `}${set.reps ?? (set.seconds == null ? '—' : `${set.seconds}s`)}`).join(', ') || 'No completed working sets'
}

export default function HistoryView({ history, unit }: { history: WorkoutSession[]; unit: 'lb' | 'kg' }) {
  return <section className="page" aria-labelledby="history-heading">
    <div className="eyebrow">TRAINING LOG</div><h1 id="history-heading">History</h1><p className="page-lead">Every completed workout, stored on this device.</p>
    {!history.length ? <EmptyState icon={<CalendarDays />} title="No workouts yet" body="Complete a workout and it will appear here." /> : <div className="history-list">{history.map((session) => {
      const completed = session.exercises.reduce((sum, exercise) => sum + completedSetCount(exercise), 0)
      const warmups = session.exercises.filter((exercise) => !exercise.skipped).reduce((sum, exercise) => sum + exercise.warmupSets.filter((set) => set.complete).length, 0)
      const volumeLb = sessionVolumeLb(session)
      return <details className="history-card" key={session.id}>
        <summary><span className="day-token small">{session.day}</span><div><strong>{session.name}</strong><small>{session.programName} · {DATE_FORMAT.format(new Date(session.startedAt))} · {TIME_FORMAT.format(new Date(session.startedAt))}</small></div><ChevronRight /></summary>
        <div className="history-detail"><div className="history-metrics"><span><b>{completed}</b> sets</span><span><b>{warmups}</b> warm-ups</span><span><b>{displayVolume(volumeLb, unit)}</b> lifted</span></div>
          {session.exercises.map((exercise) => <div className="history-exercise" key={exercise.logId}><strong>{exercise.name}</strong>{exercise.skipped ? <span>Skipped</span> : <>{exercise.warmupSets.some((set) => set.complete) && <span className="history-warmups">Warm-up: {exercise.warmupSets.filter((set) => set.complete).map((set) => `${displayWeight(set.weightLb, unit)} × ${set.reps}`).join(', ')}</span>}<span>{workingSetSummary(exercise, unit)}</span></>}</div>)}
          {session.notes && <p className="session-note">{session.notes}</p>}
        </div>
      </details>
    })}</div>}
  </section>
}

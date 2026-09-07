import { ArrowRight, Check, Dumbbell, History } from 'lucide-react'
import { completedSetCount, displayWeight } from '../lifting'
import type { WorkoutSession } from '../types'
import { formatDuration } from '../ui'
import { displayVolume, exerciseVolume, sessionVolumeLb } from '../volume'

export default function CompletionView({ session, unit, onDone, onHistory }: { session: WorkoutSession; unit: 'lb' | 'kg'; onDone: () => void; onHistory: () => void }) {
  const duration = session.completedAt ? Math.max(0, Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 1000)) : 0
  const warmups = session.exercises.filter((exercise) => !exercise.skipped).reduce((total, exercise) => total + exercise.warmupSets.filter((set) => set.complete).length, 0)
  const workingSets = session.exercises.filter((exercise) => !exercise.skipped).reduce((total, exercise) => total + exercise.sets.filter((set) => set.complete).length, 0)
  const totalVolume = sessionVolumeLb(session)

  return <main className="completion-screen">
    <div className="completion-check"><Check /></div>
    <div className="eyebrow">WORKOUT COMPLETE</div>
    <h1>{session.name}</h1>
    <p>{session.programName} · {session.variation}</p>
    <section className="volume-hero" aria-label="Total workout volume"><span>Total weight lifted</span><strong>{displayVolume(totalVolume, unit)}</strong><small>Working sets + completed warm-ups</small></section>
    <div className="completion-stats"><div><strong>{formatDuration(duration)}</strong><span>Duration</span></div><div><strong>{workingSets}</strong><span>Working sets</span></div><div><strong>{warmups}</strong><span>Warm-ups</span></div></div>
    <section className="completion-breakdown"><h2>Session breakdown</h2>{session.exercises.filter((exercise) => !exercise.skipped && completedSetCount(exercise) > 0).map((exercise) => { const volume = exerciseVolume(exercise, session.bodyweightLb); return <div key={exercise.logId}><span><Dumbbell />{exercise.name}</span><strong>{displayVolume(volume.totalLb, unit)}</strong></div> })}</section>
    <button className="primary-button" onClick={onDone}>Done <ArrowRight /></button>
    <button className="secondary-button" onClick={onHistory}><History /> View history</button>
  </main>
}

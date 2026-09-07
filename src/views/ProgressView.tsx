import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { displayWeight, estimatedOneRepMax } from '../lifting'
import { EXERCISES, getProgram } from '../program'
import type { AppState } from '../types'

export default function ProgressView({ state }: { state: AppState }) {
  const trackedExercises = Object.values(EXERCISES).filter((exercise) => exercise.weightMode === 'loaded')
  const [selectedId, setSelectedId] = useState('bench')
  const selected = EXERCISES[selectedId] ?? trackedExercises[0]
  const points = useMemo(() => state.history.slice().reverse().flatMap((session) => {
    const logs = session.exercises.filter((exercise) => exercise.exerciseId === selected.id && !exercise.skipped)
    if (!logs.length) return []
    const best = Math.max(0, ...logs.flatMap((log) => log.sets.map((set) => estimatedOneRepMax(set) ?? 0)))
    return best ? [{ date: session.startedAt, value: best }] : []
  }), [selected.id, state.history])
  const best = points.length ? Math.max(...points.map((point) => point.value)) : null
  const activeProgram = getProgram(state)
  const current = state.programStates[activeProgram.id]?.progress[selected.id]?.workingWeightLb ?? null

  return <section className="page" aria-labelledby="progress-heading"><div className="eyebrow">PERFORMANCE</div><h1 id="progress-heading">Progress</h1><p className="page-lead">Current targets from {activeProgram.name}; charts include every program.</p><label className="select-field"><span>Exercise</span><select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{trackedExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label><div className="stat-grid progress-stats"><div className="stat-card"><strong>{displayWeight(current, state.settings.unit)}</strong><span>Next working weight</span></div><div className="stat-card"><strong>{best ? displayWeight(best, state.settings.unit) : '—'}</strong><span>Best estimated 1RM</span></div></div><article className="chart-card"><div className="section-heading"><h2>{selected.name}</h2><span>Estimated 1RM</span></div>{points.length < 2 ? <EmptyState icon={<BarChart3 />} title="More data needed" body="Complete this lift in two workouts to draw its trend." /> : <LineChart values={points.map((point) => point.value)} unit={state.settings.unit} />}</article><p className="footnote">Estimated 1RM uses the Epley formula and is a trend—not a max attempt recommendation.</p></section>
}

function LineChart({ values, unit }: { values: number[]; unit: 'lb' | 'kg' }) {
  const min = Math.min(...values)
  const spread = Math.max(1, Math.max(...values) - min)
  const points = values.map((value, index) => `${12 + index * (276 / Math.max(1, values.length - 1))},${105 - ((value - min) / spread) * 80}`).join(' ')
  return <svg className="line-chart" viewBox="0 0 300 120" role="img" aria-label={`Estimated one rep max progress from ${displayWeight(values[0], unit)} to ${displayWeight(values.at(-1) ?? 0, unit)}`}><line x1="12" y1="105" x2="288" y2="105" /><polyline points={points} />{points.split(' ').map((point, index) => { const [cx, cy] = point.split(','); return <circle key={`${point}-${index}`} cx={cx} cy={cy} r="4" /> })}</svg>
}

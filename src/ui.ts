import type { ExerciseLog } from './types'

export const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
export const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function prescriptionLabel(sets: number, min: number, max: number, seconds?: number): string {
  if (seconds) return `${sets} × ${seconds}s`
  return min === max ? `${sets} × ${min}` : `${sets} × ${min}–${max}`
}

export function exerciseScheme(exercise: ExerciseLog): string {
  if (exercise.progressionType === 'timed') return `${exercise.sets.length} × ${exercise.sets[0]?.targetSeconds ?? 0}s`
  const same = exercise.sets.every((set) => set.minReps === exercise.sets[0].minReps && set.maxReps === exercise.sets[0].maxReps)
  if (same) return prescriptionLabel(exercise.sets.length, exercise.sets[0].minReps, exercise.sets[0].maxReps)
  return exercise.sets.map((set) => `${set.minReps}${set.plusSet ? '+' : ''}`).join(' / ')
}

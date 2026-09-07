import { EXERCISES } from './program'
import type { ExerciseLog, WorkoutSession } from './types'

export interface ExerciseVolume {
  warmupLb: number
  workingLb: number
  totalLb: number
}

export function exerciseVolume(exercise: ExerciseLog, bodyweightLb: number): ExerciseVolume {
  if (exercise.skipped) return { warmupLb: 0, workingLb: 0, totalLb: 0 }
  const definition = EXERCISES[exercise.exerciseId]
  const warmupLb = exercise.warmupSets.reduce((total, set) => total + (set.complete ? set.weightLb * set.reps : 0), 0)
  const workingLb = exercise.sets.reduce((total, set) => {
    if (!set.complete || !set.reps) return total
    const externalWeight = set.weightLb ?? 0
    const liftedWeight = definition?.weightMode === 'bodyweight' ? bodyweightLb + externalWeight : externalWeight
    return total + liftedWeight * set.reps
  }, 0)
  return { warmupLb, workingLb, totalLb: warmupLb + workingLb }
}

export function sessionVolumeLb(session: WorkoutSession): number {
  return session.exercises.reduce((total, exercise) => total + exerciseVolume(exercise, session.bodyweightLb).totalLb, 0)
}

export function displayVolume(volumeLb: number, unit: 'lb' | 'kg'): string {
  const converted = unit === 'kg' ? volumeLb * 0.45359237 : volumeLb
  return `${Math.round(converted).toLocaleString()} ${unit}`
}

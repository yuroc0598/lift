import { roundToIncrement } from './lifting'
import type { ExerciseProgress, WorkoutSession } from './types'

export function applyProgression(
  progress: Record<string, ExerciseProgress>,
  workout: WorkoutSession,
): Record<string, ExerciseProgress> {
  const next = structuredClone(progress)
  const grouped = new Map<string, WorkoutSession['exercises']>()

  for (const log of workout.exercises) {
    if (log.skipped || !log.advanceProgression || log.progressionType === 'timed') continue
    const logs = grouped.get(log.progressionKey) ?? []
    logs.push(log)
    grouped.set(log.progressionKey, logs)
  }

  for (const [progressionKey, logs] of grouped) {
    const first = logs[0]
    const current = next[progressionKey] ?? { workingWeightLb: first.baseWeightLb, consecutiveFailures: 0 }
    const performedWeights = logs.flatMap((log) => {
      if (log.baseWeightLb != null && Number.isFinite(log.baseWeightLb)) return [log.baseWeightLb]
      return log.sets.map((set) => set.weightLb).filter((weight): weight is number => weight != null && Number.isFinite(weight))
    })
    const performedWeight = performedWeights.length ? Math.max(...performedWeights) : current.workingWeightLb
    const allSetsComplete = logs.every((log) => log.sets.every((set) => set.complete && (set.reps ?? 0) >= set.minReps))
    const effortAcceptable = logs.every((log) => log.sets.every((set) => set.rpe == null || set.rpe <= log.targetRpe))
    const canIncrease = effortAcceptable && logs.every((log) => log.progressionType === 'fixed' || log.sets.every((set) => set.complete && (set.reps ?? 0) >= set.maxReps))

    if (!allSetsComplete) {
      const failures = current.consecutiveFailures + 1
      next[progressionKey] = failures >= 2 && performedWeight != null
        ? { workingWeightLb: roundToIncrement(performedWeight * 0.925, first.incrementLb || 5), consecutiveFailures: 0 }
        : { workingWeightLb: performedWeight, consecutiveFailures: failures }
      continue
    }

    next[progressionKey] = {
      workingWeightLb: performedWeight == null
        ? null
        : canIncrease ? performedWeight + first.incrementLb : performedWeight,
      consecutiveFailures: 0,
    }
  }

  return next
}

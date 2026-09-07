import { describe, expect, it } from 'vitest'
import { applyProgression } from './progression'
import { createInitialState, createWorkout } from './program'
import type { WorkoutSession } from './types'

function completeExercise(workout: WorkoutSession, id: string, options: { reps?: number; rpe?: number } = {}) {
  const exercise = workout.exercises.find((item) => item.exerciseId === id)!
  exercise.sets.forEach((set) => {
    set.complete = true
    set.reps = options.reps ?? set.maxReps
    set.rpe = options.rpe ?? exercise.targetRpe
  })
}

describe('progression', () => {
  it('adds weight after successful fixed-rep work at target effort', () => {
    const state = createInitialState()
    const workout = createWorkout(state)
    completeExercise(workout, 'squat', { reps: 5, rpe: 8 })
    const progress = state.programStates[state.activeProgramId].progress
    expect(applyProgression(progress, workout).squat).toEqual({ workingWeightLb: 210, consecutiveFailures: 0 })
  })

  it('holds weight when RPE exceeds the target', () => {
    const state = createInitialState()
    const workout = createWorkout(state)
    completeExercise(workout, 'bench', { reps: 5, rpe: 9 })
    expect(applyProgression(state.programStates[state.activeProgramId].progress, workout).bench.workingWeightLb).toBe(185)
  })

  it('requires the top of a rep range before adding weight', () => {
    const state = createInitialState()
    state.programStates[state.activeProgramId].nextWorkoutIndex = 1
    const workout = createWorkout(state)
    completeExercise(workout, 'pull-up', { reps: 6, rpe: 8 })
    const progress = state.programStates[state.activeProgramId].progress
    expect(applyProgression(progress, workout)['pull-up'].workingWeightLb).toBe(0)
    completeExercise(workout, 'pull-up', { reps: 10, rpe: 8 })
    expect(applyProgression(progress, workout)['pull-up'].workingWeightLb).toBe(5)
  })

  it('adds external weight to knee raises after reaching the top of the rep range', () => {
    const state = createInitialState()
    const workout = createWorkout(state)
    completeExercise(workout, 'knee-raise', { reps: 15, rpe: 9 })
    const progress = state.programStates[state.activeProgramId].progress
    expect(applyProgression(progress, workout)['knee-raise'].workingWeightLb).toBe(5)
  })

  it('deloads 7.5 percent after two consecutive misses', () => {
    const state = createInitialState()
    const workout = createWorkout(state)
    const afterOne = applyProgression(state.programStates[state.activeProgramId].progress, workout)
    expect(afterOne.squat).toEqual({ workingWeightLb: 205, consecutiveFailures: 1 })
    const afterTwo = applyProgression(afterOne, workout)
    expect(afterTwo.squat).toEqual({ workingWeightLb: 190, consecutiveFailures: 0 })
  })

  it('does not penalize a deliberately skipped exercise', () => {
    const state = createInitialState()
    const workout = createWorkout(state)
    workout.exercises.find((item) => item.exerciseId === 'lateral-raise')!.skipped = true
    const progress = state.programStates[state.activeProgramId].progress
    expect(applyProgression(progress, workout)['lateral-raise']).toEqual(progress['lateral-raise'])
  })

  it('counts repeated instances of one lift as one progression result per workout', () => {
    const state = createInitialState()
    const workout = createWorkout(state)
    const secondSquat = structuredClone(workout.exercises.find((exercise) => exercise.exerciseId === 'squat')!)
    secondSquat.logId = 'squat-backoff'
    workout.exercises.push(secondSquat)
    expect(applyProgression(state.programStates[state.activeProgramId].progress, workout).squat).toEqual({ workingWeightLb: 205, consecutiveFailures: 1 })
  })
})

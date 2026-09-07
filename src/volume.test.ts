import { describe, expect, it } from 'vitest'
import { createInitialState, createWorkout } from './program'
import { exerciseVolume, sessionVolumeLb } from './volume'

describe('workout volume', () => {
  it('includes completed warm-ups, working sets, and bodyweight loading', () => {
    const state = createInitialState()
    const session = createWorkout(state)
    const squat = session.exercises.find((exercise) => exercise.exerciseId === 'squat')!
    squat.warmupSets[0].complete = true
    squat.sets[0].complete = true
    const pullUp = createWorkout({ ...state, programStates: { ...state.programStates, 'personal-powerlifting': { ...state.programStates['personal-powerlifting'], nextWorkoutIndex: 1 } } }).exercises.find((exercise) => exercise.exerciseId === 'pull-up')!
    pullUp.sets[0].complete = true
    session.exercises.push(pullUp)

    expect(exerciseVolume(squat, 150)).toEqual({ warmupLb: 360, workingLb: 1025, totalLb: 1385 })
    expect(exerciseVolume(pullUp, 150).totalLb).toBe(900)
    expect(sessionVolumeLb(session)).toBe(2285)
  })
})

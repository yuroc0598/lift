import { describe, expect, it } from 'vitest'
import { advanceRuntime, BUILT_IN_PROGRAMS, createInitialState, createProgramRuntime, createWorkout, getProgram, normalizeProgramRuntime } from './program'

describe('program library', () => {
  it('ships five distinct programs', () => {
    expect(BUILT_IN_PROGRAMS.map((program) => program.id)).toEqual([
      'personal-powerlifting', 'classic-5x5', 'texas-method', 'madcow-5x5', '531-rolling',
    ])
  })

  it('seeds supplied working weights in the personal plan', () => {
    const state = createInitialState()
    const progress = state.programStates['personal-powerlifting'].progress
    expect(state.settings.bodyweightLb).toBe(150)
    expect(progress.bench.workingWeightLb).toBe(185)
    expect(progress.squat.workingWeightLb).toBe(205)
    expect(progress.deadlift.workingWeightLb).toBe(225)
    expect(progress.row.workingWeightLb).toBe(115)
    expect(progress.ohp.workingWeightLb).toBe(75)
  })

  it('prescribes three sets of five for the personal deadlift', () => {
    const deadlift = BUILT_IN_PROGRAMS[0].workouts[1].prescriptions.find((item) => item.exerciseId === 'deadlift')
    expect(deadlift).toMatchObject({ sets: 3, minReps: 5, maxReps: 5 })
  })

  it('uses five sets of five for the personal primary lifts', () => {
    const personal = BUILT_IN_PROGRAMS[0]
    for (const id of ['squat', 'bench', 'row']) expect(personal.workouts[0].prescriptions.find((item) => item.exerciseId === id)).toMatchObject({ sets: 5, minReps: 5, maxReps: 5 })
    for (const id of ['pause-squat', 'pause-bench']) expect(personal.workouts[2].prescriptions.find((item) => item.exerciseId === id)).toMatchObject({ sets: 5, minReps: 5, maxReps: 5 })
  })

  it('normalizes a saved workout cursor after a custom program is shortened', () => {
    const program = { ...BUILT_IN_PROGRAMS[0], workouts: BUILT_IN_PROGRAMS[0].workouts.slice(0, 2) }
    const runtime = createProgramRuntime(program)
    runtime.nextWorkoutIndex = 5
    expect(normalizeProgramRuntime(program, runtime).nextWorkoutIndex).toBe(1)
  })

  it('rotates feet-up and incline bench on successive B workouts', () => {
    const state = createInitialState()
    state.programStates['personal-powerlifting'].nextWorkoutIndex = 1
    expect(createWorkout(state).exercises.some((item) => item.exerciseId === 'feet-up-bench')).toBe(true)
    state.programStates['personal-powerlifting'].nextWorkoutIndex = 4
    expect(createWorkout(state).exercises.some((item) => item.exerciseId === 'incline-bench')).toBe(true)
  })

  it('creates Texas volume and recovery percentages', () => {
    const state = createInitialState()
    state.activeProgramId = 'texas-method'
    let session = createWorkout(state)
    expect(session.exercises.find((item) => item.exerciseId === 'squat')!.sets[0].weightLb).toBe(185)
    state.programStates['texas-method'].nextWorkoutIndex = 1
    session = createWorkout(state)
    expect(session.exercises.find((item) => item.exerciseId === 'squat')!.sets[0].weightLb).toBe(150)
  })

  it('creates ramped Madcow work and its Friday triple/back-off', () => {
    const state = createInitialState()
    state.activeProgramId = 'madcow-5x5'
    state.programStates['madcow-5x5'].nextWorkoutIndex = 2
    const squat = createWorkout(state).exercises.find((item) => item.exerciseId === 'squat')!
    expect(squat.sets.map((set) => set.reps)).toEqual([5, 5, 5, 5, 3, 8])
    expect(squat.sets[4].weightLb).toBe(210)
    expect(squat.sets[5].weightLb).toBe(155)
  })

  it('raises 5/3/1 training maxes only when a full cycle wraps', () => {
    const state = createInitialState()
    const program = getProgram(state, '531-rolling')
    const runtime = createProgramRuntime(program)
    runtime.nextWorkoutIndex = program.workouts.length - 1
    const advanced = advanceRuntime(program, runtime, runtime.progress)
    expect(advanced.nextWorkoutIndex).toBe(0)
    expect(advanced.progress.squat.workingWeightLb).toBe(225)
    expect(advanced.progress.deadlift.workingWeightLb).toBe(245)
    expect(advanced.progress.bench.workingWeightLb).toBe(200)
    expect(advanced.progress.ohp.workingWeightLb).toBe(85)
  })
})

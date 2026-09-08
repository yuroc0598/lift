import { beforeEach, describe, expect, it } from 'vitest'
import { clearStoredState, loadState, persistActiveDraft, saveState } from './db'
import { createInitialState, createWorkout } from './program'

describe('IndexedDB storage', () => {
  beforeEach(async () => {
    await clearStoredState()
  })

  it('returns personalized defaults when no state is stored', async () => {
    const state = await loadState()
    expect(state.settings.bodyweightLb).toBe(150)
    expect(state.programStates['personal-powerlifting'].progress.deadlift.workingWeightLb).toBe(225)
  })

  it('persists and restores workout state', async () => {
    const state = createInitialState()
    state.programStates['personal-powerlifting'].nextWorkoutIndex = 2
    state.settings.bodyweightLb = 151.5
    state.activeSession = createWorkout(state, new Date('2026-09-07T16:00:00.000Z'))
    state.activeSession.exercises[0].sets[0].complete = true
    state.restTimerEnd = '2026-09-07T16:03:00.000Z'
    await saveState(state)
    const restored = await loadState()
    expect(restored.programStates['personal-powerlifting'].nextWorkoutIndex).toBe(2)
    expect(restored.settings.bodyweightLb).toBe(151.5)
    expect(restored.activeSession?.exercises[0].sets[0].complete).toBe(true)
    expect(restored.restTimerEnd).toBe('2026-09-07T16:03:00.000Z')
  })

  it('recovers the latest in-progress draft if IndexedDB did not finish writing', async () => {
    await saveState(createInitialState())
    const draft = createInitialState()
    draft.activeSession = createWorkout(draft, new Date('2026-09-07T16:00:00.000Z'))
    draft.activeSession.exercises[0].sets[0].reps = 4
    draft.activeSession.exercises[0].sets[0].complete = true
    persistActiveDraft(draft)

    const restored = await loadState()
    expect(restored.activeSession?.startedAt).toBe('2026-09-07T16:00:00.000Z')
    expect(restored.activeSession?.exercises[0].sets[0]).toMatchObject({ reps: 4, complete: true })
  })

  it('migrates version-one local data into the personal program', async () => {
    const legacy = {
      schemaVersion: 1,
      nextDay: 'C',
      progress: { bench: { workingWeightLb: 195, consecutiveFailures: 0 } },
      history: [],
      activeSession: null,
      restTimerEnd: null,
      settings: { bodyweightLb: 152 },
    }
    await saveState(legacy as unknown as ReturnType<typeof createInitialState>)
    const restored = await loadState()
    expect(restored.schemaVersion).toBe(2)
    expect(restored.activeProgramId).toBe('personal-powerlifting')
    expect(restored.programStates['personal-powerlifting'].nextWorkoutIndex).toBe(2)
    expect(restored.programStates['personal-powerlifting'].progress.bench.workingWeightLb).toBe(195)
    expect(restored.settings.bodyweightLb).toBe(152)
  })

  it('repairs older version-two sessions before rendering them', async () => {
    const state = createInitialState()
    state.activeSession = createWorkout(state, new Date('2026-09-07T16:00:00.000Z'))
    delete (state.activeSession.exercises[0] as Partial<typeof state.activeSession.exercises[number]>).logId
    delete (state.activeSession.exercises[0] as Partial<typeof state.activeSession.exercises[number]>).warmupSets
    const kneeRaise = state.activeSession.exercises.find((exercise) => exercise.exerciseId === 'knee-raise')!
    kneeRaise.baseWeightLb = null
    kneeRaise.incrementLb = 0
    await saveState(state)

    const restored = await loadState()
    expect(restored.activeSession?.exercises[0].logId).toBe('squat-1')
    expect(restored.activeSession?.exercises[0].warmupSets).toHaveLength(4)
    expect(restored.activeSession?.exercises.find((exercise) => exercise.exerciseId === 'knee-raise')).toMatchObject({ baseWeightLb: 0, incrementLb: 5 })
  })

  it('rejects malformed nested state instead of returning render-breaking data', async () => {
    const state = createInitialState()
    state.activeProgramId = 'custom-broken'
    state.customPrograms = [{ id: 'custom-broken', workouts: [] } as unknown as typeof state.customPrograms[number]]
    state.programStates['personal-powerlifting'].nextWorkoutIndex = Number.POSITIVE_INFINITY
    state.settings = { ...state.settings, unit: 'invalid' as 'lb', platesLb: [45, Number.POSITIVE_INFINITY] }
    state.activeSession = createWorkout(createInitialState())
    state.activeSession.exercises[0].sets = [null as never]
    await saveState(state)

    const restored = await loadState()
    expect(restored.activeProgramId).toBe('personal-powerlifting')
    expect(restored.customPrograms).toEqual([])
    expect(restored.programStates['personal-powerlifting'].nextWorkoutIndex).toBe(0)
    expect(restored.settings).toMatchObject({ unit: 'lb', platesLb: [45] })
    expect(restored.activeSession?.exercises[0].sets[0]).toMatchObject({ number: 1, complete: false })
  })
})

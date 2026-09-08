import { describe, expect, it } from 'vitest'
import { backupToState, stateToBackup } from './backup'
import { createInitialState, createWorkout, suggestedCustomProgram } from './program'

describe('full app backup', () => {
  it('round-trips history, program state, settings, custom programs, and an active workout', () => {
    const state = createInitialState()
    state.settings.bodyweightLb = 157.5
    state.settings.platesLb = [45, 25, 10, 2.5]
    state.programStates['personal-powerlifting'].completedWorkouts = 7
    state.customPrograms.push(suggestedCustomProgram('Meet Prep'))
    const completed = createWorkout(state, new Date('2026-09-05T16:00:00.000Z'))
    completed.completedAt = '2026-09-05T17:00:00.000Z'
    completed.exercises[0].warmupSets[0].complete = true
    state.history = [completed]
    state.activeSession = createWorkout(state, new Date('2026-09-07T16:00:00.000Z'))
    state.activeSession.exercises[0].sets[0].complete = true
    state.activeSession.notes = 'Resume here'
    state.restTimerEnd = '2026-09-07T16:03:00.000Z'

    const restored = backupToState(stateToBackup(state))

    expect(restored.settings).toMatchObject({ bodyweightLb: 157.5, platesLb: [45, 25, 10, 2.5] })
    expect(restored.programStates['personal-powerlifting'].completedWorkouts).toBe(7)
    expect(restored.customPrograms[0].name).toBe('Meet Prep')
    expect(restored.history[0].exercises[0].warmupSets[0].complete).toBe(true)
    expect(restored.activeSession).toMatchObject({ startedAt: '2026-09-07T16:00:00.000Z', notes: 'Resume here' })
    expect(restored.activeSession?.exercises[0].sets[0].complete).toBe(true)
    expect(restored.restTimerEnd).toBe('2026-09-07T16:03:00.000Z')
  })

  it('rejects unrelated or unsupported JSON files', () => {
    expect(() => backupToState('{"hello":"world"}')).toThrow('not supported')
    expect(() => backupToState('not json')).toThrow('not a valid Lift backup')
  })
})

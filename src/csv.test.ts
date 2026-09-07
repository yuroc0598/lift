import { describe, expect, it } from 'vitest'
import { csvToHistory, historyToCsv, parseCsv } from './csv'
import { createInitialState, createWorkout } from './program'

describe('CSV backup', () => {
  it('handles commas, quotes, and newlines', () => {
    expect(parseCsv('a,b\r\n"hello, world","say ""hi"""\r\n"two\nlines",ok')).toEqual([
      ['a', 'b'],
      ['hello, world', 'say "hi"'],
      ['two\nlines', 'ok'],
    ])
  })

  it('round-trips complete workout history without losing set data', () => {
    const workout = createWorkout(createInitialState(), new Date('2026-09-07T16:00:00.000Z'))
    workout.id = 'session-1'
    workout.completedAt = '2026-09-07T17:02:03.000Z'
    workout.notes = 'Good session, "strong"\nNo pain.'
    workout.exercises[0].notes = 'Depth, controlled'
    workout.exercises[0].warmupSets[0] = { ...workout.exercises[0].warmupSets[0], reps: 10, complete: true }
    workout.exercises[0].sets[0] = { ...workout.exercises[0].sets[0], reps: 5, rpe: 7.5, complete: true }
    const csv = historyToCsv([workout])
    expect(csv).toContain('session_volume_lb')
    expect(csv).toContain(',warmup,')
    const restored = csvToHistory(csv)
    expect(restored).toEqual([workout])
  })

  it('rejects unrelated CSV files with a useful error', () => {
    expect(() => csvToHistory('name,value\nfoo,1')).toThrow('Missing CSV column')
  })

  it('preserves repeated exercises as separate entries', () => {
    const workout = createWorkout(createInitialState(), new Date('2026-09-07T16:00:00.000Z'))
    workout.completedAt = '2026-09-07T17:00:00.000Z'
    const secondBench = structuredClone(workout.exercises[1])
    secondBench.logId = 'bench-variation-2'
    secondBench.name = 'Competition Bench Press — Back-off'
    workout.exercises.splice(2, 0, secondBench)
    const restored = csvToHistory(historyToCsv([workout]))[0]
    const benchEntries = restored.exercises.filter((exercise) => exercise.exerciseId === 'bench')
    expect(benchEntries).toHaveLength(2)
    expect(benchEntries.map((exercise) => exercise.name)).toEqual(['Competition Bench Press', 'Competition Bench Press — Back-off'])
  })
})

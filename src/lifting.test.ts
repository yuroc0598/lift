import { describe, expect, it } from 'vitest'
import { calculatePlates, completedSetCount, displayWeight, estimatedOneRepMax, MAX_SUPPORTED_WEIGHT_LB, parseWeightInput, warmupSets } from './lifting'

describe('lifting utilities', () => {
  it('calculates plates on each side of a 45 lb bar', () => {
    expect(calculatePlates(225, 45, [45, 35, 25, 10, 5, 2.5])).toEqual({
      plates: [45, 45],
      actualWeight: 225,
      exact: true,
    })
  })

  it('reports the nearest load when available plates cannot match', () => {
    expect(calculatePlates(137, 45, [45, 10, 5, 2.5])).toMatchObject({ actualWeight: 135, exact: false })
  })

  it('finds exact combinations that a greedy plate algorithm misses', () => {
    expect(calculatePlates(57, 45, [4, 3])).toEqual({ plates: [3, 3], actualWeight: 57, exact: true })
  })

  it('rejects non-finite weight input and formats pounds without trailing decimals', () => {
    expect(parseWeightInput('abc', 'lb')).toBeNull()
    expect(parseWeightInput('1e999', 'lb')).toBeNull()
    expect(parseWeightInput('100', 'kg')).toBeCloseTo(220.462, 2)
    expect(displayWeight(205, 'lb')).toBe('205 lb')
  })

  it('bounds unrealistic weights before running the plate solver', () => {
    expect(parseWeightInput(String(MAX_SUPPORTED_WEIGHT_LB + 1), 'lb')).toBeNull()
    const result = calculatePlates(999999, 45, [45, 1e12])
    expect(result.actualWeight).toBeLessThanOrEqual(MAX_SUPPORTED_WEIGHT_LB)
    expect(result.exact).toBe(false)
  })

  it('creates ascending, non-duplicated warm-up sets below working weight', () => {
    expect(warmupSets(205)).toEqual([
      { weight: 45, reps: 8 },
      { weight: 115, reps: 5 },
      { weight: 145, reps: 3 },
      { weight: 175, reps: 1 },
    ])
    expect(warmupSets(45)).toEqual([])
  })

  it('calculates Epley estimated 1RM only for completed work', () => {
    const set = { number: 1, minReps: 5, maxReps: 5, weightLb: 185, reps: 5, seconds: null, rpe: 8, complete: true }
    expect(estimatedOneRepMax(set)).toBeCloseTo(215.83, 1)
    expect(estimatedOneRepMax({ ...set, complete: false })).toBeNull()
  })

  it('does not count completed sets after an exercise is skipped', () => {
    const exercise = { skipped: true, warmupSets: [{ complete: true }], sets: [{ complete: true }, { complete: false }] }
    expect(completedSetCount(exercise as Parameters<typeof completedSetCount>[0])).toBe(0)
  })
})

import type { ExerciseLog, SetLog } from './types'

export const MAX_SUPPORTED_WEIGHT_LB = 5000

export function roundToIncrement(value: number, increment = 5): number {
  if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) return 0
  return Math.round(value / increment) * increment
}

export function displayWeight(weightLb: number | null, unit: 'lb' | 'kg'): string {
  if (weightLb == null || !Number.isFinite(weightLb)) return 'Set weight'
  const value = unit === 'kg' ? weightLb * 0.45359237 : weightLb
  return `${Number(value.toFixed(unit === 'kg' ? 1 : 1))} ${unit}`
}

export function inputWeightToLb(value: number, unit: 'lb' | 'kg'): number {
  return unit === 'kg' ? value / 0.45359237 : value
}

export function parseWeightInput(text: string, unit: 'lb' | 'kg'): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return null
  const pounds = inputWeightToLb(value, unit)
  return Number.isFinite(pounds) && pounds <= MAX_SUPPORTED_WEIGHT_LB ? pounds : null
}

export function lbToInputWeight(value: number | null, unit: 'lb' | 'kg'): number | '' {
  if (value == null) return ''
  return Number((unit === 'kg' ? value * 0.45359237 : value).toFixed(unit === 'kg' ? 1 : 1))
}

export function maximumInputWeight(unit: 'lb' | 'kg'): number {
  return unit === 'kg' ? Math.floor(MAX_SUPPORTED_WEIGHT_LB * 0.45359237 * 10) / 10 : MAX_SUPPORTED_WEIGHT_LB
}

export interface PlateResult {
  plates: number[]
  actualWeight: number
  exact: boolean
}

export function calculatePlates(targetWeight: number, barWeight: number, plates: number[]): PlateResult {
  if (!Number.isFinite(targetWeight) || !Number.isFinite(barWeight)) return { plates: [], actualWeight: Number.isFinite(barWeight) ? barWeight : 0, exact: false }
  const boundedTargetWeight = Math.min(targetWeight, MAX_SUPPORTED_WEIGHT_LB)
  const boundedBarWeight = Math.min(Math.max(barWeight, 0), MAX_SUPPORTED_WEIGHT_LB)
  const perSideTarget = Math.max(0, (boundedTargetWeight - boundedBarWeight) / 2)
  const sorted = [...new Set(plates.filter((plate) => Number.isFinite(plate) && plate > 0 && plate <= MAX_SUPPORTED_WEIGHT_LB && Math.round(plate * 100) > 0))].sort((a, b) => b - a).slice(0, 32)
  if (!sorted.length || perSideTarget === 0) return { plates: [], actualWeight: boundedBarWeight, exact: Math.abs(targetWeight - boundedBarWeight) < 0.01 }

  const scale = 100
  const coins = sorted.map((plate) => Math.round(plate * scale))
  const target = Math.round(perSideTarget * scale)
  const limit = target + Math.max(...coins)
  const counts = new Int32Array(limit + 1).fill(1_000_000)
  const previous = new Int32Array(limit + 1).fill(-1)
  counts[0] = 0
  for (let amount = 1; amount <= limit; amount += 1) {
    coins.forEach((coin, coinIndex) => {
      if (amount >= coin && counts[amount - coin] + 1 < counts[amount]) {
        counts[amount] = counts[amount - coin] + 1
        previous[amount] = coinIndex
      }
    })
  }
  let best = 0
  for (let amount = 1; amount <= limit; amount += 1) {
    if (previous[amount] < 0) continue
    const difference = Math.abs(amount - target)
    const bestDifference = Math.abs(best - target)
    if (difference < bestDifference || (difference === bestDifference && amount <= target && best > target) || (difference === bestDifference && counts[amount] < counts[best])) best = amount
  }
  const result: number[] = []
  for (let amount = best; amount > 0;) {
    const coinIndex = previous[amount]
    if (coinIndex < 0) break
    result.push(sorted[coinIndex])
    amount -= coins[coinIndex]
  }
  result.sort((a, b) => b - a)
  const loaded = best / scale
  const actualWeight = boundedBarWeight + loaded * 2
  return { plates: result, actualWeight, exact: Math.abs(actualWeight - targetWeight) < 0.01 }
}

export function warmupSets(workingWeight: number, barWeight = 45): Array<{ weight: number; reps: number }> {
  if (workingWeight <= barWeight) return []
  const raw = [
    { percentage: 0, reps: 8 },
    { percentage: 0.55, reps: 5 },
    { percentage: 0.7, reps: 3 },
    { percentage: 0.85, reps: 1 },
  ]
  const sets = raw.map(({ percentage, reps }) => ({
    weight: percentage === 0 ? barWeight : Math.max(barWeight, roundToIncrement(workingWeight * percentage, 5)),
    reps,
  }))
  return sets.filter((set, index) => set.weight < workingWeight && (index === 0 || set.weight !== sets[index - 1].weight))
}

export function estimatedOneRepMax(set: SetLog): number | null {
  if (!set.complete || set.weightLb == null || !set.reps || set.reps < 1) return null
  return set.weightLb * (1 + set.reps / 30)
}

export function completedSetCount(exercise: ExerciseLog): number {
  return exercise.skipped ? 0 : exercise.warmupSets.filter((set) => set.complete).length + exercise.sets.filter((set) => set.complete).length
}

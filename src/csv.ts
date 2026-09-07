import { EXERCISES } from './program'
import type { ExerciseLog, ProgressionType, SetLog, WorkoutSession } from './types'
import { sessionVolumeLb } from './volume'

const HEADERS = [
  'version', 'session_id', 'program_id', 'program_name', 'program_version', 'workout_index',
  'started_at', 'completed_at', 'day', 'workout', 'variation',
  'session_notes', 'duration_seconds', 'session_volume_lb', 'bodyweight_lb', 'exercise_id', 'exercise',
  'exercise_order', 'exercise_instance_id', 'exercise_notes', 'exercise_skipped', 'target_rpe', 'rest_seconds',
  'optional', 'progression_key', 'progression_type', 'increment_lb', 'base_weight_lb',
  'advance_progression', 'set_type', 'set_number', 'min_reps', 'max_reps', 'target_seconds',
  'plus_set', 'weight_lb', 'reps', 'seconds', 'rpe', 'complete',
] as const

const REQUIRED_HEADERS = ['session_id', 'started_at', 'completed_at', 'day', 'workout', 'exercise_id', 'exercise', 'set_number', 'min_reps', 'max_reps', 'weight_lb', 'reps', 'complete'] as const

function escapeCsv(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function historyToCsv(history: WorkoutSession[]): string {
  const rows: string[][] = [Array.from(HEADERS)]
  for (const session of [...history].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const duration = session.completedAt
      ? Math.max(0, Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 1000))
      : ''
    session.exercises.forEach((exercise, exerciseIndex) => {
      const exportedSets: Array<{ type: 'warmup' | 'working'; set: SetLog }> = [
        ...exercise.warmupSets.map((warmup) => ({ type: 'warmup' as const, set: { number: warmup.number, minReps: warmup.reps, maxReps: warmup.reps, weightLb: warmup.weightLb, reps: warmup.reps, seconds: null, rpe: null, complete: warmup.complete } })),
        ...exercise.sets.map((set) => ({ type: 'working' as const, set })),
      ]
      exportedSets.forEach(({ type, set }) => {
        rows.push([
          '3', session.id, session.programId, session.programName, String(session.programVersion), String(session.workoutIndex),
          session.startedAt, session.completedAt ?? '', session.day, session.name,
          session.variation ?? '', session.notes, String(duration), String(sessionVolumeLb(session)), String(session.bodyweightLb),
          exercise.exerciseId, exercise.name, String(exerciseIndex + 1), exercise.logId, exercise.notes,
          String(exercise.skipped), String(exercise.targetRpe), String(exercise.restSeconds),
          String(exercise.optional), exercise.progressionKey, exercise.progressionType, String(exercise.incrementLb),
          exercise.baseWeightLb == null ? '' : String(exercise.baseWeightLb), String(exercise.advanceProgression), type,
          String(set.number), String(set.minReps), String(set.maxReps),
          set.targetSeconds == null ? '' : String(set.targetSeconds),
          set.plusSet == null ? '' : String(set.plusSet),
          set.weightLb == null ? '' : String(set.weightLb), set.reps == null ? '' : String(set.reps),
          set.seconds == null ? '' : String(set.seconds), set.rpe == null ? '' : String(set.rpe),
          String(set.complete),
        ])
      })
    })
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted value.')
  return rows
}

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`Invalid number in CSV: ${value}`)
  return number
}

export function csvToHistory(text: string): WorkoutSession[] {
  const rows = parseCsv(text)
  if (!rows.length) throw new Error('The CSV is empty.')
  const headerIndex = Object.fromEntries(rows[0].map((header, index) => [header, index]))
  for (const required of REQUIRED_HEADERS) {
    if (headerIndex[required] == null) throw new Error(`Missing CSV column: ${required}`)
  }
  const value = (row: string[], name: typeof HEADERS[number]) => headerIndex[name] == null ? '' : row[headerIndex[name]] ?? ''
  const sessions = new Map<string, WorkoutSession & { exerciseMap: Map<string, ExerciseLog> }>()

  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim() === '')) continue
    const id = value(row, 'session_id')
    const day = value(row, 'day')
    if (!id || !day) throw new Error('CSV contains an invalid session ID or workout day.')
    let session = sessions.get(id)
    if (!session) {
      session = {
        id,
        programId: value(row, 'program_id') || 'personal-powerlifting',
        programName: value(row, 'program_name') || 'Personal Powerlifting',
        programVersion: numberOrNull(value(row, 'program_version')) ?? 1,
        workoutIndex: numberOrNull(value(row, 'workout_index')) ?? 0,
        day,
        name: value(row, 'workout'),
        variation: value(row, 'variation') || null,
        startedAt: value(row, 'started_at'),
        completedAt: value(row, 'completed_at') || null,
        bodyweightLb: numberOrNull(value(row, 'bodyweight_lb')) ?? 0,
        notes: value(row, 'session_notes'),
        exercises: [],
        exerciseMap: new Map(),
      }
      sessions.set(id, session)
    }
    const exerciseId = value(row, 'exercise_id')
    const exerciseOrder = value(row, 'exercise_order')
    const exerciseMapKey = value(row, 'exercise_instance_id') || (exerciseOrder ? `${exerciseId}:${exerciseOrder}` : exerciseId)
    let exercise = session.exerciseMap.get(exerciseMapKey)
    if (!exercise) {
      const definition = EXERCISES[exerciseId]
      exercise = {
        logId: value(row, 'exercise_instance_id') || `${exerciseId}-${exerciseOrder || session.exercises.length + 1}`,
        exerciseId,
        name: value(row, 'exercise'),
        progressionKey: value(row, 'progression_key') || exerciseId,
        progressionType: (value(row, 'progression_type') || definition?.progression || 'fixed') as ProgressionType,
        incrementLb: numberOrNull(value(row, 'increment_lb')) ?? definition?.incrementLb ?? 5,
        baseWeightLb: numberOrNull(value(row, 'base_weight_lb')),
        advanceProgression: value(row, 'advance_progression') === '' || value(row, 'advance_progression') === 'true',
        targetRpe: numberOrNull(value(row, 'target_rpe')) ?? 8,
        restSeconds: numberOrNull(value(row, 'rest_seconds')) ?? 0,
        optional: value(row, 'optional') === 'true',
        skipped: value(row, 'exercise_skipped') === 'true',
        notes: value(row, 'exercise_notes'),
        warmupSets: [],
        sets: [],
      }
      session.exerciseMap.set(exerciseMapKey, exercise)
      session.exercises.push(exercise)
    }
    const set: SetLog = {
      number: numberOrNull(value(row, 'set_number')) ?? exercise.sets.length + 1,
      minReps: numberOrNull(value(row, 'min_reps')) ?? 0,
      maxReps: numberOrNull(value(row, 'max_reps')) ?? 0,
      targetSeconds: numberOrNull(value(row, 'target_seconds')) ?? undefined,
      plusSet: value(row, 'plus_set') === '' ? undefined : value(row, 'plus_set') === 'true',
      weightLb: numberOrNull(value(row, 'weight_lb')),
      reps: numberOrNull(value(row, 'reps')),
      seconds: numberOrNull(value(row, 'seconds')),
      rpe: numberOrNull(value(row, 'rpe')),
      complete: value(row, 'complete') === 'true',
    }
    if (value(row, 'set_type') === 'warmup') {
      if (set.weightLb != null) exercise.warmupSets.push({ number: set.number, weightLb: set.weightLb, reps: set.reps ?? set.maxReps, complete: set.complete })
    } else exercise.sets.push(set)
  }

  return Array.from(sessions.values())
    .map(({ exerciseMap: _exerciseMap, ...session }) => session)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

import { MAX_SUPPORTED_WEIGHT_LB, warmupSets as buildWarmupSets } from './lifting'
import { BUILT_IN_PROGRAMS, createInitialState, createProgramRuntime, EXERCISES, MAX_CUSTOM_EXERCISES, MAX_CUSTOM_REPS, MAX_CUSTOM_SETS, MAX_CUSTOM_WORKOUTS, normalizeProgramRuntime } from './program'
import type { AppState, ExerciseLog, ProgramDefinition, ProgramRuntime, SetLog, WorkoutSession } from './types'

const DB_NAME = 'lift-local'
const STORE_NAME = 'app-state'
const STATE_KEY = 'primary'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isValidCustomProgram(value: unknown): value is ProgramDefinition {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.startsWith('custom-') || typeof value.name !== 'string' || typeof value.shortName !== 'string' || typeof value.description !== 'string' || typeof value.level !== 'string' || typeof value.schedule !== 'string' || typeof value.color !== 'string' || !finiteInRange(value.version, 1, 1_000_000) || !Array.isArray(value.workouts) || value.workouts.length < 1 || value.workouts.length > MAX_CUSTOM_WORKOUTS) return false
  if (value.initialWeights !== undefined && (!isRecord(value.initialWeights) || Object.values(value.initialWeights).some((weight) => weight !== null && !finiteInRange(weight, 0, MAX_SUPPORTED_WEIGHT_LB)))) return false
  return value.workouts.every((workout) => {
    if (!isRecord(workout) || typeof workout.id !== 'string' || typeof workout.day !== 'string' || typeof workout.name !== 'string' || typeof workout.focus !== 'string' || !Array.isArray(workout.prescriptions) || workout.prescriptions.length < 1 || workout.prescriptions.length > MAX_CUSTOM_EXERCISES) return false
    return workout.prescriptions.every((prescription) => {
      if (!isRecord(prescription) || typeof prescription.exerciseId !== 'string' || !EXERCISES[prescription.exerciseId] || !finiteInRange(prescription.targetRpe, 0, 10) || !finiteInRange(prescription.restSeconds, 0, 3600)) return false
      if (Array.isArray(prescription.setTargets)) return prescription.setTargets.length > 0 && prescription.setTargets.length <= MAX_CUSTOM_SETS && prescription.setTargets.every((target) => isRecord(target) && finiteInRange(target.minReps, 0, MAX_CUSTOM_REPS) && finiteInRange(target.maxReps, 0, MAX_CUSTOM_REPS) && target.minReps <= target.maxReps && (target.targetSeconds === undefined || finiteInRange(target.targetSeconds, 1, 3600)) && (target.weightMultiplier === undefined || finiteInRange(target.weightMultiplier, 0, 10)))
      return finiteInRange(prescription.sets, 1, MAX_CUSTOM_SETS) && finiteInRange(prescription.minReps, 0, MAX_CUSTOM_REPS) && finiteInRange(prescription.maxReps, 0, MAX_CUSTOM_REPS) && prescription.minReps <= prescription.maxReps
    })
  })
}

function normalizeRuntime(program: ProgramDefinition, value: unknown): ProgramRuntime {
  const defaults = createProgramRuntime(program)
  if (!isRecord(value)) return defaults
  const rawProgress = isRecord(value.progress) ? value.progress : {}
  const progress = Object.fromEntries(Object.entries(defaults.progress).map(([id, fallback]) => {
    const saved = isRecord(rawProgress[id]) ? rawProgress[id] : {}
    const workingWeightLb = saved.workingWeightLb === null || finiteInRange(saved.workingWeightLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? saved.workingWeightLb as number | null : fallback.workingWeightLb
    const consecutiveFailures = finiteInRange(saved.consecutiveFailures, 0, 100) ? Math.floor(saved.consecutiveFailures) : fallback.consecutiveFailures
    return [id, { workingWeightLb, consecutiveFailures }]
  }))
  return normalizeProgramRuntime(program, {
    nextWorkoutIndex: finiteInRange(value.nextWorkoutIndex, 0, Number.MAX_SAFE_INTEGER) ? value.nextWorkoutIndex : 0,
    completedWorkouts: finiteInRange(value.completedWorkouts, 0, Number.MAX_SAFE_INTEGER) ? Math.floor(value.completedWorkouts) : 0,
    completedCycles: finiteInRange(value.completedCycles, 0, Number.MAX_SAFE_INTEGER) ? Math.floor(value.completedCycles) : 0,
    progress,
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadState(): Promise<AppState> {
  const db = await openDatabase()
  const stored = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STATE_KEY)
    request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  const initial = createInitialState()
  if (!stored) return initial
  if (stored.schemaVersion === 2) {
    const current = stored as unknown as AppState
    const customPrograms = Array.isArray(current.customPrograms) ? current.customPrograms.filter(isValidCustomProgram) : []
    const rawProgramStates = isRecord(current.programStates) ? current.programStates : {}
    const programs = [...BUILT_IN_PROGRAMS, ...customPrograms]
    const programStates = Object.fromEntries(programs.map((program) => [program.id, normalizeRuntime(program, rawProgramStates[program.id])]))
    const activeProgramId = programs.some((program) => program.id === current.activeProgramId) ? current.activeProgramId : initial.activeProgramId
    const rawSettings: Record<string, unknown> = isRecord(stored.settings) ? stored.settings : {}
    const platesLb = Array.isArray(rawSettings.platesLb)
      ? [...new Set(rawSettings.platesLb.filter((plate): plate is number => finiteInRange(plate, 0.01, MAX_SUPPORTED_WEIGHT_LB)))].slice(0, 32)
      : initial.settings.platesLb
    const settings: AppState['settings'] = {
      unit: rawSettings.unit === 'kg' ? 'kg' : 'lb',
      bodyweightLb: finiteInRange(rawSettings.bodyweightLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? rawSettings.bodyweightLb : initial.settings.bodyweightLb,
      barWeightLb: finiteInRange(rawSettings.barWeightLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? rawSettings.barWeightLb : initial.settings.barWeightLb,
      platesLb,
      defaultRestSeconds: finiteInRange(rawSettings.defaultRestSeconds, 0, 3600) ? rawSettings.defaultRestSeconds : initial.settings.defaultRestSeconds,
      autoStartRest: typeof rawSettings.autoStartRest === 'boolean' ? rawSettings.autoStartRest : initial.settings.autoStartRest,
      persistentStorageRequested: typeof rawSettings.persistentStorageRequested === 'boolean' ? rawSettings.persistentStorageRequested : false,
    }
    const history = Array.isArray(current.history) ? current.history.filter((session) => session && typeof session === 'object').map((session) => migrateSession(session as unknown as Record<string, unknown>)) : []
    const activeSession = current.activeSession && typeof current.activeSession === 'object' ? migrateSession(current.activeSession as unknown as Record<string, unknown>, true, settings.barWeightLb) : null
    const restTimerEnd = typeof current.restTimerEnd === 'string' && Number.isFinite(Date.parse(current.restTimerEnd)) ? current.restTimerEnd : null
    return { ...initial, activeProgramId, programStates, customPrograms, history, activeSession, restTimerEnd, settings }
  }
  if (stored.schemaVersion === 1) return migrateVersionOne(stored, initial)
  return initial
}

function migrateVersionOne(stored: Record<string, unknown>, initial: AppState): AppState {
  const legacyHistory = Array.isArray(stored.history) ? stored.history as Array<Record<string, unknown>> : []
  const history = legacyHistory.map((session) => migrateSession(session))
  const completedB = history.filter((session) => session.day === 'B').length
  const legacyDay = stored.nextDay === 'B' || stored.nextDay === 'C' ? stored.nextDay : 'A'
  const nextWorkoutIndex = legacyDay === 'A' ? (completedB % 2 ? 3 : 0) : legacyDay === 'B' ? (completedB % 2 ? 4 : 1) : (completedB === 0 || completedB % 2 ? 2 : 5)
  const personal = initial.programStates['personal-powerlifting']
  personal.nextWorkoutIndex = nextWorkoutIndex
  personal.completedWorkouts = history.length
  personal.completedCycles = Math.floor(history.length / 6)
  if (stored.progress && typeof stored.progress === 'object') personal.progress = { ...personal.progress, ...(stored.progress as typeof personal.progress) }
  const legacySettings = isRecord(stored.settings) ? stored.settings : {}
  const barWeightLb = finiteInRange(legacySettings.barWeightLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? legacySettings.barWeightLb : initial.settings.barWeightLb
  return {
    ...initial,
    programStates: { ...initial.programStates, 'personal-powerlifting': personal },
    history,
    activeSession: stored.activeSession && typeof stored.activeSession === 'object' ? migrateSession(stored.activeSession as Record<string, unknown>, true, barWeightLb) : null,
    restTimerEnd: typeof stored.restTimerEnd === 'string' ? stored.restTimerEnd : null,
    settings: stored.settings && typeof stored.settings === 'object' ? { ...initial.settings, ...(stored.settings as AppState['settings']) } : initial.settings,
  }
}

function migrateSet(value: unknown, index: number): SetLog {
  const raw = isRecord(value) ? value : {}
  const minReps = finiteInRange(raw.minReps, 0, MAX_CUSTOM_REPS) ? raw.minReps : 0
  const maxReps = finiteInRange(raw.maxReps, minReps, MAX_CUSTOM_REPS) ? raw.maxReps : minReps
  return {
    number: finiteInRange(raw.number, 1, 1_000) ? Math.floor(raw.number) : index + 1,
    minReps,
    maxReps,
    targetSeconds: finiteInRange(raw.targetSeconds, 1, 86400) ? raw.targetSeconds : undefined,
    plusSet: typeof raw.plusSet === 'boolean' ? raw.plusSet : undefined,
    weightLb: raw.weightLb === null || finiteInRange(raw.weightLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? raw.weightLb as number | null : null,
    reps: raw.reps === null || finiteInRange(raw.reps, 0, 999) ? raw.reps as number | null : null,
    seconds: raw.seconds === null || finiteInRange(raw.seconds, 0, 86400) ? raw.seconds as number | null : null,
    rpe: raw.rpe === null || finiteInRange(raw.rpe, 0, 10) ? raw.rpe as number | null : null,
    complete: raw.complete === true,
  }
}

function migrateSession(raw: Record<string, unknown>, createMissingWarmups = false, barWeightLb = 45): WorkoutSession {
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : []).slice(0, 100).map((item, index) => {
    const legacy = isRecord(item) ? item as Partial<ExerciseLog> : {}
    const exerciseId = typeof legacy.exerciseId === 'string' ? legacy.exerciseId : 'unknown'
    const definition = EXERCISES[exerciseId]
    const sets = (Array.isArray(legacy.sets) ? legacy.sets : []).slice(0, 100).map(migrateSet)
    const weights = sets.map((set) => set.weightLb).filter((weight): weight is number => Number.isFinite(weight))
    const savedIncrement = finiteInRange(legacy.incrementLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? legacy.incrementLb : definition?.incrementLb ?? 5
    const progressionType = legacy.progressionType === 'range' || legacy.progressionType === 'timed' || legacy.progressionType === 'fixed' ? legacy.progressionType : definition?.progression ?? 'fixed'
    const savedWarmups = Array.isArray(legacy.warmupSets) ? legacy.warmupSets.slice(0, 20).map((value, warmupIndex) => {
      const warmup: Record<string, unknown> = isRecord(value) ? value : {}
      return {
        number: finiteInRange(warmup.number, 1, 100) ? Math.floor(warmup.number) : warmupIndex + 1,
        weightLb: finiteInRange(warmup.weightLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? warmup.weightLb : barWeightLb,
        reps: finiteInRange(warmup.reps, 0, 100) ? Math.floor(warmup.reps) : 0,
        complete: warmup.complete === true,
      }
    }) : null
    const firstWeight = weights[0] ?? null
    return {
      logId: typeof legacy.logId === 'string' ? legacy.logId : `${exerciseId}-${index + 1}`,
      exerciseId,
      name: typeof legacy.name === 'string' ? legacy.name : definition?.name ?? 'Unknown exercise',
      progressionKey: typeof legacy.progressionKey === 'string' ? legacy.progressionKey : exerciseId,
      progressionType,
      incrementLb: definition?.weightMode === 'bodyweight' && savedIncrement <= 0 ? definition.incrementLb : savedIncrement,
      baseWeightLb: finiteInRange(legacy.baseWeightLb, 0, MAX_SUPPORTED_WEIGHT_LB) ? legacy.baseWeightLb : weights.length ? Math.max(...weights) : definition?.weightMode === 'bodyweight' ? definition.startingWeightLb : null,
      advanceProgression: typeof legacy.advanceProgression === 'boolean' ? legacy.advanceProgression : true,
      targetRpe: finiteInRange(legacy.targetRpe, 0, 10) ? legacy.targetRpe : 8,
      restSeconds: finiteInRange(legacy.restSeconds, 0, 3600) ? legacy.restSeconds : 120,
      optional: legacy.optional === true,
      skipped: legacy.skipped === true,
      notes: typeof legacy.notes === 'string' ? legacy.notes : '',
      warmupSets: savedWarmups ?? (createMissingWarmups && definition?.barbell && firstWeight != null ? buildWarmupSets(firstWeight, barWeightLb).map((set, warmupIndex) => ({ number: warmupIndex + 1, weightLb: set.weight, reps: set.reps, complete: false })) : []),
      sets,
    }
  })
  return {
    ...(raw as unknown as WorkoutSession),
    id: typeof raw.id === 'string' ? raw.id : `recovered-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    programId: typeof raw.programId === 'string' ? raw.programId : 'personal-powerlifting',
    programName: typeof raw.programName === 'string' ? raw.programName : 'Personal Powerlifting',
    programVersion: finiteInRange(raw.programVersion, 1, 1_000_000) ? Math.floor(raw.programVersion) : 1,
    workoutIndex: finiteInRange(raw.workoutIndex, 0, Number.MAX_SAFE_INTEGER) ? Math.floor(raw.workoutIndex) : 0,
    day: typeof raw.day === 'string' ? raw.day : '?',
    name: typeof raw.name === 'string' ? raw.name : 'Recovered workout',
    variation: typeof raw.variation === 'string' ? raw.variation : null,
    startedAt: typeof raw.startedAt === 'string' && Number.isFinite(Date.parse(raw.startedAt)) ? raw.startedAt : new Date().toISOString(),
    completedAt: typeof raw.completedAt === 'string' && Number.isFinite(Date.parse(raw.completedAt)) ? raw.completedAt : null,
    bodyweightLb: typeof raw.bodyweightLb === 'number' && Number.isFinite(raw.bodyweightLb) ? raw.bodyweightLb : 0,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    exercises,
  }
}

export async function saveState(state: AppState): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function clearStoredState(): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(STATE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  if (navigator.storage.persisted && await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

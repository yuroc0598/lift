export type Tab = 'today' | 'history' | 'progress' | 'plan' | 'settings'
export type ProgressionType = 'fixed' | 'range' | 'timed'
export type WeightMode = 'loaded' | 'bodyweight' | 'none'

export interface ExerciseDefinition {
  id: string
  name: string
  shortName: string
  category: 'squat' | 'bench' | 'deadlift' | 'push' | 'pull' | 'arms' | 'core' | 'legs' | 'power'
  progression: ProgressionType
  weightMode: WeightMode
  startingWeightLb: number | null
  incrementLb: number
  barbell?: boolean
}

export interface SetTarget {
  minReps: number
  maxReps: number
  targetSeconds?: number
  weightMultiplier?: number
  plusSet?: boolean
}

export interface Prescription {
  exerciseId: string
  displayName?: string
  sets?: number
  minReps?: number
  maxReps?: number
  targetSeconds?: number
  setTargets?: SetTarget[]
  weightMultiplier?: number
  targetRpe: number
  restSeconds: number
  optional?: boolean
  progressionKey?: string
  advanceProgression?: boolean
}

export interface WorkoutTemplate {
  id: string
  day: string
  name: string
  focus: string
  prescriptions: Prescription[]
}

export interface ProgramDefinition {
  id: string
  name: string
  shortName: string
  description: string
  level: string
  schedule: string
  color: string
  version: number
  workouts: WorkoutTemplate[]
  initialWeights?: Record<string, number | null>
  custom?: boolean
}

export interface SetLog {
  number: number
  minReps: number
  maxReps: number
  targetSeconds?: number
  plusSet?: boolean
  weightLb: number | null
  reps: number | null
  seconds: number | null
  rpe: number | null
  complete: boolean
}

export interface WarmupSetLog {
  number: number
  weightLb: number
  reps: number
  complete: boolean
}

export interface ExerciseLog {
  logId: string
  exerciseId: string
  name: string
  progressionKey: string
  progressionType: ProgressionType
  incrementLb: number
  baseWeightLb: number | null
  advanceProgression: boolean
  targetRpe: number
  restSeconds: number
  optional: boolean
  skipped: boolean
  notes: string
  warmupSets: WarmupSetLog[]
  sets: SetLog[]
}

export interface WorkoutSession {
  id: string
  programId: string
  programName: string
  programVersion: number
  workoutIndex: number
  day: string
  name: string
  variation: string | null
  startedAt: string
  completedAt: string | null
  bodyweightLb: number
  notes: string
  exercises: ExerciseLog[]
}

export interface ExerciseProgress {
  workingWeightLb: number | null
  consecutiveFailures: number
}

export interface ProgramRuntime {
  nextWorkoutIndex: number
  completedWorkouts: number
  completedCycles: number
  progress: Record<string, ExerciseProgress>
}

export interface Settings {
  unit: 'lb' | 'kg'
  bodyweightLb: number
  barWeightLb: number
  platesLb: number[]
  defaultRestSeconds: number
  autoStartRest: boolean
  persistentStorageRequested: boolean
}

export interface AppState {
  schemaVersion: 2
  activeProgramId: string
  programStates: Record<string, ProgramRuntime>
  customPrograms: ProgramDefinition[]
  history: WorkoutSession[]
  activeSession: WorkoutSession | null
  restTimerEnd: string | null
  settings: Settings
}

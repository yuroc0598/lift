import { roundToIncrement, warmupSets as buildWarmupSets } from './lifting'
import type {
  AppState,
  ExerciseDefinition,
  ExerciseLog,
  ExerciseProgress,
  Prescription,
  ProgramDefinition,
  ProgramRuntime,
  SetTarget,
  WorkoutSession,
  WorkoutTemplate,
} from './types'

export const EXERCISES: Record<string, ExerciseDefinition> = {
  squat: { id: 'squat', name: 'Back Squat', shortName: 'Squat', category: 'squat', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 205, incrementLb: 5, barbell: true },
  bench: { id: 'bench', name: 'Competition Bench Press', shortName: 'Bench', category: 'bench', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 185, incrementLb: 5, barbell: true },
  deadlift: { id: 'deadlift', name: 'Deadlift', shortName: 'Deadlift', category: 'deadlift', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 225, incrementLb: 5, barbell: true },
  row: { id: 'row', name: 'Barbell Row', shortName: 'Row', category: 'pull', progression: 'range', weightMode: 'loaded', startingWeightLb: 115, incrementLb: 5, barbell: true },
  ohp: { id: 'ohp', name: 'Overhead Press', shortName: 'OHP', category: 'push', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 75, incrementLb: 5, barbell: true },
  'pause-squat': { id: 'pause-squat', name: 'Paused Squat', shortName: 'Pause squat', category: 'squat', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 165, incrementLb: 5, barbell: true },
  'pause-bench': { id: 'pause-bench', name: 'Paused Bench Press', shortName: 'Pause bench', category: 'bench', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 150, incrementLb: 5, barbell: true },
  'pause-deadlift': { id: 'pause-deadlift', name: 'Paused Deadlift', shortName: 'Pause deadlift', category: 'deadlift', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 180, incrementLb: 5, barbell: true },
  'feet-up-bench': { id: 'feet-up-bench', name: 'Feet-up Bench Press', shortName: 'Feet-up bench', category: 'bench', progression: 'range', weightMode: 'loaded', startingWeightLb: 135, incrementLb: 5, barbell: true },
  'incline-bench': { id: 'incline-bench', name: 'Incline Bench Press', shortName: 'Incline bench', category: 'bench', progression: 'range', weightMode: 'loaded', startingWeightLb: 135, incrementLb: 5, barbell: true },
  'barbell-curl': { id: 'barbell-curl', name: 'Barbell Curl', shortName: 'BB curl', category: 'arms', progression: 'range', weightMode: 'loaded', startingWeightLb: null, incrementLb: 5, barbell: true },
  'dumbbell-curl': { id: 'dumbbell-curl', name: 'Dumbbell Curl', shortName: 'DB curl', category: 'arms', progression: 'range', weightMode: 'loaded', startingWeightLb: null, incrementLb: 5 },
  'pull-up': { id: 'pull-up', name: 'Pull-ups', shortName: 'Pull-up', category: 'pull', progression: 'range', weightMode: 'bodyweight', startingWeightLb: 0, incrementLb: 5 },
  dips: { id: 'dips', name: 'Dips', shortName: 'Dips', category: 'push', progression: 'range', weightMode: 'bodyweight', startingWeightLb: 0, incrementLb: 5 },
  'leg-curl': { id: 'leg-curl', name: 'Leg Curl', shortName: 'Leg curl', category: 'legs', progression: 'range', weightMode: 'loaded', startingWeightLb: null, incrementLb: 5 },
  'lateral-raise': { id: 'lateral-raise', name: 'Lateral Raise', shortName: 'Lateral raise', category: 'push', progression: 'range', weightMode: 'loaded', startingWeightLb: null, incrementLb: 5 },
  'face-pull': { id: 'face-pull', name: 'Face Pull / Rear-delt Fly', shortName: 'Face pull', category: 'pull', progression: 'range', weightMode: 'loaded', startingWeightLb: null, incrementLb: 5 },
  'knee-raise': { id: 'knee-raise', name: 'Hanging Knee Raise', shortName: 'Knee raise', category: 'core', progression: 'range', weightMode: 'bodyweight', startingWeightLb: 0, incrementLb: 5 },
  plank: { id: 'plank', name: 'Plank', shortName: 'Plank', category: 'core', progression: 'timed', weightMode: 'none', startingWeightLb: null, incrementLb: 0 },
  'back-extension': { id: 'back-extension', name: 'Back Extension', shortName: 'Back extension', category: 'pull', progression: 'range', weightMode: 'bodyweight', startingWeightLb: 0, incrementLb: 5 },
  'power-clean': { id: 'power-clean', name: 'Power Clean', shortName: 'Power clean', category: 'power', progression: 'fixed', weightMode: 'loaded', startingWeightLb: 95, incrementLb: 5, barbell: true },
  'triceps-extension': { id: 'triceps-extension', name: 'Triceps Extension', shortName: 'Triceps', category: 'arms', progression: 'range', weightMode: 'loaded', startingWeightLb: null, incrementLb: 5 },
}

export const MAX_CUSTOM_SETS = 10
export const MAX_CUSTOM_REPS = 50
export const MAX_CUSTOM_WORKOUTS = 14
export const MAX_CUSTOM_EXERCISES = 20

const fixed = (exerciseId: string, sets: number, reps: number, targetRpe: number, restSeconds: number, extra: Partial<Prescription> = {}): Prescription => ({ exerciseId, sets, minReps: reps, maxReps: reps, targetRpe, restSeconds, ...extra })
const range = (exerciseId: string, sets: number, minReps: number, maxReps: number, targetRpe = 9, restSeconds = 90, extra: Partial<Prescription> = {}): Prescription => ({ exerciseId, sets, minReps, maxReps, targetRpe, restSeconds, ...extra })
const timed = (exerciseId: string, sets: number, seconds: number): Prescription => ({ exerciseId, sets, minReps: 0, maxReps: 0, targetSeconds: seconds, targetRpe: 8, restSeconds: 60 })

const personalA: Prescription[] = [fixed('squat', 5, 5, 8, 180), fixed('bench', 5, 5, 8, 180), fixed('row', 5, 5, 8, 150), range('barbell-curl', 2, 8, 12), range('knee-raise', 3, 10, 15, 9, 60), range('lateral-raise', 2, 12, 20, 9, 60, { optional: true })]
const personalB = (benchId: 'feet-up-bench' | 'incline-bench'): Prescription[] => [fixed('deadlift', 3, 5, 8, 240), fixed(benchId, 5, 5, 8, 150), fixed('ohp', 5, 5, 8, 150), range('pull-up', 3, 6, 10, 9, 120), range('leg-curl', 3, 8, 15), range('dumbbell-curl', 2, 10, 15)]
const personalC: Prescription[] = [fixed('pause-squat', 5, 5, 7, 180), fixed('pause-bench', 5, 5, 7.5, 180), fixed('pause-deadlift', 3, 5, 7, 210), range('dips', 3, 6, 10, 9, 120), range('face-pull', 3, 12, 20, 9, 60), timed('plank', 3, 45)]

function workout(id: string, day: string, name: string, focus: string, prescriptions: Prescription[]): WorkoutTemplate { return { id, day, name, focus, prescriptions } }

const PERSONAL: ProgramDefinition = {
  id: 'personal-powerlifting', name: 'Personal Powerlifting', shortName: 'Personal', description: 'Your upper-balanced A/B/C plan with competition lifts, paused technique work, and weekly bench variation.', level: 'Personalized', schedule: '3 sessions / week', color: '#c8ff3d', version: 3,
  workouts: [workout('personal-a1', 'A', 'Competition', 'Squat + bench strength', personalA), workout('personal-b-feet', 'B', 'Deadlift + upper', 'Feet-up bench week', personalB('feet-up-bench')), workout('personal-c1', 'C', 'Paused technique', 'Control + position', personalC), workout('personal-a2', 'A', 'Competition', 'Squat + bench strength', personalA), workout('personal-b-incline', 'B', 'Deadlift + upper', 'Incline bench week', personalB('incline-bench')), workout('personal-c2', 'C', 'Paused technique', 'Control + position', personalC)],
}

const CLASSIC_5X5: ProgramDefinition = {
  id: 'classic-5x5', name: 'Classic 5×5', shortName: '5×5', description: 'Simple alternating linear progression. High squat frequency and fast session-to-session load increases.', level: 'Beginner', schedule: '3 sessions / week', color: '#72d6ff', version: 1,
  workouts: [workout('5x5-a', 'A', 'Squat · Bench · Row', 'Full-body strength', [fixed('squat', 5, 5, 8, 180), fixed('bench', 5, 5, 8, 180), fixed('row', 5, 5, 8, 150)]), workout('5x5-b', 'B', 'Squat · Press · Deadlift', 'Full-body strength', [fixed('squat', 5, 5, 8, 180), fixed('ohp', 5, 5, 8, 150), fixed('deadlift', 1, 5, 8, 240)])],
}

const noAdvance = { advanceProgression: false }
const pct = (exerciseId: string, sets: number, reps: number, multiplier: number, rpe: number, advanceProgression = false): Prescription => fixed(exerciseId, sets, reps, rpe, 180, { weightMultiplier: multiplier, advanceProgression })
const TEXAS: ProgramDefinition = {
  id: 'texas-method', name: 'Texas Method', shortName: 'Texas', description: 'Classic weekly volume, recovery, and intensity stress with alternating bench and overhead-press emphasis.', level: 'Intermediate', schedule: '3 sessions / week', color: '#ffb45e', version: 1,
  workouts: [
    workout('texas-v1', 'V', 'Volume Day', 'Bench emphasis', [pct('squat', 5, 5, .9, 8), pct('bench', 5, 5, .9, 8), fixed('deadlift', 1, 5, 8, 240), range('barbell-curl', 2, 8, 12)]),
    workout('texas-r1', 'R', 'Recovery Day', 'Press + recovery squat', [pct('squat', 2, 5, .72, 6.5), pct('ohp', 3, 5, .8, 7), range('pull-up', 3, 6, 10, 8, 120), range('back-extension', 3, 10, 15)]),
    workout('texas-i1', 'I', 'Intensity Day', 'Bench emphasis', [fixed('squat', 1, 5, 9, 240), fixed('bench', 1, 5, 9, 240), range('row', 3, 6, 10, 8, 120, noAdvance)]),
    workout('texas-v2', 'V', 'Volume Day', 'Press emphasis', [pct('squat', 5, 5, .9, 8), pct('ohp', 5, 5, .9, 8), fixed('deadlift', 1, 5, 8, 240), range('row', 3, 8, 10, 8, 120, noAdvance)]),
    workout('texas-r2', 'R', 'Recovery Day', 'Bench + recovery squat', [pct('squat', 2, 5, .72, 6.5), pct('bench', 3, 5, .8, 7), range('pull-up', 3, 6, 10, 8, 120), range('back-extension', 3, 10, 15)]),
    workout('texas-i2', 'I', 'Intensity Day', 'Press emphasis', [fixed('squat', 1, 5, 9, 240), fixed('ohp', 1, 5, 9, 240), pct('pause-deadlift', 2, 3, .8, 7)]),
  ],
}

function rampTargets(multipliers: number[], reps: number[]): SetTarget[] { return multipliers.map((weightMultiplier, index) => ({ minReps: reps[index], maxReps: reps[index], weightMultiplier })) }
const madcowRamp5 = rampTargets([.5, .625, .75, .875, 1], [5, 5, 5, 5, 5])
const madcowFriday = rampTargets([.5, .625, .75, .875, 1.025, .75], [5, 5, 5, 5, 3, 8])
const ramp = (exerciseId: string, targets: SetTarget[], advanceProgression = false): Prescription => ({ exerciseId, setTargets: targets, targetRpe: 8.5, restSeconds: 180, advanceProgression })
const MADCOW: ProgramDefinition = {
  id: 'madcow-5x5', name: 'Madcow 5×5', shortName: 'Madcow', description: 'Intermediate weekly progression using ramped sets, a lighter middle day, and Friday triples.', level: 'Intermediate', schedule: '3 sessions / week', color: '#d69aff', version: 1,
  workouts: [
    workout('madcow-mon', 'M', 'Ramped 5s', 'Monday volume', [ramp('squat', madcowRamp5), ramp('bench', madcowRamp5), ramp('row', madcowRamp5), range('knee-raise', 3, 10, 15, 9, 60)]),
    workout('madcow-wed', 'W', 'Light + Pull', 'Wednesday recovery', [ramp('squat', rampTargets([.5, .625, .75, .75], [5, 5, 5, 5])), ramp('ohp', rampTargets([.55, .7, .85, 1], [5, 5, 5, 5]), true), ramp('deadlift', rampTargets([.55, .7, .85, 1], [5, 5, 5, 5]), true), timed('plank', 3, 45)]),
    workout('madcow-fri', 'F', 'Triple + Back-off', 'Friday intensity', [ramp('squat', madcowFriday, true), ramp('bench', madcowFriday, true), ramp('row', madcowFriday, true), range('dips', 3, 6, 10), range('barbell-curl', 2, 8, 12), range('triceps-extension', 2, 10, 15)]),
  ],
}

const weekTargets = [
  { label: '5s', values: [[.65, 5], [.75, 5], [.85, 5]] as Array<[number, number]> },
  { label: '3s', values: [[.7, 3], [.8, 3], [.9, 3]] as Array<[number, number]> },
  { label: '5/3/1', values: [[.75, 5], [.85, 3], [.95, 1]] as Array<[number, number]> },
  { label: 'Deload', values: [[.4, 5], [.5, 5], [.6, 5]] as Array<[number, number]> },
]
const liftDays = [
  { id: 'squat', day: 'SQ', assistance: [range('row', 4, 8, 12), range('leg-curl', 3, 10, 15), timed('plank', 3, 45)] },
  { id: 'bench', day: 'BP', assistance: [range('row', 4, 8, 12), range('dips', 3, 6, 10), range('face-pull', 3, 12, 20)] },
  { id: 'deadlift', day: 'DL', assistance: [range('pull-up', 4, 6, 10), range('leg-curl', 3, 10, 15), range('knee-raise', 3, 10, 15)] },
  { id: 'ohp', day: 'OP', assistance: [range('pull-up', 4, 6, 10), range('dips', 3, 6, 10), range('dumbbell-curl', 2, 10, 15)] },
]
const fiveThreeOneWorkouts: WorkoutTemplate[] = weekTargets.flatMap((week, weekIndex) => liftDays.map((lift) => {
  const targets = week.values.map(([weightMultiplier, reps], index) => ({ minReps: reps, maxReps: reps, weightMultiplier, plusSet: weekIndex < 3 && index === 2 }))
  const main: Prescription = { exerciseId: lift.id, setTargets: targets, targetRpe: weekIndex === 3 ? 6 : 9, restSeconds: 180, advanceProgression: false }
  return workout(`531-${weekIndex}-${lift.id}`, lift.day, `${EXERCISES[lift.id].shortName} · ${week.label}`, `Cycle week ${weekIndex + 1}`, [main, ...lift.assistance.map((item) => ({ ...item, advanceProgression: weekIndex !== 3 }))])
}))
const FIVE_THREE_ONE: ProgramDefinition = {
  id: '531-rolling', name: '5/3/1 Rolling', shortName: '5/3/1', description: 'Four-lift 5/3/1 cycle that rolls across three weekly sessions, including AMRAP sets and a deload wave.', level: 'Intermediate', schedule: '3 rolling sessions / week', color: '#ff718d', version: 1,
  initialWeights: { squat: 215, bench: 195, deadlift: 235, ohp: 80 }, workouts: fiveThreeOneWorkouts,
}

export const BUILT_IN_PROGRAMS: ProgramDefinition[] = [PERSONAL, CLASSIC_5X5, TEXAS, MADCOW, FIVE_THREE_ONE]

export function allPrograms(state: Pick<AppState, 'customPrograms'>): ProgramDefinition[] { return [...BUILT_IN_PROGRAMS, ...state.customPrograms] }
export function getProgram(state: Pick<AppState, 'activeProgramId' | 'customPrograms'>, id = state.activeProgramId): ProgramDefinition { return allPrograms(state).find((program) => program.id === id) ?? PERSONAL }
export function createInitialProgress(overrides: Record<string, number | null> = {}): Record<string, ExerciseProgress> { return Object.fromEntries(Object.values(EXERCISES).map((exercise) => [exercise.id, { workingWeightLb: overrides[exercise.id] !== undefined ? overrides[exercise.id] : exercise.startingWeightLb, consecutiveFailures: 0 }])) }
export function createProgramRuntime(program: ProgramDefinition): ProgramRuntime { return { nextWorkoutIndex: 0, completedWorkouts: 0, completedCycles: 0, progress: createInitialProgress(program.initialWeights) } }
export function normalizeProgramRuntime(program: ProgramDefinition, runtime: ProgramRuntime): ProgramRuntime {
  const workoutCount = Math.max(1, program.workouts.length)
  const index = Number.isFinite(runtime.nextWorkoutIndex) ? Math.max(0, Math.floor(runtime.nextWorkoutIndex)) % workoutCount : 0
  return { ...runtime, nextWorkoutIndex: index }
}
function makeId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}` }
function targetsFor(prescription: Prescription): SetTarget[] {
  if (prescription.setTargets) return prescription.setTargets.slice(0, MAX_CUSTOM_SETS)
  const requested = Number.isFinite(prescription.sets) ? Math.round(prescription.sets!) : 1
  const count = Math.min(MAX_CUSTOM_SETS, Math.max(1, requested))
  return Array.from({ length: count }, () => ({ minReps: prescription.minReps ?? 0, maxReps: prescription.maxReps ?? prescription.minReps ?? 0, targetSeconds: prescription.targetSeconds, weightMultiplier: prescription.weightMultiplier }))
}

function toExerciseLog(prescription: Prescription, runtime: ProgramRuntime, index: number, barWeightLb: number): ExerciseLog {
  const exercise = EXERCISES[prescription.exerciseId]
  const progressionKey = prescription.progressionKey ?? exercise.id
  const baseWeight = runtime.progress[progressionKey]?.workingWeightLb ?? exercise.startingWeightLb
  const sets = targetsFor(prescription).map((target, index) => {
    const weight = baseWeight == null || exercise.weightMode === 'none' ? baseWeight : roundToIncrement(baseWeight * (target.weightMultiplier ?? 1), exercise.incrementLb || 5)
    return { number: index + 1, minReps: target.minReps, maxReps: target.maxReps, targetSeconds: target.targetSeconds, plusSet: target.plusSet, weightLb: weight, reps: exercise.progression === 'timed' ? null : target.minReps, seconds: exercise.progression === 'timed' ? target.targetSeconds ?? null : null, rpe: null, complete: false }
  })
  const firstWeight = sets.find((set) => set.weightLb != null)?.weightLb ?? null
  return {
    logId: `${prescription.exerciseId}-${index + 1}`,
    exerciseId: exercise.id, name: prescription.displayName ?? exercise.name, progressionKey, progressionType: exercise.progression, incrementLb: exercise.incrementLb, baseWeightLb: baseWeight, advanceProgression: prescription.advanceProgression ?? true,
    targetRpe: prescription.targetRpe, restSeconds: prescription.restSeconds, optional: prescription.optional ?? false, skipped: false, notes: '',
    warmupSets: exercise.barbell && firstWeight != null ? buildWarmupSets(firstWeight, barWeightLb).map((set, warmupIndex) => ({ number: warmupIndex + 1, weightLb: set.weight, reps: set.reps, complete: false })) : [],
    sets,
  }
}

export function getNextWorkout(state: AppState, programId = state.activeProgramId): { program: ProgramDefinition; runtime: ProgramRuntime; template: WorkoutTemplate } {
  const program = getProgram(state, programId)
  const runtime = normalizeProgramRuntime(program, state.programStates[program.id] ?? createProgramRuntime(program))
  return { program, runtime, template: program.workouts[runtime.nextWorkoutIndex] }
}

export function createWorkout(state: AppState, now = new Date()): WorkoutSession {
  const { program, runtime, template } = getNextWorkout(state)
  return { id: makeId(), programId: program.id, programName: program.name, programVersion: program.version, workoutIndex: runtime.nextWorkoutIndex, day: template.day, name: template.name, variation: template.focus, startedAt: now.toISOString(), completedAt: null, bodyweightLb: state.settings.bodyweightLb, notes: '', exercises: template.prescriptions.map((prescription, index) => toExerciseLog(prescription, runtime, index, state.settings.barWeightLb)) }
}

export function previewNextWorkout(state: AppState) {
  const { program, runtime, template } = getNextWorkout(state)
  return { program, runtime, template, exercises: template.prescriptions.map((prescription, index) => toExerciseLog(prescription, runtime, index, state.settings.barWeightLb)) }
}

export function advanceRuntime(program: ProgramDefinition, runtime: ProgramRuntime, progress: Record<string, ExerciseProgress>): ProgramRuntime {
  const nextWorkoutIndex = (runtime.nextWorkoutIndex + 1) % program.workouts.length
  const completedCycle = nextWorkoutIndex === 0
  const nextProgress = structuredClone(progress)
  if (completedCycle && program.id === '531-rolling') {
    for (const id of ['squat', 'deadlift']) if (nextProgress[id].workingWeightLb != null) nextProgress[id].workingWeightLb = roundToIncrement(nextProgress[id].workingWeightLb! + 10, 5)
    for (const id of ['bench', 'ohp']) if (nextProgress[id].workingWeightLb != null) nextProgress[id].workingWeightLb = roundToIncrement(nextProgress[id].workingWeightLb! + 5, 5)
  }
  return { nextWorkoutIndex, completedWorkouts: runtime.completedWorkouts + 1, completedCycles: runtime.completedCycles + (completedCycle ? 1 : 0), progress: nextProgress }
}

export function createInitialState(): AppState {
  return { schemaVersion: 2, activeProgramId: PERSONAL.id, programStates: Object.fromEntries(BUILT_IN_PROGRAMS.map((program) => [program.id, createProgramRuntime(program)])), customPrograms: [], history: [], activeSession: null, restTimerEnd: null, settings: { unit: 'lb', bodyweightLb: 150, barWeightLb: 45, platesLb: [45, 35, 25, 10, 5, 2.5], defaultRestSeconds: 180, autoStartRest: true, persistentStorageRequested: false } }
}

export function suggestedCustomProgram(name: string): ProgramDefinition {
  const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return { id, name: name.trim() || 'My Program', shortName: name.trim() || 'Custom', description: 'A custom program you can edit anytime.', level: 'Custom', schedule: '3 sessions / cycle', color: '#76e6bf', version: 1, custom: true, workouts: [workout(`${id}-a`, 'A', 'Custom A', 'Custom session', [fixed('squat', 3, 5, 8, 180), fixed('bench', 3, 5, 8, 180), range('row', 3, 8, 10)]), workout(`${id}-b`, 'B', 'Custom B', 'Custom session', [fixed('deadlift', 3, 5, 8, 240), fixed('ohp', 3, 5, 8, 150), range('pull-up', 3, 6, 10)]), workout(`${id}-c`, 'C', 'Custom C', 'Custom session', [fixed('pause-squat', 3, 5, 7, 180), fixed('pause-bench', 3, 5, 7, 180), timed('plank', 3, 45)])] }
}

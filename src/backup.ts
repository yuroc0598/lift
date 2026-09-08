import { normalizeStoredState } from './db'
import type { AppState } from './types'

const BACKUP_FORMAT = 'lift-full-backup'
const BACKUP_VERSION = 1

interface BackupEnvelope {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  state: AppState
}

export function stateToBackup(state: AppState): string {
  const backup: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  }
  return JSON.stringify(backup, null, 2)
}

export function backupToState(text: string): AppState {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This is not a valid Lift backup file.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('This is not a valid Lift backup file.')
  const backup = parsed as Partial<BackupEnvelope>
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) throw new Error('This backup format is not supported.')
  const state = normalizeStoredState(backup.state)
  if (!state) throw new Error('The backup does not contain valid Lift data.')
  return state
}

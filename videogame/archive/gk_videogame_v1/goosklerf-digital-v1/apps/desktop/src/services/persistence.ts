import type { GameState } from '@gk/engine'

export interface SaveSlot {
  id: string
  name: string
  savedAt: number
  turnNumber: number
  phase: string
  playerCount: number
}

const KEY_PREFIX = 'gk2:save:'
const INDEX_KEY = 'gk2:save:index'
const SCHEMA_VERSION = 1

interface SaveBlob {
  schemaVersion: number
  meta: SaveSlot
  state: GameState
}

function readIndex(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeIndex(slots: SaveSlot[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(slots))
}

export function saveGame(state: GameState, name: string): SaveSlot {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const meta: SaveSlot = {
    id,
    name: name.trim() || `Turn ${state.turnNumber}`,
    savedAt: Date.now(),
    turnNumber: state.turnNumber,
    phase: state.phase,
    playerCount: state.players.length,
  }
  const blob: SaveBlob = { schemaVersion: SCHEMA_VERSION, meta, state }
  localStorage.setItem(KEY_PREFIX + id, JSON.stringify(blob))
  const index = readIndex().filter(s => s.id !== id)
  index.unshift(meta)
  writeIndex(index)
  return meta
}

export function listSaves(): SaveSlot[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt)
}

export function loadGame(id: string): GameState | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id)
    if (!raw) return null
    const blob = JSON.parse(raw) as SaveBlob
    if (blob.schemaVersion !== SCHEMA_VERSION) return null
    return blob.state
  } catch {
    return null
  }
}

export function deleteSave(id: string): void {
  localStorage.removeItem(KEY_PREFIX + id)
  writeIndex(readIndex().filter(s => s.id !== id))
}

export function isPersistenceAvailable(): boolean {
  try {
    const probe = '__gk_probe__'
    localStorage.setItem(probe, probe)
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

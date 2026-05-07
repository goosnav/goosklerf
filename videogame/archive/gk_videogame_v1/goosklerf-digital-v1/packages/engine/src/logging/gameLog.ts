export type LogCategory =
  | 'setup'
  | 'action'
  | 'combat'
  | 'card_effect'
  | 'victory'
  | 'error'

export interface GameLogEntry {
  id: string
  turnNumber: number
  roundNumber: number
  playerId: string
  category: LogCategory
  message: string
  data?: Record<string, unknown>
  timestamp: number
}

let _logCounter = 0

export function makeLogEntry(
  partial: Omit<GameLogEntry, 'id' | 'timestamp'>
): GameLogEntry {
  return {
    ...partial,
    id: `log_${partial.turnNumber}_${partial.roundNumber}_${++_logCounter}`,
    timestamp: Date.now(),
  }
}

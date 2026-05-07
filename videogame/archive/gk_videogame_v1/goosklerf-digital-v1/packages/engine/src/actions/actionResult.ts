import type { GameState, PendingChoice } from '../state/gameState.js'
import type { GameLogEntry } from '../logging/gameLog.js'
import type { GameRuleError } from '@gk/shared'

export interface ActionResult {
  ok: boolean
  state?: GameState
  error?: GameRuleError
  logEntries: GameLogEntry[]
  pendingChoice?: PendingChoice
}

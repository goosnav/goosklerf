import type { GameState, GamePhase } from '../state/gameState.js'
import type { EndPhaseAction } from '../actions/actionTypes.js'
import type { ActionResult } from '../actions/actionResult.js'
import { GameRuleError } from '@gk/shared'
import { makeLogEntry } from '../logging/gameLog.js'
import { checkEliminationsAndWinner, cloneState, drawCards, nextActivePlayer } from '../rules/runtime.js'

const PHASE_ORDER: GamePhase[] = [
  'card_play', 'combat', 'movement', 'card_draw', 'victory_check'
]

export function reduceEndPhase(state: GameState, action: EndPhaseAction): ActionResult {
  if (action.playerId !== state.activePlayerId) {
    return {
      ok: false,
      error: new GameRuleError('NOT_YOUR_TURN', 'Not your turn'),
      logEntries: [],
    }
  }

  if (state.phase === 'card_play') {
    const visibleCards = state.zones.hands[action.playerId].instanceIds.length +
      state.zones.shops[action.playerId].instanceIds.length
    const playsRequired = Math.min(3, visibleCards + (state.cardPlaysThisTurn[action.playerId] ?? 0))
    if ((state.cardPlaysThisTurn[action.playerId] ?? 0) < playsRequired && visibleCards > 0) {
      return {
        ok: false,
        error: new GameRuleError('ILLEGAL_ACTION', 'Play or discard 3 cards before ending card_play'),
        logEntries: [],
      }
    }
  }

  const currentIndex = PHASE_ORDER.indexOf(state.phase as GamePhase)
  if (currentIndex === -1) {
    return {
      ok: false,
      error: new GameRuleError('WRONG_PHASE', `Cannot end phase from ${state.phase}`),
      logEntries: [],
    }
  }

  const nextPhase: GamePhase = currentIndex < PHASE_ORDER.length - 1
    ? PHASE_ORDER[currentIndex + 1]
    : 'card_play'

  const logEntry = makeLogEntry({
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    playerId: action.playerId,
    category: 'action',
    message: `Phase ${state.phase} → ${nextPhase}`,
    data: { event: 'phase_ended', from: state.phase, to: nextPhase },
  })

  const newState: GameState = cloneState(state)
  newState.phase = nextPhase
  newState.log.push(logEntry)

  if (state.phase === 'card_draw') {
    const drawn = drawCards(newState, action.playerId, 2)
    newState.log.push(makeLogEntry({
      turnNumber: state.turnNumber,
      roundNumber: state.roundNumber,
      playerId: action.playerId,
      category: 'action',
      message: `Automatic draw: ${drawn} card${drawn === 1 ? '' : 's'}.`,
      data: { event: 'cards_drawn', count: drawn },
    }))
  }

  if (state.phase === 'victory_check') {
    checkEliminationsAndWinner(newState, { advanceLandlord: true })
    if (newState.phase !== 'game_over') {
      nextActivePlayer(newState)
      newState.phase = 'card_play'
    }
  }

  return { ok: true, state: newState, logEntries: [logEntry] }
}

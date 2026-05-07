import type { GameState } from '../state/gameState.js'
import type { GameAction } from '../actions/actionTypes.js'
import type { ActionResult } from '../actions/actionResult.js'
import { GameRuleError } from '@gk/shared'
import { reduceEndPhase } from './phaseReducers.js'
import { SeededRng } from '../rng/rng.js'
import { makeLogEntry } from '../logging/gameLog.js'
import {
  applyConsumable,
  captureFortress,
  checkEliminationsAndWinner,
  cloneState,
  damageCard,
  drawCards,
  equipItem,
  getContainingFortressId,
  getFortressOccupants,
  getAttackValue,
  getDefinition,
  isInPlayerZone,
  isOwnedByActivePlayer,
  moveCard,
  moveEntityToBattlefield,
  moveEntityToFortress,
  playEntityIntoFortress,
  playPermanent,
} from '../rules/runtime.js'

export function reduceGameAction(state: GameState, action: GameAction): ActionResult {
  if (state.phase === 'game_over') {
    return {
      ok: false,
      error: new GameRuleError('GAME_OVER', 'Game is already over'),
      logEntries: [],
    }
  }

  switch (action.type) {
    case 'PLAY_CARD':
      return reducePlayCard(state, action)
    case 'DISCARD_CARD':
      return reduceDiscardCard(state, action)
    case 'EQUIP_ITEM':
      return reduceEquipItem(state, action)
    case 'NORMAL_ATTACK':
      return reduceNormalAttack(state, action)
    case 'MOVE_ENTITY':
      return reduceMoveEntity(state, action)
    case 'DRAW_CARDS':
      return reduceDrawCards(state, action)
    case 'END_PHASE':
      return reduceEndPhase(state, action)
    default:
      return {
        ok: false,
        error: new GameRuleError('ILLEGAL_ACTION', `Action ${action.type} not yet implemented`),
        logEntries: [],
      }
  }
}

function reduceDiscardCard(state: GameState, action: Extract<GameAction, { type: 'DISCARD_CARD' }>): ActionResult {
  const activeError = requireActivePlayer(state, action.playerId)
  if (activeError) return fail(activeError)
  if (state.phase !== 'card_play') return fail(new GameRuleError('WRONG_PHASE', 'Cards can only be discarded during card_play'))
  if ((state.cardPlaysThisTurn[action.playerId] ?? 0) >= 3) {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'You already played/discarded 3 cards this turn'))
  }
  if (!isInPlayerZone(state, action.instanceId, action.playerId, ['hand', 'shop'])) {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'Card is not in your hand or shop'))
  }
  const card = getDefinition(state, action.instanceId)
  if (!card) return fail(new GameRuleError('INVALID_CARD', 'Card definition not found'))
  const next = cloneState(state)
  moveCard(next, action.instanceId, 'graveyard', action.playerId)
  next.cardPlaysThisTurn[action.playerId] = (next.cardPlaysThisTurn[action.playerId] ?? 0) + 1
  const logEntry = makeLogEntry({
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    playerId: action.playerId,
    category: 'action',
    message: `${card.name} was discarded.`,
    data: { event: 'card_discarded', cardType: card.type, instanceId: action.instanceId },
  })
  next.log.push(logEntry)
  checkEliminationsAndWinner(next)
  return { ok: true, state: next, logEntries: [logEntry] }
}

function requireActivePlayer(state: GameState, playerId: string): GameRuleError | null {
  if (playerId !== state.activePlayerId) {
    return new GameRuleError('NOT_YOUR_TURN', 'Not your turn')
  }
  return null
}

function reducePlayCard(state: GameState, action: Extract<GameAction, { type: 'PLAY_CARD' }>): ActionResult {
  const activeError = requireActivePlayer(state, action.playerId)
  if (activeError) return fail(activeError)
  if (state.phase !== 'card_play') return fail(new GameRuleError('WRONG_PHASE', 'Cards can only be played during card_play'))
  if ((state.cardPlaysThisTurn[action.playerId] ?? 0) >= 3) {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'You already played/discarded 3 cards this turn'))
  }
  if (!isInPlayerZone(state, action.instanceId, action.playerId, ['hand', 'shop'])) {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'Card is not in your hand or shop'))
  }

  const card = getDefinition(state, action.instanceId)
  if (!card) return fail(new GameRuleError('INVALID_CARD', 'Card definition not found'))

  const next = cloneState(state)
  let message = `${card.name} entered play.`

  if (card.type === 'entity') {
    if (!action.targetInstanceId) {
      return fail(new GameRuleError('INVALID_TARGET', 'Entities must be assigned to one of your fortresses'))
    }
    const error = playEntityIntoFortress(next, action.instanceId, action.targetInstanceId, action.playerId)
    if (error) return fail(new GameRuleError('INVALID_TARGET', error))
    const fortress = getDefinition(next, action.targetInstanceId)
    message = `${card.name} entered ${fortress?.name ?? 'a fortress'}.`
  } else if (card.type === 'fortress') {
    playPermanent(next, action.instanceId, action.playerId)
    message = `${card.name} was built in the suburbs.`
  } else if (card.type === 'item_regular') {
    if (!action.targetInstanceId) {
      return fail(new GameRuleError('INVALID_TARGET', 'Regular items need a target entity'))
    }
    const error = equipItem(next, action.instanceId, action.targetInstanceId)
    if (error) return fail(new GameRuleError('ILLEGAL_ACTION', error))
    message = `${card.name} was equipped.`
  } else {
    const consumable = applyConsumable(next, action.instanceId, action.targetInstanceId)
    if (!consumable.ok) return fail(new GameRuleError('INVALID_TARGET', consumable.message))
    message = consumable.message
  }
  next.cardPlaysThisTurn[action.playerId] = (next.cardPlaysThisTurn[action.playerId] ?? 0) + 1

  const logEntry = makeLogEntry({
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    playerId: action.playerId,
    category: card.type === 'item_consumable' ? 'card_effect' : 'action',
    message,
    data: {
      event: card.type === 'item_regular'
        ? 'item_equipped'
        : card.type === 'item_consumable'
          ? 'consumable_used'
          : 'card_played',
      cardType: card.type,
      instanceId: action.instanceId,
      targetInstanceId: action.targetInstanceId,
    },
  })
  next.log.push(logEntry)
  checkEliminationsAndWinner(next)
  return { ok: true, state: next, logEntries: [logEntry] }
}

function reduceEquipItem(state: GameState, action: Extract<GameAction, { type: 'EQUIP_ITEM' }>): ActionResult {
  return reducePlayCard(state, {
    type: 'PLAY_CARD',
    playerId: action.playerId,
    instanceId: action.itemInstanceId,
    targetInstanceId: action.targetEntityInstanceId,
  })
}

function reduceNormalAttack(state: GameState, action: Extract<GameAction, { type: 'NORMAL_ATTACK' }>): ActionResult {
  const activeError = requireActivePlayer(state, action.playerId)
  if (activeError) return fail(activeError)
  if (state.phase !== 'combat') return fail(new GameRuleError('WRONG_PHASE', 'Attacks can only happen during combat'))
  if (!isOwnedByActivePlayer(state, action.attackerInstanceId, action.playerId)) {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'Attacker is not controlled by active player'))
  }

  const attacker = state.cardsByInstanceId[action.attackerInstanceId]
  const attackerDef = getDefinition(state, action.attackerInstanceId)
  const target = state.cardsByInstanceId[action.targetInstanceId]
  const targetDef = getDefinition(state, action.targetInstanceId)
  if (!attacker || !attackerDef || attackerDef.type !== 'entity') {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'Attacker must be an entity'))
  }
  if (attacker.zone.zone !== 'battlefield') return fail(new GameRuleError('ILLEGAL_ACTION', 'Attacker is not in play'))
  if (attacker.participatedThisTurn) return fail(new GameRuleError('ILLEGAL_ACTION', 'Entity already attacked this turn'))
  if (!target || !targetDef || (target.zone.zone !== 'battlefield' && target.zone.zone !== 'suburbs')) {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'Target is not in play'))
  }
  if (targetDef.type !== 'entity' && targetDef.type !== 'fortress') {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'Target must be an entity or fortress'))
  }
  if (target.controllerPlayerId === action.playerId) {
    return fail(new GameRuleError('ILLEGAL_ACTION', 'Cannot attack your own card'))
  }

  const next = cloneState(state)
  const nextAttacker = next.cardsByInstanceId[action.attackerInstanceId]
  const defenderFortressId = targetDef.type === 'entity'
    ? getContainingFortressId(next, action.targetInstanceId)
    : undefined
  const targetFortressOccupants = targetDef.type === 'fortress'
    ? getFortressOccupants(next, action.targetInstanceId).length
    : 0
  const defenderCouldOpenCapture = Boolean(
    defenderFortressId &&
    getFortressOccupants(next, defenderFortressId).length === 1 &&
    (next.cardsByInstanceId[action.targetInstanceId].currentHp ?? targetDef.baseHp ?? 0) <= 1,
  )
  const attackValue = getAttackValue(next, action.attackerInstanceId)
  const rng = new SeededRng(next.rngState.seed)
  rng.restoreState(next.rngState)
  const roll = action.diceRoll ?? rng.rollD6()
  next.rngState = rng.getState()
  nextAttacker.participatedThisTurn = true
  const hit = roll <= attackValue
  let defeated = false
  let captured = false
  let destroyed = false
  let capturedFortressId: string | undefined
  let capturedByClearingDefenders = false
  let captureOpportunity = targetDef.type === 'fortress'
    ? targetFortressOccupants === 0
    : defenderCouldOpenCapture

  if (hit && targetDef.type === 'fortress') {
    if (targetFortressOccupants === 0) {
      const error = captureFortress(next, action.targetInstanceId, action.attackerInstanceId, action.playerId)
      captured = !error
      capturedFortressId = captured ? action.targetInstanceId : undefined
    } else {
      defeated = damageCard(next, action.targetInstanceId, 1)
      destroyed = defeated
    }
  } else if (hit) {
    defeated = damageCard(next, action.targetInstanceId, 1)
    if (defeated && defenderFortressId) {
      const fortress = next.cardsByInstanceId[defenderFortressId]
      const fortressDef = getDefinition(next, defenderFortressId)
      const fortressStillStanding =
        fortress?.zone.zone === 'suburbs' &&
        fortressDef?.type === 'fortress' &&
        (fortress.currentFortressHp ?? fortressDef.fortressHp ?? 0) > 0
      if (fortressStillStanding && getFortressOccupants(next, defenderFortressId).length === 0) {
        const error = captureFortress(next, defenderFortressId, action.attackerInstanceId, action.playerId)
        captured = !error
        capturedByClearingDefenders = captured
        capturedFortressId = captured ? defenderFortressId : undefined
      }
    }
  }
  const message = hit
    ? `${attackerDef.name} rolled ${roll}/${attackValue} and hit ${targetDef.name}${captured ? ', capturing the fortress' : defeated ? ', defeating it' : ''}.`
    : `${attackerDef.name} rolled ${roll}/${attackValue} and missed ${targetDef.name}.`

  const logEntry = makeLogEntry({
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    playerId: action.playerId,
    category: 'combat',
    message,
    data: {
      event: 'attack',
      roll,
      attackValue,
      hit,
      defeated,
      captured,
      destroyed,
      capturedFortressId,
      capturedByClearingDefenders,
      captureOpportunity,
      fortressAssault: targetDef.type === 'fortress' || Boolean(defenderFortressId),
      targetFortressId: targetDef.type === 'fortress' ? action.targetInstanceId : defenderFortressId,
      targetFortressState: targetDef.type === 'fortress'
        ? targetFortressOccupants === 0 ? 'empty' : 'occupied'
        : defenderFortressId ? 'defender' : 'none',
      attackerInstanceId: action.attackerInstanceId,
      targetInstanceId: action.targetInstanceId,
      targetType: targetDef.type,
    },
  })
  next.log.push(logEntry)
  checkEliminationsAndWinner(next)
  return { ok: true, state: next, logEntries: [logEntry] }
}

function reduceMoveEntity(state: GameState, action: Extract<GameAction, { type: 'MOVE_ENTITY' }>): ActionResult {
  const activeError = requireActivePlayer(state, action.playerId)
  if (activeError) return fail(activeError)
  if (state.phase !== 'movement') return fail(new GameRuleError('WRONG_PHASE', 'Entities can only move during movement'))
  const next = cloneState(state)
  const entityDef = getDefinition(next, action.entityInstanceId)
  if (entityDef?.type !== 'entity') return fail(new GameRuleError('INVALID_CARD', 'Only entities can move'))
  const error = action.destination === 'battlefield'
    ? moveEntityToBattlefield(next, action.entityInstanceId, action.playerId)
    : action.targetFortressId
      ? moveEntityToFortress(next, action.entityInstanceId, action.targetFortressId, action.playerId)
      : 'Choose a fortress'
  if (error) return fail(new GameRuleError('INVALID_TARGET', error))
  const targetName = action.destination === 'battlefield'
    ? 'the battlefield'
    : getDefinition(next, action.targetFortressId!)?.name ?? 'a fortress'
  const logEntry = makeLogEntry({
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    playerId: action.playerId,
    category: 'action',
    message: `${entityDef.name} moved to ${targetName}.`,
    data: {
      event: 'entity_moved',
      entityInstanceId: action.entityInstanceId,
      targetFortressId: action.targetFortressId,
      destination: action.destination,
    },
  })
  next.log.push(logEntry)
  return { ok: true, state: next, logEntries: [logEntry] }
}

function reduceDrawCards(state: GameState, action: Extract<GameAction, { type: 'DRAW_CARDS' }>): ActionResult {
  const activeError = requireActivePlayer(state, action.playerId)
  if (activeError) return fail(activeError)
  if (state.phase !== 'card_draw') return fail(new GameRuleError('WRONG_PHASE', 'Cards can only be drawn during card_draw'))
  const next = cloneState(state)
  const drawn = drawCards(next, action.playerId, action.count)
  const logEntry = makeLogEntry({
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    playerId: action.playerId,
    category: 'action',
    message: `${drawn} card${drawn === 1 ? '' : 's'} drawn.`,
  })
  next.log.push(logEntry)
  checkEliminationsAndWinner(next)
  return { ok: true, state: next, logEntries: [logEntry] }
}

function fail(error: GameRuleError): ActionResult {
  return { ok: false, error, logEntries: [] }
}

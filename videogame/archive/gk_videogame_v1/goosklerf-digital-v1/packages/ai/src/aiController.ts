import type { GameState, GameAction } from '@gk/engine'
import {
  getContainingFortressId,
  getDefinition,
  getEnemyBattleCards,
  getFortressOccupants,
  getPlayerBattleCards,
  getPlayerInPlayEntities,
  getPlayerSuburbCards,
} from '@gk/engine'
import { MAX_ENTITIES_PER_PLAYER_ON_BATTLEFIELD } from '@gk/shared'
import { PERSONALITIES, type AiPersonality } from './personalities/personalities.js'

export interface AiController {
  personalityId: string
  selectAction(state: GameState, playerId: string): GameAction
}

export class RandomLegalAiController implements AiController {
  personalityId: string
  private personality: AiPersonality

  constructor(personalityId: string = 'butcher') {
    this.personalityId = personalityId
    this.personality = PERSONALITIES[personalityId] ?? PERSONALITIES['butcher']!
  }

  selectAction(state: GameState, playerId: string): GameAction {
    if (state.phase === 'card_play') {
      const ownFortresses = getPlayerSuburbCards(state, playerId)
      const ownEntities = getPlayerInPlayEntities(state, playerId)
      const playable = [
        ...state.zones.hands[playerId].instanceIds,
        ...state.zones.shops[playerId].instanceIds,
      ]

      if ((state.cardPlaysThisTurn[playerId] ?? 0) >= 3) {
        return { type: 'END_PHASE', playerId }
      }

      const fortress = playable.find(id => getDefinition(state, id)?.type === 'fortress')
      if (fortress) return { type: 'PLAY_CARD', playerId, instanceId: fortress }

      const equipTarget = ownEntities.find(id => state.cardsByInstanceId[id].equippedItemIds.length < 3)
      const regularItem = playable.find(id => getDefinition(state, id)?.type === 'item_regular')
      if (regularItem && equipTarget) {
        return {
          type: 'EQUIP_ITEM',
          playerId,
          itemInstanceId: regularItem,
          targetEntityInstanceId: equipTarget,
        }
      }

      const entity = playable.find(id => getDefinition(state, id)?.type === 'entity')
      const fortressWithSpace = ownFortresses.find(id => getFortressOccupants(state, id).length < 3)
      if (entity && fortressWithSpace) {
        return { type: 'PLAY_CARD', playerId, instanceId: entity, targetInstanceId: fortressWithSpace }
      }

      const enemies = getEnemyBattleCards(state, playerId)
      const offensiveConsumable = playable.find(id => {
        const card = getDefinition(state, id)
        return card?.type === 'item_consumable' && (
          (card.hpBuff ?? 0) < 0 ||
          (/kill|die|destroy|defeat/i.test(card.rulesText) && /roll\s*<=?\s*[1-6]/i.test(card.miscStat ?? card.rulesText))
        )
      })
      if (offensiveConsumable && enemies.length > 0) {
        return { type: 'PLAY_CARD', playerId, instanceId: offensiveConsumable, targetInstanceId: enemies[0] }
      }

      const healingConsumable = playable.find(id => {
        const card = getDefinition(state, id)
        return card?.type === 'item_consumable' && (card.hpBuff ?? 0) > 0
      })
      if (healingConsumable && ownEntities.length > 0) {
        return { type: 'PLAY_CARD', playerId, instanceId: healingConsumable, targetInstanceId: ownEntities[0] }
      }

      if (playable.length > 0) {
        return { type: 'DISCARD_CARD', playerId, instanceId: playable[0] }
      }
    }

    if (state.phase === 'movement') {
      const battlefieldEntities = getPlayerBattleCards(state, playerId, 'entity')
      const enemyHasFortress = state.players
        .filter(player => player.playerId !== playerId)
        .some(player => getPlayerSuburbCards(state, player.playerId).length > 0)
      const controlsEveryFortress = playerControlsEveryFortress(state, playerId)
      if (enemyHasFortress && battlefieldEntities.length < Math.min(1, MAX_ENTITIES_PER_PLAYER_ON_BATTLEFIELD)) {
        const ownFortresses = getPlayerSuburbCards(state, playerId)
        const fortressWithExtraOccupant = ownFortresses.find(id => getFortressOccupants(state, id).length > 1)
        const fallbackFortress = controlsEveryFortress
          ? undefined
          : ownFortresses.find(id => getFortressOccupants(state, id).length > 0)
        const sourceFortress = fortressWithExtraOccupant ?? fallbackFortress
        const occupant = sourceFortress ? strongestEntity(state, getFortressOccupants(state, sourceFortress)) : undefined
        if (occupant) return { type: 'MOVE_ENTITY', playerId, entityInstanceId: occupant, destination: 'battlefield' }
      }
    }

    if (state.phase === 'combat') {
      const attacker = getPlayerBattleCards(state, playerId, 'entity')
        .filter(id => !state.cardsByInstanceId[id].participatedThisTurn)
        .sort((a, b) => attackScore(state, b) - attackScore(state, a))[0]
      const target = selectCombatTarget(state, playerId)
      if (attacker && target) {
        return { type: 'NORMAL_ATTACK', playerId, attackerInstanceId: attacker, targetInstanceId: target }
      }
    }

    return { type: 'END_PHASE', playerId }
  }
}

export function createAiController(personalityId?: string): AiController {
  return new RandomLegalAiController(personalityId)
}

function selectCombatTarget(state: GameState, playerId: string): string | undefined {
  const enemyFortresses = state.players
    .filter(player => player.playerId !== playerId)
    .flatMap(player => getPlayerSuburbCards(state, player.playerId))
  const occupiedFortresses = enemyFortresses.filter(id => getFortressOccupants(state, id).length > 0)
  const emptyFortresses = enemyFortresses.filter(id => getFortressOccupants(state, id).length === 0)
  const fortressDefenders = occupiedFortresses.flatMap(id => getFortressOccupants(state, id))
  const battlefieldTargets = getEnemyBattleCards(state, playerId).filter(id => {
    const card = getDefinition(state, id)
    return card?.type === 'entity' && !getContainingFortressId(state, id)
  })

  const captureOpeningDefender = fortressDefenders
    .filter(id => {
      const fortressId = getContainingFortressId(state, id)
      const hp = state.cardsByInstanceId[id].currentHp ?? getDefinition(state, id)?.baseHp ?? 0
      return Boolean(fortressId && getFortressOccupants(state, fortressId).length === 1 && hp <= 1)
    })
    .sort((a, b) => targetDurability(state, a) - targetDurability(state, b))[0]
  if (captureOpeningDefender) return captureOpeningDefender

  if (emptyFortresses.length > 0) return emptyFortresses.sort((a, b) => targetDurability(state, a) - targetDurability(state, b))[0]
  if (fortressDefenders.length > 0) return fortressDefenders.sort((a, b) => targetDurability(state, a) - targetDurability(state, b))[0]
  if (battlefieldTargets.length > 0) return battlefieldTargets.sort((a, b) => targetDurability(state, a) - targetDurability(state, b))[0]
  return enemyFortresses.sort((a, b) => targetDurability(state, a) - targetDurability(state, b))[0]
}

function strongestEntity(state: GameState, ids: string[]): string | undefined {
  return [...ids].sort((a, b) => attackScore(state, b) - attackScore(state, a))[0]
}

function attackScore(state: GameState, id: string): number {
  const card = getDefinition(state, id)
  const instance = state.cardsByInstanceId[id]
  if (card?.type !== 'entity' || !instance) return 0
  return (card.baseAttack ?? 0) + instance.equippedItemIds.reduce((sum, itemId) => sum + (getDefinition(state, itemId)?.attackBuff ?? 0), 0)
}

function targetDurability(state: GameState, id: string): number {
  const card = getDefinition(state, id)
  const instance = state.cardsByInstanceId[id]
  if (!card || !instance) return Number.MAX_SAFE_INTEGER
  if (card.type === 'fortress') return instance.currentFortressHp ?? card.fortressHp ?? 99
  if (card.type === 'entity') return instance.currentHp ?? card.baseHp ?? 99
  return Number.MAX_SAFE_INTEGER
}

function playerControlsEveryFortress(state: GameState, playerId: string): boolean {
  const fortresses = state.players.flatMap(player => getPlayerSuburbCards(state, player.playerId))
  return fortresses.length > 0 && fortresses.every(id => state.cardsByInstanceId[id]?.controllerPlayerId === playerId)
}

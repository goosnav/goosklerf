import { describe, expect, it } from 'vitest'
import { loadCards } from '@gk/cards'
import {
  getDefinition,
  getFortressOccupants,
  reduceGameAction,
  setupGame,
  type GameState,
  type InstanceId,
} from '@gk/engine'

function makeState(): GameState {
  return setupGame(loadCards(), {
    seed: 'gameplay-reducer-test',
    deckSize: 'medium',
    players: [
      { name: 'Alice', type: 'human' },
      { name: 'Bob', type: 'ai' },
    ],
    allowUnimplementedSpecials: true,
  })
}

function makeStateWithVisible(type: string): GameState {
  for (let i = 0; i < 40; i++) {
    const state = setupGame(loadCards(), {
      seed: `gameplay-reducer-test-${type}-${i}`,
      deckSize: 'medium',
      players: [
        { name: 'Alice', type: 'human' },
        { name: 'Bob', type: 'ai' },
      ],
      allowUnimplementedSpecials: true,
    })
    const playerId = state.activePlayerId
    const ids = [
      ...state.zones.hands[playerId].instanceIds,
      ...state.zones.shops[playerId].instanceIds,
    ]
    if (ids.some(id => getDefinition(state, id)?.type === type)) return state
  }
  throw new Error(`Could not find visible ${type}`)
}

function makeStateWithVisibleForBoth(types: string[]): GameState {
  for (let i = 0; i < 120; i++) {
    const state = setupGame(loadCards(), {
      seed: `gameplay-reducer-test-both-${i}`,
      deckSize: 'medium',
      players: [
        { name: 'Alice', type: 'human' },
        { name: 'Bob', type: 'ai' },
      ],
      allowUnimplementedSpecials: true,
    })
    const ok = state.players.every(player => {
      const ids = [
        ...state.zones.hands[player.playerId].instanceIds,
        ...state.zones.shops[player.playerId].instanceIds,
      ]
      return types.every(type => ids.some(id => getDefinition(state, id)?.type === type))
    })
    if (ok) return state
  }
  throw new Error(`Could not find visible ${types.join(',')} for both players`)
}

function visibleCard(state: GameState, playerId: string, type: string): InstanceId {
  const ids = [
    ...state.zones.hands[playerId].instanceIds,
    ...state.zones.shops[playerId].instanceIds,
  ]
  const found = ids.find(id => getDefinition(state, id)?.type === type)
  expect(found, `Expected visible ${type} for ${playerId}`).toBeTruthy()
  return found!
}

describe('gameplay reducer MVP actions', () => {
  it('plays an entity from hand or shop into a fortress', () => {
    let state = makeStateWithVisibleForBoth(['fortress', 'entity'])
    const playerId = state.activePlayerId
    const fortressId = visibleCard(state, playerId, 'fortress')
    const entityId = visibleCard(state, playerId, 'entity')
    let result = reduceGameAction(state, { type: 'PLAY_CARD', playerId, instanceId: fortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    result = reduceGameAction(state, { type: 'PLAY_CARD', playerId, instanceId: entityId, targetInstanceId: fortressId })
    expect(result.ok).toBe(true)
    expect(result.state?.cardsByInstanceId[fortressId].containedEntityIds).toContain(entityId)
    expect(result.state?.cardsByInstanceId[entityId].zone.zone).toBe('suburbs')
  })

  it('resolves a deterministic normal attack and defeats zero-HP targets', () => {
    let state = makeStateWithVisibleForBoth(['fortress', 'entity'])
    const attackerPlayerId = state.activePlayerId
    const defenderPlayerId = state.players.find(p => p.playerId !== attackerPlayerId)!.playerId
    const attackerFortressId = visibleCard(state, attackerPlayerId, 'fortress')
    const defenderFortressId = visibleCard(state, defenderPlayerId, 'fortress')
    const attackerId = visibleCard(state, attackerPlayerId, 'entity')
    const defenderId = visibleCard(state, defenderPlayerId, 'entity')

    let result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: attackerPlayerId, instanceId: attackerFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: attackerPlayerId, instanceId: attackerId, targetInstanceId: attackerFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    state.phase = 'movement'
    result = reduceGameAction(state, { type: 'MOVE_ENTITY', playerId: attackerPlayerId, entityInstanceId: attackerId, destination: 'battlefield' })
    expect(result.ok).toBe(true)
    state = result.state!
    state.phase = 'card_play'
    state.activePlayerId = defenderPlayerId
    result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: defenderPlayerId, instanceId: defenderFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: defenderPlayerId, instanceId: defenderId, targetInstanceId: defenderFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    state.phase = 'combat'
    state.activePlayerId = attackerPlayerId
    state.cardsByInstanceId[defenderId].currentHp = 1

    result = reduceGameAction(state, {
      type: 'NORMAL_ATTACK',
      playerId: attackerPlayerId,
      attackerInstanceId: attackerId,
      targetInstanceId: defenderId,
      diceRoll: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.state?.cardsByInstanceId[defenderId].zone.zone).toBe('graveyard')
  })

  it('captures a fortress after the last defender is defeated', () => {
    let state = makeStateWithVisibleForBoth(['fortress', 'entity'])
    const attackerPlayerId = state.activePlayerId
    const defenderPlayerId = state.players.find(p => p.playerId !== attackerPlayerId)!.playerId
    const attackerFortressId = visibleCard(state, attackerPlayerId, 'fortress')
    const defenderFortressId = visibleCard(state, defenderPlayerId, 'fortress')
    const attackerId = visibleCard(state, attackerPlayerId, 'entity')
    const defenderId = visibleCard(state, defenderPlayerId, 'entity')

    let result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: attackerPlayerId, instanceId: attackerFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: attackerPlayerId, instanceId: attackerId, targetInstanceId: attackerFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    state.phase = 'movement'
    result = reduceGameAction(state, { type: 'MOVE_ENTITY', playerId: attackerPlayerId, entityInstanceId: attackerId, destination: 'battlefield' })
    expect(result.ok).toBe(true)
    state = result.state!

    state.phase = 'card_play'
    state.activePlayerId = defenderPlayerId
    result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: defenderPlayerId, instanceId: defenderFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    result = reduceGameAction(state, { type: 'PLAY_CARD', playerId: defenderPlayerId, instanceId: defenderId, targetInstanceId: defenderFortressId })
    expect(result.ok).toBe(true)
    state = result.state!
    state.phase = 'combat'
    state.activePlayerId = attackerPlayerId
    state.cardsByInstanceId[defenderId].currentHp = 1

    result = reduceGameAction(state, {
      type: 'NORMAL_ATTACK',
      playerId: attackerPlayerId,
      attackerInstanceId: attackerId,
      targetInstanceId: defenderId,
      diceRoll: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.state?.cardsByInstanceId[defenderId].zone.zone).toBe('graveyard')
    expect(result.state?.cardsByInstanceId[defenderFortressId].controllerPlayerId).toBe(attackerPlayerId)
    expect(result.state?.zones.suburbs[attackerPlayerId].instanceIds).toContain(defenderFortressId)
    expect(getFortressOccupants(result.state!, defenderFortressId)).toContain(attackerId)
    expect(result.logEntries[0].data?.['captured']).toBe(true)
    expect(result.logEntries[0].data?.['capturedByClearingDefenders']).toBe(true)
  })

  it('plays fortresses to suburbs instead of the battlefield', () => {
    const state = makeStateWithVisible('fortress')
    const playerId = state.activePlayerId
    const fortressId = visibleCard(state, playerId, 'fortress')
    const result = reduceGameAction(state, { type: 'PLAY_CARD', playerId, instanceId: fortressId })
    expect(result.ok).toBe(true)
    expect(result.state?.zones.suburbs[playerId].instanceIds).toContain(fortressId)
    expect(result.state?.zones.battlefield.instanceIds).not.toContain(fortressId)
  })

  it('does not discard a regular item when no friendly entity can equip it', () => {
    const state = makeStateWithVisible('item_regular')
    const playerId = state.activePlayerId
    const itemId = visibleCard(state, playerId, 'item_regular')
    const originalZone = state.cardsByInstanceId[itemId].zone
    const result = reduceGameAction(state, { type: 'PLAY_CARD', playerId, instanceId: itemId })
    expect(result.ok).toBe(false)
    expect(state.cardsByInstanceId[itemId].zone).toEqual(originalZone)
  })
})

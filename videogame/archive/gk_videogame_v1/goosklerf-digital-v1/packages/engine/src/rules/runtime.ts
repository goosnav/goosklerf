import { loadCards, type CardDefinition } from '@gk/cards'
import { MAX_ENTITIES_PER_FORTRESS, MAX_ENTITIES_PER_PLAYER_ON_BATTLEFIELD, MAX_ITEMS_PER_ENTITY } from '@gk/shared'
import type { CardInstance, GameState, InstanceId, PlayerId } from '../state/gameState.js'
import type { ZoneName } from '../state/zones.js'

export function getDefinition(state: GameState, instanceId: InstanceId): CardDefinition | undefined {
  const instance = state.cardsByInstanceId[instanceId]
  if (!instance) return undefined
  return loadCards()[instance.definitionId]
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map(p => ({ ...p })),
    zones: {
      battlefield: { instanceIds: [...state.zones.battlefield.instanceIds] },
      shops: clonePlayerZones(state.zones.shops),
      hands: clonePlayerZones(state.zones.hands),
      decks: clonePlayerZones(state.zones.decks),
      graveyards: clonePlayerZones(state.zones.graveyards),
      suburbs: clonePlayerZones(state.zones.suburbs),
    },
    cardsByInstanceId: Object.fromEntries(
      Object.entries(state.cardsByInstanceId).map(([id, card]) => [
        id,
        {
          ...card,
          zone: { ...card.zone },
          equippedItemIds: [...card.equippedItemIds],
          containedEntityIds: [...card.containedEntityIds],
          temporaryModifiers: card.temporaryModifiers.map(m => ({ ...m })),
          persistentModifiers: card.persistentModifiers.map(m => ({ ...m })),
        },
      ]),
    ),
    oldAgeCounters: { ...state.oldAgeCounters },
    cardPlaysThisTurn: { ...state.cardPlaysThisTurn },
    log: [...state.log],
    landlordStatus: state.landlordStatus ? { ...state.landlordStatus } : undefined,
    pendingEngagement: state.pendingEngagement
      ? {
          ...state.pendingEngagement,
          attackerIds: [...state.pendingEngagement.attackerIds],
          defenderIds: [...state.pendingEngagement.defenderIds],
        }
      : undefined,
    pendingChoice: state.pendingChoice
      ? { ...state.pendingChoice, options: [...state.pendingChoice.options] }
      : undefined,
  }
}

function clonePlayerZones(zones: Record<PlayerId, { instanceIds: InstanceId[] }>) {
  return Object.fromEntries(
    Object.entries(zones).map(([playerId, zone]) => [playerId, { instanceIds: [...zone.instanceIds] }]),
  )
}

export function isOwnedByActivePlayer(state: GameState, instanceId: InstanceId, playerId: PlayerId): boolean {
  const instance = state.cardsByInstanceId[instanceId]
  return Boolean(instance && instance.controllerPlayerId === playerId)
}

export function isInPlayerZone(
  state: GameState,
  instanceId: InstanceId,
  playerId: PlayerId,
  zones: ZoneName[],
): boolean {
  const instance = state.cardsByInstanceId[instanceId]
  return Boolean(instance && instance.zone.playerId === playerId && zones.includes(instance.zone.zone))
}

export function moveCard(state: GameState, instanceId: InstanceId, zone: ZoneName, playerId: PlayerId): void {
  const instance = state.cardsByInstanceId[instanceId]
  if (!instance) return
  removeFromCurrentZone(state, instance)
  instance.zone = { zone, playerId }
  zoneList(state, zone, playerId).push(instanceId)
}

function removeFromCurrentZone(state: GameState, instance: CardInstance): void {
  const list = zoneList(state, instance.zone.zone, instance.zone.playerId)
  const index = list.indexOf(instance.instanceId)
  if (index !== -1) list.splice(index, 1)
}

function zoneList(state: GameState, zone: ZoneName, playerId: PlayerId): InstanceId[] {
  if (zone === 'battlefield') return state.zones.battlefield.instanceIds
  if (zone === 'hand') return state.zones.hands[playerId].instanceIds
  if (zone === 'deck') return state.zones.decks[playerId].instanceIds
  if (zone === 'graveyard') return state.zones.graveyards[playerId].instanceIds
  if (zone === 'shop') return state.zones.shops[playerId].instanceIds
  return state.zones.suburbs[playerId].instanceIds
}

export function drawCards(state: GameState, playerId: PlayerId, count: number): number {
  let drawn = 0
  const deck = state.zones.decks[playerId].instanceIds
  const hand = state.zones.hands[playerId].instanceIds
  while (drawn < count && deck.length > 0) {
    const instanceId = deck.shift()!
    hand.push(instanceId)
    state.cardsByInstanceId[instanceId].zone = { zone: 'hand', playerId }
    drawn++
  }
  return drawn
}

export function playPermanent(state: GameState, instanceId: InstanceId, playerId: PlayerId): void {
  const instance = state.cardsByInstanceId[instanceId]
  const def = getDefinition(state, instanceId)
  if (!instance || !def) return
  if (def.type === 'fortress') {
    instance.maxFortressHp = instance.maxFortressHp ?? def.fortressHp ?? 1
    instance.currentFortressHp = instance.currentFortressHp ?? instance.maxFortressHp
  }
  moveCard(state, instanceId, def.type === 'fortress' ? 'suburbs' : 'battlefield', playerId)
}

export function playEntityIntoFortress(
  state: GameState,
  entityInstanceId: InstanceId,
  fortressInstanceId: InstanceId,
  playerId: PlayerId,
): string | null {
  const entity = state.cardsByInstanceId[entityInstanceId]
  const fortress = state.cardsByInstanceId[fortressInstanceId]
  const entityDef = getDefinition(state, entityInstanceId)
  const fortressDef = getDefinition(state, fortressInstanceId)
  if (!entity || !fortress || !entityDef || !fortressDef) return 'Missing entity or fortress'
  if (entityDef.type !== 'entity') return 'Only entities can enter fortresses'
  if (fortressDef.type !== 'fortress') return 'Target must be a fortress'
  if (fortress.controllerPlayerId !== playerId) return 'Entity can only enter your fortress'
  if (fortress.zone.zone !== 'suburbs') return 'Fortress is not in suburbs'
  if (fortress.containedEntityIds.length >= MAX_ENTITIES_PER_FORTRESS) return 'Fortress is full'

  entity.maxHp = entity.maxHp ?? entityDef.baseHp ?? 1
  entity.currentHp = entity.currentHp ?? entity.maxHp
  leaveCurrentFortress(state, entityInstanceId)
  moveCard(state, entityInstanceId, 'suburbs', playerId)
  for (const itemId of entity.equippedItemIds) {
    moveCard(state, itemId, 'suburbs', playerId)
  }
  fortress.containedEntityIds.push(entityInstanceId)
  applyFortressModifier(state, entityInstanceId, fortressInstanceId)
  return null
}

export function moveEntityToFortress(
  state: GameState,
  entityInstanceId: InstanceId,
  fortressInstanceId: InstanceId,
  playerId: PlayerId,
): string | null {
  const entity = state.cardsByInstanceId[entityInstanceId]
  if (!entity) return 'Missing entity'
  if (entity.controllerPlayerId !== playerId) return 'Cannot move another player entity'
  return playEntityIntoFortress(state, entityInstanceId, fortressInstanceId, playerId)
}

export function moveEntityToBattlefield(state: GameState, entityInstanceId: InstanceId, playerId: PlayerId): string | null {
  const entity = state.cardsByInstanceId[entityInstanceId]
  const entityDef = getDefinition(state, entityInstanceId)
  if (!entity || !entityDef) return 'Missing entity'
  if (entityDef.type !== 'entity') return 'Only entities can move to battlefield'
  if (entity.controllerPlayerId !== playerId) return 'Cannot move another player entity'
  if (
    entity.zone.zone !== 'battlefield' &&
    getPlayerBattleCards(state, playerId, 'entity').length >= MAX_ENTITIES_PER_PLAYER_ON_BATTLEFIELD
  ) {
    return 'Battlefield is full'
  }
  leaveCurrentFortress(state, entityInstanceId)
  moveCard(state, entityInstanceId, 'battlefield', playerId)
  for (const itemId of entity.equippedItemIds) {
    moveCard(state, itemId, 'battlefield', playerId)
  }
  return null
}

export function getContainingFortressId(state: GameState, entityInstanceId: InstanceId): InstanceId | undefined {
  for (const fortressId of Object.values(state.zones.suburbs).flatMap(zone => zone.instanceIds)) {
    const fortress = state.cardsByInstanceId[fortressId]
    if (fortress?.containedEntityIds.includes(entityInstanceId)) return fortressId
  }
  return undefined
}

function leaveCurrentFortress(state: GameState, entityInstanceId: InstanceId): void {
  const fortressId = getContainingFortressId(state, entityInstanceId)
  if (!fortressId) return
  const fortress = state.cardsByInstanceId[fortressId]
  fortress.containedEntityIds = fortress.containedEntityIds.filter(id => id !== entityInstanceId)
  removeFortressModifier(state, entityInstanceId)
}

function applyFortressModifier(state: GameState, entityInstanceId: InstanceId, fortressInstanceId: InstanceId): void {
  const entity = state.cardsByInstanceId[entityInstanceId]
  const fortress = getDefinition(state, fortressInstanceId)
  if (!entity || !fortress) return
  removeFortressModifier(state, entityInstanceId)
  const hpDelta = fortress.hpBuff ?? 0
  const attackDelta = fortress.attackBuff ?? 0
  if (hpDelta) {
    entity.maxHp = Math.max(1, (entity.maxHp ?? 1) + hpDelta)
    entity.currentHp = Math.max(1, (entity.currentHp ?? entity.maxHp) + hpDelta)
  }
  entity.persistentModifiers.push({
    id: `fortress:${fortressInstanceId}`,
    source: fortressInstanceId,
    attackDelta,
    hpDelta,
    description: `Fortress buff from ${fortress.name}`,
  })
}

function removeFortressModifier(state: GameState, entityInstanceId: InstanceId): void {
  const entity = state.cardsByInstanceId[entityInstanceId]
  if (!entity) return
  const fortressModifiers = entity.persistentModifiers.filter(mod => mod.id.startsWith('fortress:'))
  for (const modifier of fortressModifiers) {
    const hpDelta = modifier.hpDelta ?? 0
    if (hpDelta) {
      entity.maxHp = Math.max(1, (entity.maxHp ?? 1) - hpDelta)
      entity.currentHp = Math.min(entity.currentHp ?? entity.maxHp, entity.maxHp)
    }
  }
  entity.persistentModifiers = entity.persistentModifiers.filter(mod => !mod.id.startsWith('fortress:'))
}

export function equipItem(state: GameState, itemInstanceId: InstanceId, targetEntityInstanceId: InstanceId): string | null {
  const item = state.cardsByInstanceId[itemInstanceId]
  const entity = state.cardsByInstanceId[targetEntityInstanceId]
  const itemDef = getDefinition(state, itemInstanceId)
  const entityDef = getDefinition(state, targetEntityInstanceId)
  if (!item || !entity || !itemDef || !entityDef) return 'Missing item or target'
  if (itemDef.type !== 'item_regular') return 'Only regular items can be equipped'
  if (entityDef.type !== 'entity') return 'Items can only be equipped to entities'
  if (entity.equippedItemIds.length >= MAX_ITEMS_PER_ENTITY) return 'Entity already has maximum items'
  if (item.controllerPlayerId !== entity.controllerPlayerId) return 'Cannot equip item to another player entity'

  moveCard(state, itemInstanceId, entity.zone.zone, entity.zone.playerId)
  entity.equippedItemIds.push(itemInstanceId)
  if (itemDef.hpBuff) {
    entity.maxHp = Math.max(1, (entity.maxHp ?? entityDef.baseHp ?? 1) + itemDef.hpBuff)
    entity.currentHp = Math.max(1, (entity.currentHp ?? entity.maxHp) + itemDef.hpBuff)
  }
  return null
}

export interface ConsumableResult {
  ok: boolean
  message: string
}

export function applyConsumable(state: GameState, itemInstanceId: InstanceId, targetInstanceId?: InstanceId): ConsumableResult {
  const item = state.cardsByInstanceId[itemInstanceId]
  const itemDef = getDefinition(state, itemInstanceId)
  if (!item || !itemDef) return { ok: false, message: 'Missing consumable' }
  if (itemDef.type !== 'item_consumable') return { ok: false, message: 'Card is not consumable' }
  if (!targetInstanceId) return { ok: false, message: `${itemDef.name} needs a target for MVP automation.` }

  const target = state.cardsByInstanceId[targetInstanceId]
  const targetDef = getDefinition(state, targetInstanceId)
  if (!target || !targetDef) return { ok: false, message: 'Target is missing' }

  let message: string | null = null
  const numericEffect = itemDef.hpBuff ?? 0
  if (numericEffect > 0 && target.controllerPlayerId === item.controllerPlayerId && targetDef.type === 'entity') {
    const maxHp = target.maxHp ?? targetDef.baseHp ?? numericEffect
    target.currentHp = Math.min(maxHp, (target.currentHp ?? maxHp) + numericEffect)
    message = `${itemDef.name} healed ${targetDef.name} for ${numericEffect}.`
  } else if (numericEffect < 0 && target.controllerPlayerId !== item.controllerPlayerId) {
    const defeated = damageCard(state, targetInstanceId, Math.abs(numericEffect))
    message = `${itemDef.name} dealt ${Math.abs(numericEffect)} damage to ${targetDef.name}${defeated ? ' and defeated it' : ''}.`
  } else if (
    target.controllerPlayerId !== item.controllerPlayerId &&
    /kill|die|destroy|defeat/i.test(itemDef.rulesText) &&
    /roll\s*<=?\s*[1-6]/i.test(itemDef.miscStat ?? itemDef.rulesText)
  ) {
    const threshold = parseRollThreshold(itemDef.miscStat ?? itemDef.rulesText)
    const roll = 3
    if (threshold && roll <= threshold) {
      defeatCard(state, targetInstanceId)
      message = `${itemDef.name} defeated ${targetDef.name} on its MVP special roll.`
    } else {
      message = `${itemDef.name} missed its MVP special roll.`
    }
  }

  if (!message) {
    return { ok: false, message: `${itemDef.name} has no valid MVP target/effect here.` }
  }
  moveCard(state, itemInstanceId, 'graveyard', item.ownerPlayerId)
  return { ok: true, message }
}

function parseRollThreshold(text: string): number | undefined {
  const match = text.match(/roll\s*<=?\s*([1-6])/i)
  return match ? Number(match[1]) : undefined
}

export function getAttackValue(state: GameState, instanceId: InstanceId): number {
  const instance = state.cardsByInstanceId[instanceId]
  const def = getDefinition(state, instanceId)
  if (!instance || !def) return 0
  let attack = def.type === 'entity' ? (def.baseAttack ?? 0) : 0
  for (const itemId of instance.equippedItemIds) {
    attack += getDefinition(state, itemId)?.attackBuff ?? 0
  }
  for (const modifier of [...instance.persistentModifiers, ...instance.temporaryModifiers]) {
    attack += modifier.attackDelta ?? 0
  }
  return Math.max(0, Math.min(6, attack))
}

export function damageCard(state: GameState, instanceId: InstanceId, amount: number): boolean {
  const instance = state.cardsByInstanceId[instanceId]
  const def = getDefinition(state, instanceId)
  if (!instance || !def) return false
  if (def.type === 'fortress') {
    instance.currentFortressHp = Math.max(0, (instance.currentFortressHp ?? def.fortressHp ?? 1) - amount)
    if (instance.currentFortressHp <= 0) {
      defeatCard(state, instanceId)
      return true
    }
    return false
  }
  if (def.type === 'entity') {
    instance.currentHp = Math.max(0, (instance.currentHp ?? def.baseHp ?? 1) - amount)
    if (instance.currentHp <= 0) {
      defeatCard(state, instanceId)
      return true
    }
  }
  return false
}

export function defeatCard(state: GameState, instanceId: InstanceId): void {
  const instance = state.cardsByInstanceId[instanceId]
  if (!instance) return
  const def = getDefinition(state, instanceId)
  if (def?.type === 'fortress') {
    for (const occupantId of [...instance.containedEntityIds]) {
      defeatCard(state, occupantId)
    }
    instance.containedEntityIds = []
  }
  leaveCurrentFortress(state, instanceId)
  for (const itemId of [...instance.equippedItemIds]) {
    moveCard(state, itemId, 'graveyard', state.cardsByInstanceId[itemId].ownerPlayerId)
  }
  instance.equippedItemIds = []
  moveCard(state, instanceId, 'graveyard', instance.ownerPlayerId)
}

export function getPlayerBattleCards(state: GameState, playerId: PlayerId, type?: 'entity' | 'fortress'): InstanceId[] {
  return state.zones.battlefield.instanceIds.filter(id => {
    const instance = state.cardsByInstanceId[id]
    const def = getDefinition(state, id)
    return instance?.controllerPlayerId === playerId && (!type || def?.type === type)
  })
}

export function getPlayerSuburbCards(state: GameState, playerId: PlayerId): InstanceId[] {
  return state.zones.suburbs[playerId].instanceIds.filter(id => getDefinition(state, id)?.type === 'fortress')
}

export function getFortressOccupants(state: GameState, fortressInstanceId: InstanceId): InstanceId[] {
  return state.cardsByInstanceId[fortressInstanceId]?.containedEntityIds ?? []
}

export function getPlayerInPlayEntities(state: GameState, playerId: PlayerId): InstanceId[] {
  const fortresses = getPlayerSuburbCards(state, playerId)
  return [
    ...getPlayerBattleCards(state, playerId, 'entity'),
    ...fortresses.flatMap(fortressId => getFortressOccupants(state, fortressId)),
  ]
}

export function getEnemyBattleCards(state: GameState, playerId: PlayerId): InstanceId[] {
  const battlefieldTargets = state.zones.battlefield.instanceIds.filter(id => {
    const instance = state.cardsByInstanceId[id]
    const def = getDefinition(state, id)
    return instance?.controllerPlayerId !== playerId && def?.type === 'entity'
  })
  const fortressTargets = state.players
    .filter(player => player.playerId !== playerId)
    .flatMap(player => getPlayerSuburbCards(state, player.playerId))
  const occupiedFortresses = fortressTargets.filter(fortressId => getFortressOccupants(state, fortressId).length > 0)
  const emptyFortresses = fortressTargets.filter(fortressId => getFortressOccupants(state, fortressId).length === 0)
  const occupantTargets = occupiedFortresses.flatMap(fortressId => getFortressOccupants(state, fortressId))
  return [...battlefieldTargets, ...occupantTargets, ...emptyFortresses, ...occupiedFortresses]
}

export function captureFortress(
  state: GameState,
  fortressInstanceId: InstanceId,
  attackerInstanceId: InstanceId,
  playerId: PlayerId,
): string | null {
  const fortress = state.cardsByInstanceId[fortressInstanceId]
  const fortressDef = getDefinition(state, fortressInstanceId)
  if (!fortress || fortressDef?.type !== 'fortress') return 'Target is not a fortress'
  if (fortress.containedEntityIds.length > 0) return 'Fortress still has defenders'
  fortress.controllerPlayerId = playerId
  moveCard(state, fortressInstanceId, 'suburbs', playerId)
  const moveError = moveEntityToFortress(state, attackerInstanceId, fortressInstanceId, playerId)
  if (moveError) return moveError
  return null
}

export function checkEliminationsAndWinner(state: GameState, options: { advanceLandlord?: boolean } = {}): void {
  for (const player of state.players) {
    if (player.eliminated) continue
    const hasResources =
      state.zones.hands[player.playerId].instanceIds.length > 0 ||
      state.zones.decks[player.playerId].instanceIds.length > 0 ||
      state.zones.shops[player.playerId].instanceIds.length > 0 ||
      getPlayerInPlayEntities(state, player.playerId).length > 0
    player.eliminated = !hasResources
  }
  const alive = state.players.filter(p => !p.eliminated)
  const landlordCandidate = getLandlordCandidate(state)
  if (landlordCandidate) {
    if (state.landlordStatus?.claimantPlayerId !== landlordCandidate) {
      state.landlordStatus = {
        claimantPlayerId: landlordCandidate,
        turnsRemaining: Math.max(1, alive.length),
      }
    } else if (options.advanceLandlord) {
      state.landlordStatus.turnsRemaining -= 1
      if (state.landlordStatus.turnsRemaining <= 0) {
        state.phase = 'game_over'
        state.winner = landlordCandidate
        state.gameOverReason = 'landlord'
        return
      }
    }
  } else {
    state.landlordStatus = undefined
  }
  if (alive.length === 1) {
    state.phase = 'game_over'
    state.winner = alive[0].playerId
    state.gameOverReason = 'last_player_with_resources'
  } else if (alive.length === 0) {
    state.phase = 'game_over'
    state.gameOverReason = 'hamlet'
  }
}

function getLandlordCandidate(state: GameState): PlayerId | undefined {
  const fortressesInPlay = state.players.flatMap(player => getPlayerSuburbCards(state, player.playerId))
  if (fortressesInPlay.length === 0 || hasUnplayedFortressCards(state)) return undefined
  const firstController = state.cardsByInstanceId[fortressesInPlay[0]]?.controllerPlayerId
  if (!firstController) return undefined
  return fortressesInPlay.every(id => state.cardsByInstanceId[id]?.controllerPlayerId === firstController)
    ? firstController
    : undefined
}

function hasUnplayedFortressCards(state: GameState): boolean {
  return state.players.some(player => {
    const zones = [
      state.zones.hands[player.playerId].instanceIds,
      state.zones.decks[player.playerId].instanceIds,
      state.zones.shops[player.playerId].instanceIds,
    ]
    return zones.some(ids => ids.some(id => getDefinition(state, id)?.type === 'fortress'))
  })
}

export function nextActivePlayer(state: GameState): void {
  const current = state.players.findIndex(p => p.playerId === state.activePlayerId)
  for (let offset = 1; offset <= state.players.length; offset++) {
    const index = (current + offset) % state.players.length
    const candidate = state.players[index]
    if (!candidate.eliminated) {
      state.activePlayerId = candidate.playerId
      if (index <= current) state.turnNumber += 1
      break
    }
  }
  for (const card of Object.values(state.cardsByInstanceId)) {
    card.participatedThisTurn = false
    card.exhaustedThisEngagement = false
  }
  state.cardPlaysThisTurn[state.activePlayerId] = 0
}

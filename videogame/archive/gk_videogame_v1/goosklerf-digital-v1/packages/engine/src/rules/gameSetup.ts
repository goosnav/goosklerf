import type { CardDatabase } from '@gk/cards'
import type { GameState, PlayerState, CardInstance, Zones } from '../state/gameState.js'
import type { RngState } from '../rng/rng.js'
import { SeededRng } from '../rng/rng.js'
import { generateLegalDeck } from './deckGeneration.js'
import { generateInstanceId, generateGameId, STARTING_HAND_SIZE, STARTING_SHOP_SIZE, type DeckSize } from '@gk/shared'
import { makeLogEntry } from '../logging/gameLog.js'

export interface PlayerSetupInput {
  name: string
  type: 'human' | 'ai'
  aiPersonalityId?: string
}

export interface SetupOptions {
  seed: string
  deckSize: DeckSize
  players: PlayerSetupInput[]
  allowUnimplementedSpecials?: boolean
}

export function setupGame(cards: CardDatabase, opts: SetupOptions): GameState {
  const { seed, deckSize, players } = opts
  const rng = new SeededRng(seed)
  const gameId = generateGameId(seed, 0)

  let instanceCounter = 0
  function nextInstance(definitionId: string): string {
    return generateInstanceId(definitionId, instanceCounter++)
  }

  const playerStates: PlayerState[] = players.map((p, i) => ({
    playerId: `player_${i}`,
    name: p.name,
    type: p.type,
    aiPersonalityId: p.aiPersonalityId,
    eliminated: false,
    seatIndex: i,
  }))

  const cardsByInstanceId: Record<string, CardInstance> = {}

  const zones: Zones = {
    battlefield: { instanceIds: [] },
    shops: {},
    hands: {},
    decks: {},
    graveyards: {},
    suburbs: {},
  }

  for (const player of playerStates) {
    zones.shops[player.playerId]      = { instanceIds: [] }
    zones.hands[player.playerId]      = { instanceIds: [] }
    zones.decks[player.playerId]      = { instanceIds: [] }
    zones.graveyards[player.playerId] = { instanceIds: [] }
    zones.suburbs[player.playerId]    = { instanceIds: [] }
  }

  for (const player of playerStates) {
    const deckDefIds = generateLegalDeck(cards, deckSize, rng, {
      allowUnimplementedSpecials: opts.allowUnimplementedSpecials,
    })
    const shuffled = rng.shuffle(deckDefIds)

    for (const defId of shuffled) {
      const card = cards[defId]!
      const instanceId = nextInstance(defId)
      cardsByInstanceId[instanceId] = {
        instanceId,
        definitionId: defId,
        ownerPlayerId: player.playerId,
        controllerPlayerId: player.playerId,
        zone: { zone: 'deck', playerId: player.playerId },
        currentHp: card.baseHp,
        maxHp: card.baseHp,
        currentFortressHp: card.fortressHp,
        maxFortressHp: card.fortressHp,
        equippedItemIds: [],
        containedEntityIds: [],
        exhaustedThisEngagement: false,
        participatedThisTurn: false,
        temporaryModifiers: [],
        persistentModifiers: [],
      }
      zones.decks[player.playerId].instanceIds.push(instanceId)
    }

    for (let i = 0; i < STARTING_SHOP_SIZE; i++) {
      const instanceId = zones.decks[player.playerId].instanceIds.shift()!
      zones.shops[player.playerId].instanceIds.push(instanceId)
      cardsByInstanceId[instanceId].zone = { zone: 'shop', playerId: player.playerId }
    }

    for (let i = 0; i < STARTING_HAND_SIZE; i++) {
      const instanceId = zones.decks[player.playerId].instanceIds.shift()!
      zones.hands[player.playerId].instanceIds.push(instanceId)
      cardsByInstanceId[instanceId].zone = { zone: 'hand', playerId: player.playerId }
    }
  }

  const firstPlayerIndex = rng.nextInt(0, playerStates.length)
  const activePlayerId = playerStates[firstPlayerIndex].playerId

  const rngState: RngState = rng.getState()

  const setupLog = makeLogEntry({
    turnNumber: 0,
    roundNumber: 0,
    playerId: activePlayerId,
    category: 'setup',
    message: `Game ${gameId} initialized. First player: ${playerStates[firstPlayerIndex].name}`,
  })

  return {
    gameId,
    ruleset: 'classic_advanced_v1',
    rngSeed: seed,
    rngState,
    players: playerStates,
    activePlayerId,
    turnNumber: 1,
    roundNumber: 1,
    phase: 'card_play',
    zones,
    cardsByInstanceId,
    oldAgeCounters: Object.fromEntries(playerStates.map(p => [p.playerId, 0])),
    cardPlaysThisTurn: Object.fromEntries(playerStates.map(p => [p.playerId, 0])),
    log: [setupLog],
  }
}

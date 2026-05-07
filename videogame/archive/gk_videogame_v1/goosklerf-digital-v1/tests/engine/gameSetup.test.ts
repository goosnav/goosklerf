import { describe, it, expect } from 'vitest'
import { setupGame, type SetupOptions } from '../../packages/engine/src/rules/gameSetup.js'
import { loadCards } from '@gk/cards'
import { STARTING_HAND_SIZE, STARTING_SHOP_SIZE } from '@gk/shared'

function makeOpts(overrides: Partial<SetupOptions> = {}): SetupOptions {
  return {
    seed: 'test-setup-seed',
    deckSize: 'medium',
    players: [
      { name: 'Alice', type: 'human' },
      { name: 'Bob', type: 'ai', aiPersonalityId: 'butcher' },
    ],
    ...overrides,
  }
}

describe('setupGame', () => {
  it('creates correct number of players (2)', () => {
    const cards = loadCards()
    const state = setupGame(cards, makeOpts())
    expect(state.players.length).toBe(2)
  })

  it('creates 3-player game', () => {
    const cards = loadCards()
    const state = setupGame(cards, {
      ...makeOpts(),
      players: [
        { name: 'A', type: 'human' },
        { name: 'B', type: 'ai' },
        { name: 'C', type: 'ai' },
      ],
    })
    expect(state.players.length).toBe(3)
  })

  it('creates 7-card starting hand per player', () => {
    const cards = loadCards()
    const state = setupGame(cards, makeOpts())
    for (const player of state.players) {
      expect(state.zones.hands[player.playerId].instanceIds.length)
        .toBe(STARTING_HAND_SIZE)
    }
  })

  it('creates 7-card shop per player', () => {
    const cards = loadCards()
    const state = setupGame(cards, makeOpts())
    for (const player of state.players) {
      expect(state.zones.shops[player.playerId].instanceIds.length)
        .toBe(STARTING_SHOP_SIZE)
    }
  })

  it('starts in card_play phase', () => {
    const cards = loadCards()
    const state = setupGame(cards, makeOpts())
    expect(state.phase).toBe('card_play')
  })

  it('same seed produces same first player', () => {
    const cards = loadCards()
    const s1 = setupGame(cards, makeOpts({ seed: 'first-player-seed' }))
    const s2 = setupGame(cards, makeOpts({ seed: 'first-player-seed' }))
    expect(s1.activePlayerId).toBe(s2.activePlayerId)
  })

  it('battlefield starts empty', () => {
    const cards = loadCards()
    const state = setupGame(cards, makeOpts())
    expect(state.zones.battlefield.instanceIds).toHaveLength(0)
  })

  it('all instance IDs are unique', () => {
    const cards = loadCards()
    const state = setupGame(cards, makeOpts())
    const ids = Object.keys(state.cardsByInstanceId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('total cards per player = deck total', () => {
    const cards = loadCards()
    const state = setupGame(cards, makeOpts())
    for (const player of state.players) {
      const handCount = state.zones.hands[player.playerId].instanceIds.length
      const shopCount = state.zones.shops[player.playerId].instanceIds.length
      const deckCount = state.zones.decks[player.playerId].instanceIds.length
      expect(handCount + shopCount + deckCount).toBe(36)
    }
  })

  it('creates 4-player game', () => {
    const cards = loadCards()
    const state = setupGame(cards, {
      ...makeOpts(),
      players: [
        { name: 'A', type: 'human' },
        { name: 'B', type: 'ai' },
        { name: 'C', type: 'ai' },
        { name: 'D', type: 'ai' },
      ],
    })
    expect(state.players.length).toBe(4)
    expect(state.zones.battlefield.instanceIds).toHaveLength(0)
  })
})

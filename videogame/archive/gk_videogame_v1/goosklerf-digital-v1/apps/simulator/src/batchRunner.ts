import { reduceGameAction, setupGame, type SetupOptions } from '@gk/engine'
import { loadCards } from '@gk/cards'
import type { GameState } from '@gk/engine'
import type { DeckSize } from '@gk/shared'
import { createAiController } from '@gk/ai'

export interface SimResult {
  gameId: string
  seed: string
  playerCount: number
  deckSize: string
  deckSizePerPlayer: number[]
  handSizePerPlayer: number[]
  shopSizePerPlayer: number[]
  validCardCount: number
  invalidCardCount: number
  winner?: string
  gameOverReason?: string
  turnNumber: number
  actionCount: number
  illegalActionCount: number
  unimplementedSpecialCount: number
  endedBy: 'winner' | 'max_turns' | 'error'
  error?: string
  metrics: SimMetrics
}

export interface SimMetrics {
  cardsPlayed: number
  cardsDiscarded: number
  entitiesPlayed: number
  fortressesBuilt: number
  itemsEquipped: number
  consumablesUsed: number
  cardsDrawn: number
  attacks: number
  hits: number
  misses: number
  entitiesDefeated: number
  fortressesDestroyed: number
  fortressesCaptured: number
  fortressAssaults: number
  attacksOnEmptyFortresses: number
  attacksOnOccupiedFortresses: number
  attacksOnFortressDefenders: number
  captureOpportunities: number
  capturesAfterClearingDefenders: number
  entityMoves: number
  turns: number
  victoryType: string
}

export interface BatchOptions {
  gameCount: number
  playerCount: number
  baseSeed: string
  deckSize: DeckSize
  maxTurns: number
  allowUnimplementedSpecials: boolean
}

export function runBatch(opts: BatchOptions): SimResult[] {
  const cards = loadCards()
  const allCards = Object.values(cards)
  const validCardCount   = allCards.filter(c => c.validationStatus !== 'invalid').length
  const invalidCardCount = allCards.filter(c => c.validationStatus === 'invalid').length

  const results: SimResult[] = []

  for (let i = 0; i < opts.gameCount; i++) {
    const seed = `${opts.baseSeed}-game-${i}`
    const players = Array.from({ length: opts.playerCount }, (_, j) => ({
      name: `Player_${j + 1}`,
      type: 'ai' as const,
      aiPersonalityId: 'butcher',
    }))

    const setupOpts: SetupOptions = {
      seed,
      deckSize: opts.deckSize,
      players,
      allowUnimplementedSpecials: opts.allowUnimplementedSpecials,
    }
    let state: GameState = setupGame(cards, setupOpts)
    const initialDeckSizes = state.players.map(p => state.zones.decks[p.playerId].instanceIds.length)
    const initialHandSizes = state.players.map(p => state.zones.hands[p.playerId].instanceIds.length)
    const initialShopSizes = state.players.map(p => state.zones.shops[p.playerId].instanceIds.length)
    const unimplementedSpecialCount = Object.values(state.cardsByInstanceId).filter(instance => {
      const card = cards[instance.definitionId]
      return card?.automationStatus === 'not_implemented'
    }).length

    let actionCount = 0
    let illegalActionCount = 0
    let endedBy: SimResult['endedBy'] = 'max_turns'
    let error: string | undefined
    const ai = createAiController('butcher')

    while (state.phase !== 'game_over' && state.turnNumber <= opts.maxTurns) {
      try {
        const action = ai.selectAction(state, state.activePlayerId)
        const result = reduceGameAction(state, action)
        actionCount++
        if (result.ok && result.state) {
          state = result.state
        } else {
          illegalActionCount++
          const fallback = reduceGameAction(state, { type: 'END_PHASE', playerId: state.activePlayerId })
          if (fallback.ok && fallback.state) state = fallback.state
          else throw result.error ?? fallback.error ?? new Error('Unknown simulator reducer failure')
        }
      } catch (e) {
        endedBy = 'error'
        error = e instanceof Error ? e.message : String(e)
        break
      }
    }

    if (state.phase === 'game_over') endedBy = 'winner'

    results.push({
      gameId: state.gameId,
      seed,
      playerCount: opts.playerCount,
      deckSize: opts.deckSize,
      deckSizePerPlayer: initialDeckSizes,
      handSizePerPlayer: initialHandSizes,
      shopSizePerPlayer: initialShopSizes,
      validCardCount,
      invalidCardCount,
      winner: state.winner,
      gameOverReason: state.gameOverReason,
      turnNumber: state.turnNumber,
      actionCount,
      illegalActionCount,
      unimplementedSpecialCount,
      endedBy,
      error,
      metrics: collectMetrics(state),
    })
  }

  return results
}

function collectMetrics(state: GameState): SimMetrics {
  const metrics: SimMetrics = {
    cardsPlayed: 0,
    cardsDiscarded: 0,
    entitiesPlayed: 0,
    fortressesBuilt: 0,
    itemsEquipped: 0,
    consumablesUsed: 0,
    cardsDrawn: 0,
    attacks: 0,
    hits: 0,
    misses: 0,
    entitiesDefeated: 0,
    fortressesDestroyed: 0,
    fortressesCaptured: 0,
    fortressAssaults: 0,
    attacksOnEmptyFortresses: 0,
    attacksOnOccupiedFortresses: 0,
    attacksOnFortressDefenders: 0,
    captureOpportunities: 0,
    capturesAfterClearingDefenders: 0,
    entityMoves: 0,
    turns: state.turnNumber,
    victoryType: state.gameOverReason ?? 'none',
  }

  for (const entry of state.log) {
    const data = entry.data ?? {}
    if (data['event'] === 'card_played') {
      metrics.cardsPlayed++
      if (data['cardType'] === 'entity') metrics.entitiesPlayed++
      if (data['cardType'] === 'fortress') metrics.fortressesBuilt++
    }
    if (data['event'] === 'item_equipped') {
      metrics.cardsPlayed++
      metrics.itemsEquipped++
    }
    if (data['event'] === 'consumable_used') {
      metrics.cardsPlayed++
      metrics.consumablesUsed++
    }
    if (data['event'] === 'card_discarded') metrics.cardsDiscarded++
    if (data['event'] === 'cards_drawn') metrics.cardsDrawn += Number(data['count'] ?? 0)
    if (data['event'] === 'entity_moved') metrics.entityMoves++
    if (data['event'] === 'attack') {
      metrics.attacks++
      if (data['hit']) metrics.hits++
      else metrics.misses++
      if (data['defeated'] && data['targetType'] === 'entity') metrics.entitiesDefeated++
      if (data['destroyed'] && data['targetType'] === 'fortress') metrics.fortressesDestroyed++
      if (data['captured']) metrics.fortressesCaptured++
      if (data['fortressAssault']) metrics.fortressAssaults++
      if (data['targetFortressState'] === 'empty') metrics.attacksOnEmptyFortresses++
      if (data['targetFortressState'] === 'occupied') metrics.attacksOnOccupiedFortresses++
      if (data['targetFortressState'] === 'defender') metrics.attacksOnFortressDefenders++
      if (data['captureOpportunity']) metrics.captureOpportunities++
      if (data['capturedByClearingDefenders']) metrics.capturesAfterClearingDefenders++
    }
  }

  return metrics
}

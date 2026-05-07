import { describe, it, expect } from 'vitest'
import { generateLegalDeck } from '../../packages/engine/src/rules/deckGeneration.js'
import { SeededRng } from '../../packages/engine/src/rng/rng.js'
import { loadCards } from '@gk/cards'
import { DECK_SIZES } from '@gk/shared'

describe('generateLegalDeck', () => {
  it('creates a 36-card medium deck', () => {
    const rng = new SeededRng('deck-test-1')
    const cards = loadCards()
    const deck = generateLegalDeck(cards, 'medium', rng)
    expect(deck.length).toBe(36)
  })

  it('respects minimum entities', () => {
    const rng = new SeededRng('deck-test-2')
    const cards = loadCards()
    const deck = generateLegalDeck(cards, 'medium', rng)
    const entityCount = deck.filter(id => cards[id]?.type === 'entity').length
    expect(entityCount).toBeGreaterThanOrEqual(DECK_SIZES.medium.minEntities)
  })

  it('respects minimum fortresses', () => {
    const rng = new SeededRng('deck-test-3')
    const cards = loadCards()
    const deck = generateLegalDeck(cards, 'medium', rng)
    const fortressCount = deck.filter(id => cards[id]?.type === 'fortress').length
    expect(fortressCount).toBeGreaterThanOrEqual(DECK_SIZES.medium.minFortresses)
  })

  it('respects minimum items', () => {
    const rng = new SeededRng('deck-test-4')
    const cards = loadCards()
    const deck = generateLegalDeck(cards, 'medium', rng)
    const itemCount = deck.filter(id => {
      const t = cards[id]?.type
      return t === 'item_regular' || t === 'item_consumable'
    }).length
    expect(itemCount).toBeGreaterThanOrEqual(DECK_SIZES.medium.minItems)
  })

  it('does not include invalid cards', () => {
    const rng = new SeededRng('deck-test-5')
    const cards = loadCards()
    const deck = generateLegalDeck(cards, 'medium', rng)
    for (const id of deck) {
      expect(cards[id]?.validationStatus).not.toBe('invalid')
    }
  })

  it('does not exceed MAX_COPIES_PER_NAME per card name', () => {
    const rng = new SeededRng('deck-test-6')
    const cards = loadCards()
    const deck = generateLegalDeck(cards, 'medium', rng)
    const nameCounts = new Map<string, number>()
    for (const id of deck) {
      const name = cards[id]?.name ?? ''
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
    }
    for (const [, count] of nameCounts) {
      expect(count).toBeLessThanOrEqual(3)
    }
  })

  it('same seed produces same deck', () => {
    const cards = loadCards()
    const deck1 = generateLegalDeck(cards, 'medium', new SeededRng('same-seed'))
    const deck2 = generateLegalDeck(cards, 'medium', new SeededRng('same-seed'))
    expect(deck1).toEqual(deck2)
  })
})

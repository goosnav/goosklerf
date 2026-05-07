import type { CardDatabase } from '@gk/cards'
import type { SeededRng } from '../rng/rng.js'
import { DECK_SIZES, MAX_COPIES_PER_NAME, type DeckSize } from '@gk/shared'

export interface DeckGenerationOptions {
  allowUnimplementedSpecials?: boolean
}

function getPlayable(cards: CardDatabase, opts: DeckGenerationOptions = {}) {
  return Object.values(cards).filter(c => {
    if (c.validationStatus === 'invalid') return false
    if (opts.allowUnimplementedSpecials !== false) return true
    if (c.automationStatus !== 'not_implemented') return true
    // Fortress cards all currently carry unique special text. MVP play still
    // supports their HP and numeric buffs, but reports unique effects as pending.
    return c.type === 'fortress'
  })
}

export function generateLegalDeck(
  cards: CardDatabase,
  size: DeckSize,
  rng: SeededRng,
  opts: DeckGenerationOptions = {},
): string[] {
  const spec = DECK_SIZES[size]
  const pool = getPlayable(cards, opts)

  const entities   = pool.filter(c => c.type === 'entity')
  const fortresses = pool.filter(c => c.type === 'fortress')
  const items      = pool.filter(c =>
    c.type === 'item_regular' || c.type === 'item_consumable'
  )

  const deck: string[] = []
  const nameCounts = new Map<string, number>()

  function canAdd(id: string): boolean {
    const card = cards[id]
    if (!card) return false
    return (nameCounts.get(card.name) ?? 0) < MAX_COPIES_PER_NAME
  }

  function addCard(id: string): void {
    const card = cards[id]!
    deck.push(id)
    nameCounts.set(card.name, (nameCounts.get(card.name) ?? 0) + 1)
  }

  function pickN(cardPool: typeof entities, n: number, label: string): void {
    const shuffled = rng.shuffle(cardPool.map(c => c.id))
    let added = 0
    for (const id of shuffled) {
      if (added >= n) break
      if (canAdd(id)) { addCard(id); added++ }
    }
    if (added < n) {
      throw new Error(`Not enough valid ${label} to meet minimum (${added}/${n})`)
    }
  }

  pickN(entities, spec.minEntities, 'entities')
  pickN(fortresses, spec.minFortresses, 'fortresses')
  pickN(items, spec.minItems, 'items')

  const remaining = spec.total - deck.length
  const allPool = rng.shuffle([...entities, ...fortresses, ...items].map(c => c.id))
  let filled = 0
  for (const id of allPool) {
    if (filled >= remaining) break
    if (canAdd(id)) { addCard(id); filled++ }
  }

  return deck
}

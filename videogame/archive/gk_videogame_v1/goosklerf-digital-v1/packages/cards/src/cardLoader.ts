import type { CardDatabase, CardDefinition } from './cardTypes.js'

// Static import — works in both Vite (browser bundle) and Node.js (tsx/vitest)
import cardsDataRaw from '../data/generated/cards.generated.json' with { type: 'json' }

const _db: CardDatabase = cardsDataRaw as CardDatabase

export function loadCards(): CardDatabase {
  return _db
}

export function getCard(id: string): CardDefinition | undefined {
  return _db[id]
}

export function getAllCards(): CardDefinition[] {
  return Object.values(_db)
}

export function getPlayableCards(): CardDefinition[] {
  return getAllCards().filter(c => c.validationStatus !== 'invalid')
}

export function getPlayableCardsForDeckGen(): CardDefinition[] {
  return getAllCards().filter(
    c => c.validationStatus === 'valid' && c.automationStatus !== 'data_error'
  )
}

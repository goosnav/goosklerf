import type { CardDefinition, ValidationStatus } from './cardTypes.js'

export interface ValidationResult {
  status: ValidationStatus
  errors: string[]
}

export function validateCard(card: Partial<CardDefinition>): ValidationResult {
  const errors: string[] = []

  if (!card.name || card.name.trim() === '') {
    errors.push('Missing card name')
  }

  const validTypes = ['entity', 'fortress', 'item_regular', 'item_consumable']
  if (!card.type || !validTypes.includes(card.type)) {
    errors.push(`Invalid card type: ${card.type}`)
  }

  if (card.type === 'entity') {
    if (card.baseAttack === undefined || card.baseAttack === null) {
      errors.push('Entity missing baseAttack')
    }
    if (card.baseHp === undefined || card.baseHp === null) {
      errors.push('Entity missing baseHp')
    }
  }

  if (card.type === 'fortress') {
    if (card.fortressHp === undefined || card.fortressHp === null) {
      errors.push('Fortress missing fortressHp')
    }
  }

  if (!card.id || card.id.trim() === '') {
    errors.push('Missing card id')
  }

  const status: ValidationStatus =
    errors.length === 0 ? 'valid' :
    errors.some(e => /missing|invalid/i.test(e)) ? 'invalid' :
    'warning'

  return { status, errors }
}

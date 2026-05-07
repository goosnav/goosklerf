import { validateCard } from '@gk/cards'
import type { CardDefinition } from '@gk/cards'

export function validateAndFinalize(partial: Partial<CardDefinition>): CardDefinition {
  const { status, errors } = validateCard(partial)
  return {
    id: partial.id ?? '',
    name: partial.name ?? '',
    filename: partial.filename ?? '',
    imagePath: partial.imagePath ?? '',
    type: partial.type ?? 'entity',
    rarity: partial.rarity ?? 'unknown',
    baseAttack: partial.baseAttack,
    baseHp: partial.baseHp,
    fortressHp: partial.fortressHp,
    attackBuff: partial.attackBuff,
    hpBuff: partial.hpBuff,
    miscStat: partial.miscStat,
    rulesText: partial.rulesText ?? '',
    notes: partial.notes,
    hasSpecial: partial.hasSpecial ?? false,
    effectIds: partial.effectIds ?? [],
    tags: partial.tags ?? [],
    validationStatus: status,
    validationErrors: errors,
    automationStatus: partial.automationStatus ?? 'not_implemented',
  }
}

export function deduplicateIds(cards: CardDefinition[]): CardDefinition[] {
  const seen = new Map<string, number>()
  return cards.map(card => {
    const count = seen.get(card.id) ?? 0
    seen.set(card.id, count + 1)
    if (count > 0) {
      return { ...card, id: `${card.id}_${count}` }
    }
    return card
  })
}

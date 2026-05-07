import { describe, it, expect } from 'vitest'
import { validateCard } from '@gk/cards'

describe('validateCard', () => {
  it('marks entity with attack and hp as valid', () => {
    const result = validateCard({
      id: 'card_test', name: 'Test Entity', type: 'entity',
      baseAttack: 3, baseHp: 2, filename: 'test.jpg', imagePath: 'cards/test.jpg',
      rulesText: '',
    })
    expect(result.status).toBe('valid')
    expect(result.errors).toHaveLength(0)
  })

  it('marks entity missing attack as invalid', () => {
    const result = validateCard({
      id: 'card_test', name: 'Test Entity', type: 'entity',
      baseHp: 2, filename: 'test.jpg', imagePath: 'cards/test.jpg', rulesText: '',
    })
    expect(result.status).toBe('invalid')
    expect(result.errors.some(e => e.includes('baseAttack'))).toBe(true)
  })

  it('marks entity missing hp as invalid', () => {
    const result = validateCard({
      id: 'card_test', name: 'Test Entity', type: 'entity',
      baseAttack: 2, filename: 'test.jpg', imagePath: 'cards/test.jpg', rulesText: '',
    })
    expect(result.status).toBe('invalid')
    expect(result.errors.some(e => e.includes('baseHp'))).toBe(true)
  })

  it('marks fortress missing fortressHp as invalid', () => {
    const result = validateCard({
      id: 'card_fort', name: 'Test Fort', type: 'fortress',
      filename: 'fort.jpg', imagePath: 'cards/fort.jpg', rulesText: '',
    })
    expect(result.status).toBe('invalid')
    expect(result.errors.some(e => e.includes('fortressHp'))).toBe(true)
  })

  it('marks valid fortress as valid', () => {
    const result = validateCard({
      id: 'card_fort', name: 'Test Fort', type: 'fortress',
      fortressHp: 12, filename: 'fort.jpg', imagePath: 'cards/fort.jpg', rulesText: '',
    })
    expect(result.status).toBe('valid')
  })

  it('marks card with no name as invalid', () => {
    const result = validateCard({
      id: 'card_test', name: '', type: 'entity',
      baseAttack: 2, baseHp: 3, filename: 'x.jpg', imagePath: 'cards/x.jpg', rulesText: '',
    })
    expect(result.status).toBe('invalid')
  })

  it('marks valid consumable item as valid', () => {
    const result = validateCard({
      id: 'card_item', name: 'Sword', type: 'item_consumable',
      filename: 'sword.jpg', imagePath: 'cards/sword.jpg', rulesText: 'does stuff',
    })
    expect(result.status).toBe('valid')
  })
})

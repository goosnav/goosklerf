import { describe, it, expect } from 'vitest'
import { parseCsv, normalizeCsvRow } from '../../apps/card-tools/src/importCsv.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = path.join(__dirname, '../../../card_data-003.csv')

describe('parseCsv', () => {
  it('parses all 128 rows from card_data-003.csv', () => {
    const rows = parseCsv(CSV_PATH)
    expect(rows.length).toBe(128)
  })

  it('all rows have card_name', () => {
    const rows = parseCsv(CSV_PATH)
    for (const row of rows) {
      expect(row.card_name?.trim().length).toBeGreaterThan(0)
    }
  })

  it('generates unique IDs from card names (after dedup)', async () => {
    const { deduplicateIds } = await import('../../apps/card-tools/src/validateCards.js')
    const { validateAndFinalize } = await import('../../apps/card-tools/src/validateCards.js')
    const rows = parseCsv(CSV_PATH)
    const partials = rows.map((r, i) => normalizeCsvRow(r, i))
    const finalized = partials.map(validateAndFinalize)
    const deduped = deduplicateIds(finalized)
    const ids = deduped.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(128)
  })
})

describe('normalizeCsvRow', () => {
  it('marks cards with has_special=Y as not_implemented', () => {
    const rows = parseCsv(CSV_PATH)
    const specialRows = rows.filter(r => r.has_special?.trim() === 'Y')
    expect(specialRows.length).toBeGreaterThan(0)
    for (const row of specialRows) {
      const result = normalizeCsvRow(row, 0)
      expect(result.hasSpecial).toBe(true)
      expect(result.automationStatus).toBe('not_implemented')
    }
  })

  it('correctly identifies 65 special cards', () => {
    const rows = parseCsv(CSV_PATH)
    const specials = rows.filter(r => {
      const hs = r.has_special?.toLowerCase().trim() ?? ''
      return hs === 'y' || hs === 'yes' || hs === 'true' || hs === '1'
    })
    expect(specials.length).toBe(65)
  })

  it('normalizes entity numeric fields', () => {
    const fakeRow = {
      filename: 'ent.jpg', card_name: 'My Entity', card_type: 'entity',
      hp: '4', fortress_hp: '', attack: '3', attack_buff: '', hp_buff: '',
      misc_stat: '', description: '', has_special: 'N', notes: ''
    }
    const result = normalizeCsvRow(fakeRow, 0)
    expect(result.baseHp).toBe(4)
    expect(result.baseAttack).toBe(3)
    expect(result.type).toBe('entity')
  })

  it('normalizes fortress fields', () => {
    const fakeRow = {
      filename: 'fort.jpg', card_name: 'My Fort', card_type: 'fortress',
      hp: '', fortress_hp: '12', attack: '', attack_buff: '', hp_buff: '',
      misc_stat: '', description: '', has_special: 'N', notes: ''
    }
    const result = normalizeCsvRow(fakeRow, 0)
    expect(result.fortressHp).toBe(12)
    expect(result.type).toBe('fortress')
  })
})

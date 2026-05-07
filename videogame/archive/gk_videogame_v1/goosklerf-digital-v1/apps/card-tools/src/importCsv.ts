import { readFileSync } from 'fs'
import { generateCardId } from '@gk/shared'
import type { CardDefinition, CardType, Rarity } from '@gk/cards'

export interface RawCsvRow {
  filename: string
  card_name: string
  card_type: string
  hp: string
  fortress_hp: string
  attack: string
  attack_buff: string
  hp_buff: string
  misc_stat: string
  description: string
  has_special: string
  notes: string
}

export function parseCsv(filePath: string): RawCsvRow[] {
  const text = readFileSync(filePath, 'utf-8')
  const lines = text.split('\n').filter(l => l.trim())
  const [headerLine, ...dataLines] = lines
  const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  return dataLines.map(line => {
    const fields: string[] = []
    let inQuote = false
    let current = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { fields.push(current.trim()); current = '' }
      else { current += ch }
    }
    fields.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (fields[i] ?? '').replace(/^"|"$/g, '') })
    return row as unknown as RawCsvRow
  })
}

function parseNum(s: string): number | undefined {
  if (!s || s.trim() === '') return undefined
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

function inferRarity(filename: string): Rarity {
  const lower = filename.toLowerCase()
  if (lower.includes('rare') || lower.includes('_r_')) return 'rare'
  return 'normal'
}

function normalizeCardType(raw: string): CardType | null {
  const map: Record<string, CardType> = {
    'entity': 'entity',
    'fortress': 'fortress',
    'item_regular': 'item_regular',
    'item_consumable': 'item_consumable',
    'item regular': 'item_regular',
    'item consumable': 'item_consumable',
  }
  return map[raw.toLowerCase().trim()] ?? null
}

export function normalizeCsvRow(row: RawCsvRow, index: number): Partial<CardDefinition> {
  const type = normalizeCardType(row.card_type) ?? undefined
  const hs = row.has_special?.toLowerCase().trim() ?? ''
  const hasSpecial = hs === 'true' || hs === 'yes' || hs === 'y' || hs === '1'

  const baseId = generateCardId(row.card_name || `unknown_${index}`)

  return {
    id: baseId,
    name: row.card_name?.trim() ?? '',
    filename: row.filename?.trim() ?? '',
    imagePath: `cards/${row.filename?.trim() ?? ''}`,
    type: type as CardType,
    rarity: inferRarity(row.filename ?? ''),
    baseAttack: parseNum(row.attack),
    baseHp: parseNum(row.hp),
    fortressHp: parseNum(row.fortress_hp),
    attackBuff: parseNum(row.attack_buff),
    hpBuff: parseNum(row.hp_buff),
    miscStat: row.misc_stat?.trim() || undefined,
    rulesText: row.description?.trim() ?? '',
    notes: row.notes?.trim() || undefined,
    hasSpecial,
    effectIds: [],
    tags: [],
    automationStatus: hasSpecial ? 'not_implemented' : 'fully_implemented',
  }
}

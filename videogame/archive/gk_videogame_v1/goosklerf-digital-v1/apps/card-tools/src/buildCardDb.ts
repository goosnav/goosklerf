import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { parseCsv, normalizeCsvRow } from './importCsv.js'
import { validateAndFinalize, deduplicateIds } from './validateCards.js'
import type { CardDatabase } from '@gk/cards'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_PATH = join(__dirname, '../../../../card_data-003.csv')
const OUT_DIR  = join(__dirname, '../../../packages/cards/data/generated')
const OUT_PATH = join(OUT_DIR, 'cards.generated.json')

function main() {
  console.log(`Reading CSV from: ${CSV_PATH}`)
  const rows = parseCsv(CSV_PATH)
  console.log(`Parsed ${rows.length} rows`)

  const partials  = rows.map((r, i) => normalizeCsvRow(r, i))
  const finalized = partials.map(validateAndFinalize)
  const deduped   = deduplicateIds(finalized)

  const db: CardDatabase = {}
  deduped.forEach(card => { db[card.id] = card })

  const validCount   = deduped.filter(c => c.validationStatus === 'valid').length
  const warnCount    = deduped.filter(c => c.validationStatus === 'warning').length
  const invalidCount = deduped.filter(c => c.validationStatus === 'invalid').length
  const specialCount = deduped.filter(c => c.hasSpecial).length

  console.log('\nValidation summary:')
  console.log(`  valid:   ${validCount}`)
  console.log(`  warning: ${warnCount}`)
  console.log(`  invalid: ${invalidCount}`)
  console.log(`  special: ${specialCount} (marked not_implemented)`)

  if (invalidCount > 0) {
    console.log('\nInvalid cards:')
    deduped
      .filter(c => c.validationStatus === 'invalid')
      .forEach(c => console.log(`  ${c.id}: ${c.validationErrors.join(', ')}`))
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(db, null, 2))
  console.log(`\nWrote ${deduped.length} cards to ${OUT_PATH}`)
}

main()

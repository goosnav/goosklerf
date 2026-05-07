import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { getAllCards } from '@gk/cards'

describe('card image assets', () => {
  it('has a local public image for every generated card', () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const assetRoot = path.resolve(__dirname, '../../apps/desktop/public')
    const missing = getAllCards()
      .filter(card => !existsSync(path.join(assetRoot, card.imagePath)))
      .map(card => `${card.name}: ${card.imagePath}`)

    expect(missing).toEqual([])
  })
})

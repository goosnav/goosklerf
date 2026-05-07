export type CardType = 'entity' | 'fortress' | 'item_regular' | 'item_consumable'
export type Rarity = 'normal' | 'rare' | 'unknown'
export type ValidationStatus = 'valid' | 'warning' | 'invalid'
export type AutomationStatus =
  | 'fully_implemented'
  | 'partially_implemented'
  | 'not_implemented'
  | 'data_error'

export interface CardDefinition {
  id: string
  name: string
  filename: string
  imagePath: string
  type: CardType
  rarity: Rarity
  baseAttack?: number
  baseHp?: number
  fortressHp?: number
  attackBuff?: number
  hpBuff?: number
  miscStat?: string
  rulesText: string
  notes?: string
  hasSpecial: boolean
  effectIds: string[]
  tags: string[]
  validationStatus: ValidationStatus
  validationErrors: string[]
  automationStatus: AutomationStatus
}

export type CardDatabase = Record<string, CardDefinition>

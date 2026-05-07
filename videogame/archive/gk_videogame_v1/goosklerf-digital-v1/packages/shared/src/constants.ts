export const DECK_SIZES = {
  small:  { total: 24, minEntities: 5,  minFortresses: 1, minItems: 10 },
  medium: { total: 36, minEntities: 10, minFortresses: 2, minItems: 15 },
  large:  { total: 54, minEntities: 15, minFortresses: 3, minItems: 25 },
} as const

export type DeckSize = keyof typeof DECK_SIZES

export const STARTING_HAND_SIZE = 7
export const STARTING_SHOP_SIZE = 7
export const MAX_COPIES_PER_NAME = 3
export const MAX_ENTITIES_PER_PLAYER_ON_BATTLEFIELD = 5
export const MAX_ENTITIES_PER_FORTRESS = 3
export const MAX_FORTRESSES_PER_PLAYER = 3
export const MAX_ITEMS_PER_ENTITY = 3
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

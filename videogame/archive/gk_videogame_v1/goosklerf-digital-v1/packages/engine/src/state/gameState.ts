import type { RngState } from '../rng/rng.js'
import type { ZoneState, ZoneRef } from './zones.js'
import type { GameLogEntry } from '../logging/gameLog.js'

export type PlayerId = string
export type InstanceId = string
export type DefinitionId = string

export type GamePhase =
  | 'card_play'
  | 'combat'
  | 'movement'
  | 'card_draw'
  | 'victory_check'
  | 'game_over'

export type PlayerType = 'human' | 'ai'

export interface PlayerState {
  playerId: PlayerId
  name: string
  type: PlayerType
  aiPersonalityId?: string
  eliminated: boolean
  seatIndex: number
}

export interface Modifier {
  id: string
  source: string
  attackDelta?: number
  hpDelta?: number
  description: string
  expiresAfterPhase?: GamePhase
}

export interface CardInstance {
  instanceId: InstanceId
  definitionId: DefinitionId
  ownerPlayerId: PlayerId
  controllerPlayerId: PlayerId
  zone: ZoneRef
  currentHp?: number
  maxHp?: number
  currentFortressHp?: number
  maxFortressHp?: number
  equippedItemIds: InstanceId[]
  containedEntityIds: InstanceId[]
  exhaustedThisEngagement: boolean
  participatedThisTurn: boolean
  temporaryModifiers: Modifier[]
  persistentModifiers: Modifier[]
}

export interface EngagementState {
  engagementId: string
  attackerIds: InstanceId[]
  defenderIds: InstanceId[]
  targetFortressId?: InstanceId
  roundNumber: number
  attackerPlayerId: PlayerId
  defenderPlayerId: PlayerId
}

export interface PendingChoice {
  type: 'select_target' | 'select_cards' | 'confirm'
  playerId: PlayerId
  prompt: string
  options: string[]
  minSelections: number
  maxSelections: number
}

export interface Zones {
  battlefield: ZoneState
  shops: Record<PlayerId, ZoneState>
  hands: Record<PlayerId, ZoneState>
  decks: Record<PlayerId, ZoneState>
  graveyards: Record<PlayerId, ZoneState>
  suburbs: Record<PlayerId, ZoneState>
}

export interface GameState {
  gameId: string
  ruleset: 'classic_advanced_v1'
  rngSeed: string
  rngState: RngState
  players: PlayerState[]
  activePlayerId: PlayerId
  turnNumber: number
  roundNumber: number
  phase: GamePhase
  pendingEngagement?: EngagementState
  pendingChoice?: PendingChoice
  zones: Zones
  cardsByInstanceId: Record<InstanceId, CardInstance>
  landlordStatus?: {
    claimantPlayerId: PlayerId
    turnsRemaining: number
  }
  oldAgeCounters: Record<PlayerId, number>
  cardPlaysThisTurn: Record<PlayerId, number>
  log: GameLogEntry[]
  winner?: PlayerId
  gameOverReason?: string
}

import type { InstanceId, PlayerId } from '../state/gameState.js'

interface BaseAction {
  playerId: PlayerId
}

export interface PlayCardAction extends BaseAction {
  type: 'PLAY_CARD'
  instanceId: InstanceId
  targetZone?: string
  targetInstanceId?: InstanceId
}
export interface DiscardCardAction extends BaseAction {
  type: 'DISCARD_CARD'
  instanceId: InstanceId
}
export interface EquipItemAction extends BaseAction {
  type: 'EQUIP_ITEM'
  itemInstanceId: InstanceId
  targetEntityInstanceId: InstanceId
}
export interface DeclareEngagementAction extends BaseAction {
  type: 'DECLARE_ENGAGEMENT'
  attackerIds: InstanceId[]
  defenderPlayerId: PlayerId
  targetFortressId?: InstanceId
}
export interface NormalAttackAction extends BaseAction {
  type: 'NORMAL_ATTACK'
  attackerInstanceId: InstanceId
  targetInstanceId: InstanceId
  diceRoll?: number
}
export interface MoveEntityAction extends BaseAction {
  type: 'MOVE_ENTITY'
  entityInstanceId: InstanceId
  targetFortressId?: InstanceId
  destination: 'battlefield' | 'fortress'
}
export interface EndPhaseAction extends BaseAction {
  type: 'END_PHASE'
}
export interface DrawCardsAction extends BaseAction {
  type: 'DRAW_CARDS'
  count: number
}
export interface ResolvePendingChoiceAction extends BaseAction {
  type: 'RESOLVE_PENDING_CHOICE'
  selectedOptions: string[]
}

export type GameAction =
  | PlayCardAction
  | DiscardCardAction
  | EquipItemAction
  | DeclareEngagementAction
  | NormalAttackAction
  | MoveEntityAction
  | EndPhaseAction
  | DrawCardsAction
  | ResolvePendingChoiceAction

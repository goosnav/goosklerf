export type GameRuleErrorCode =
  | 'ILLEGAL_ACTION'
  | 'INVALID_TARGET'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'CAPACITY_EXCEEDED'
  | 'INVALID_CARD'
  | 'DECK_INVALID'
  | 'GAME_OVER'

export class GameRuleError extends Error {
  constructor(
    public readonly code: GameRuleErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'GameRuleError'
  }
}

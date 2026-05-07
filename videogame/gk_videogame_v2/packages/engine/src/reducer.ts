/**
 * Top-level pure reducer.
 *
 * All game actions enter here and return a fresh GameState on success. Illegal
 * player choices return Result errors with the violated R-ID.
 */

import type { CardDatabase } from "@gk/cards";
import type { Action } from "./actions.js";
import type { GameState } from "./state.js";
import { type Result } from "./result.js";
import { handleDiscardCard, handlePlayCard } from "./rules/cardPlay.js";
import {
  handleDeclareEngagement,
  handleNormalAttack,
  handlePassAction,
  handleResolveFortressAssault,
} from "./rules/combat.js";
import { handleMoveEntity } from "./rules/movement.js";
import { handleEndPhase } from "./rules/phase.js";

export interface ReducerContext {
  cardDatabase: CardDatabase;
}

export function reduce(
  state: GameState,
  action: Action,
  ctx: ReducerContext,
): Result<GameState> {
  switch (action.kind) {
    // ---- Card Play (R5.x) ----
    case "PLAY_CARD":
      return handlePlayCard(state, action, ctx.cardDatabase);
    case "DISCARD_CARD":
      return handleDiscardCard(state, action, ctx.cardDatabase);
    // ---- Phase rotation (R4.1) ----
    case "END_PHASE":
      return handleEndPhase(state, action, ctx.cardDatabase);
    // ---- Combat (R6.x) ----
    case "DECLARE_ENGAGEMENT":
      return handleDeclareEngagement(state, action, ctx.cardDatabase);
    case "NORMAL_ATTACK":
      return handleNormalAttack(state, action, ctx.cardDatabase);
    case "PASS_ACTION":
      return handlePassAction(state, action, ctx.cardDatabase);
    case "RESOLVE_FORTRESS_ASSAULT":
      return handleResolveFortressAssault(state, action, ctx.cardDatabase);
    // ---- Movement (R8.x) ----
    case "MOVE_ENTITY":
      return handleMoveEntity(state, action, ctx.cardDatabase);
  }
}

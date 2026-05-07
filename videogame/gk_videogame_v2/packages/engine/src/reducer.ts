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
    case "PLAY_CARD":
      return handlePlayCard(state, action, ctx.cardDatabase);
    case "DISCARD_CARD":
      return handleDiscardCard(state, action, ctx.cardDatabase);
    case "END_PHASE":
      // Delegates to per-phase rules; see rules/phase.ts.
      return handleEndPhase(state, action, ctx.cardDatabase);
  }
}

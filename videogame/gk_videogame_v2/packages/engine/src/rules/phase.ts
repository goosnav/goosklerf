/**
 * Phase rotation reducer.
 *
 * Top-level handler for the END_PHASE action. Delegates to the per-phase
 * handler when one exists; otherwise treats the phase as a stub no-op that
 * simply advances to the next phase.
 *
 * When victory_check ends, control rotates to the next player in turn order
 * and the turn number increments. Per R10.7 we ALSO reset Old Age and
 * declared-engagement bookkeeping here, even though the rule isn't fully
 * enforced until later sprints — the structural reset is harmless and lets
 * future sprints layer logic in without re-touching this file.
 *
 * Stub phases (combat / movement / card_draw / victory_check) are deliberately
 * minimal until their owning sprint:
 *   combat       Sprint 6+
 *   movement     Sprint 8
 *   card_draw    Sprint 9
 *   victory_check Sprint 10  (Old Age + LMS / Landlord / Hamlet checks)
 *
 * Each stub still emits a log entry so the user can see the phase advance.
 */

import type { CardDatabase } from "@gk/cards";
import type { Action } from "../actions.js";
import { cloneState, playerById } from "../helpers.js";
import { appendLog } from "../log.js";
import { type Result, err, ok } from "../result.js";
import type { GameState, Phase, Player } from "../state.js";
import { handleEndCardPlay } from "./cardPlay.js";

type EndPhaseAction = Extract<Action, { kind: "END_PHASE" }>;

/** Order of phases per R4.1. After victory_check we wrap to the next player. */
const PHASE_ORDER: readonly Phase[] = [
  "card_play",
  "combat",
  "movement",
  "card_draw",
  "victory_check",
];

export function handleEndPhase(
  state: GameState,
  action: EndPhaseAction,
  cardDb: CardDatabase,
): Result<GameState> {
  switch (state.phase) {
    case "card_play":
      // Card Play has rich rules (R5.1 quota); delegate to its dedicated handler.
      return handleEndCardPlay(state, action, cardDb);
    case "combat":
      return endStubPhase(state, "combat", "movement", "R6.x — Combat phase ended (no engagement declared).");
    case "movement":
      return endStubPhase(state, "movement", "card_draw", "R8.x — Movement phase ended.");
    case "card_draw":
      return endStubPhase(state, "card_draw", "victory_check", "R9.x — Card Draw phase ended.");
    case "victory_check":
      return endVictoryCheck(state);
  }
}

/**
 * Generic no-op phase end: log it, advance to the next phase. Used for any
 * phase whose real logic hasn't landed yet.
 */
function endStubPhase(
  state: GameState,
  fromPhase: Phase,
  toPhase: Phase,
  message: string,
): Result<GameState> {
  if (state.phase !== fromPhase) {
    return err(`R4.1: end-phase requested for ${fromPhase} but state is in ${state.phase}.`);
  }
  const next = cloneState(state);
  const active = playerById(next, next.activePlayerId);
  appendLog(next, {
    rule: "R4.1",
    actor: active.id,
    message: `${active.name}: ${message}`,
    data: { fromPhase, toPhase, stub: true },
  });
  next.phase = toPhase;
  return ok(next);
}

/**
 * End the Victory Check phase: rotate to the next player.
 *
 * Per R10.x, Victory Check is where Old Age advances and victory triggers fire.
 * Sprint 10 will add those. For now we just rotate cleanly — the structural
 * scaffolding lets later sprints insert the missing logic in this one place.
 */
function endVictoryCheck(state: GameState): Result<GameState> {
  if (state.phase !== "victory_check") {
    return err(`R4.1: end-phase requested for victory_check but state is in ${state.phase}.`);
  }
  if (state.outcome !== null) {
    return err("R10.x: cannot rotate past victory_check after the game has ended.");
  }

  const next = cloneState(state);

  // Rotate active player to the next one in turn order (wrap on last).
  const ids = next.players.map((p) => p.id);
  const currentIdx = ids.indexOf(next.activePlayerId);
  if (currentIdx === -1) throw new Error(`endVictoryCheck: active player "${next.activePlayerId}" not in players`);
  const nextIdx = (currentIdx + 1) % ids.length;
  const nextPlayer: Player = next.players[nextIdx]!;

  next.activePlayerId = nextPlayer.id;
  next.phase = "card_play";
  next.turnNumber += 1;

  // Reset per-turn bookkeeping for the incoming player.
  // R10.7 (Old Age): the *outgoing* player's counter logic lives in the
  // victory_check handler proper (Sprint 10). We just reset the flag here.
  nextPlayer.declaredEngagementThisTurn = false;

  // Reset Card Play quota for the incoming player.
  next.cardPlay = {
    startedWith: nextPlayer.hand.length,
    played: 0,
    discarded: 0,
  };

  appendLog(next, {
    rule: "R4.1",
    actor: "system",
    message: `Turn ${next.turnNumber}: ${nextPlayer.name}'s Card Play phase begins.`,
    data: { fromPhase: "victory_check", toPhase: "card_play", newActivePlayerId: nextPlayer.id, turnNumber: next.turnNumber },
  });
  return ok(next);
}

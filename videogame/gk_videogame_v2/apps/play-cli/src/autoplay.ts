/**
 * Stub autoplay for AI turns and unimplemented phases.
 *
 * Lives in the app layer (not the engine) to keep the engine pure of
 * "controller" logic. This file's responsibilities:
 *
 *   1. AI Card Play: when an AI player is active and we're in card_play,
 *      walk them through legal plays and end their phase. Sprint 11 will
 *      replace the deterministic-first-legal logic here with personality-
 *      weighted selection.
 *
 *   2. Stub phase advance: combat, movement, card_draw, victory_check have
 *      no real action handlers yet. From the player's perspective there's
 *      nothing to do in those phases, so we auto-dispatch END_PHASE through
 *      them. As each sprint lands its phase, we'll narrow this auto-advance
 *      in one place.
 *
 *   3. Loop: keep applying steps 1+2 until either (a) we're back in
 *      card_play with a human active (waiting for input), or (b) the game
 *      has ended (outcome set), or (c) we hit the safety cap.
 *
 * Returns the new state after autoplay settles. Errors short-circuit and
 * propagate so the caller can surface them.
 */

import type { CardDatabase, CardDefinition } from "@gk/cards";
import {
  type Action,
  type GameState,
  type InstanceId,
  type PlacementRef,
  cardById,
  findCard,
  reduce,
} from "@gk/engine";

export interface AutoplayContext {
  cardDb: CardDatabase;
}

export interface AutoplayResult {
  state: GameState;
  /** Human-readable transcript of every action autoplay dispatched. */
  events: string[];
  /** If autoplay had to stop because of an engine error, it goes here. */
  error: string | null;
}

/**
 * Safety cap: each invocation can dispatch at most this many actions before
 * we abort. Prevents an infinite loop from a logic bug taking the CLI down.
 * Real games shouldn't need anywhere near this many auto-actions per yield.
 */
const AUTOPLAY_STEP_CAP = 200;

export function runAutoplay(state: GameState, ctx: AutoplayContext): AutoplayResult {
  const events: string[] = [];
  let s = state;
  for (let step = 0; step < AUTOPLAY_STEP_CAP; step++) {
    if (s.outcome !== null) break;

    const active = s.players.find((p) => p.id === s.activePlayerId);
    if (!active) return { state: s, events, error: `no active player "${s.activePlayerId}"` };

    // Ready to hand back to a human?
    if (s.phase === "card_play" && active.kind === "human") break;

    // Card Play for an AI: pick a legal action and dispatch.
    if (s.phase === "card_play" && active.kind === "ai") {
      const action = chooseAiCardPlayAction(s, ctx.cardDb);
      const r = reduce(s, action, { cardDatabase: ctx.cardDb });
      if (!r.ok) {
        return { state: s, events, error: `AI dispatch failed: ${r.error}` };
      }
      events.push(`${active.name}: ${describeAction(action, s, ctx.cardDb)}`);
      s = r.value;
      continue;
    }

    // Any non-card-play phase: stub-end it.
    const r = reduce(s, { kind: "END_PHASE" }, { cardDatabase: ctx.cardDb });
    if (!r.ok) {
      return { state: s, events, error: `END_PHASE in ${s.phase} failed: ${r.error}` };
    }
    s = r.value;
  }
  return { state: s, events, error: null };
}

// -----------------------------------------------------------------------------
// AI Card Play decision (deterministic fallback for Sprint 5.5)
// -----------------------------------------------------------------------------

/**
 * Pick the next AI Card Play action.
 *
 * Strategy (deliberately simple; Sprint 11 replaces this):
 *   - If the quota is met → END_PHASE.
 *   - Else, walk the hand top-to-bottom and find the first card with at least
 *     one legal placement. Play it, preferring battlefield → fortress → equip
 *     in that order.
 *   - If no card has any legal placement, discard the top of hand.
 *
 * Determinism: given (state), this function returns the same action every
 * time. That's all we need at Sprint 5.5 — the simulator (M4) wants the AI
 * to be a pure function of state too.
 */
export function chooseAiCardPlayAction(
  state: GameState,
  cardDb: CardDatabase,
): Action {
  const active = state.players.find((p) => p.id === state.activePlayerId);
  if (!active) throw new Error(`chooseAiCardPlayAction: no active player`);

  const quotaMet =
    state.cardPlay.played + state.cardPlay.discarded >=
    Math.min(3, state.cardPlay.startedWith);
  if (quotaMet) return { kind: "END_PHASE" };

  // Find first hand card with a legal placement.
  for (const id of active.hand) {
    const inst = findCard(state, id);
    if (!inst) continue;
    const def = cardDb[inst.cardId];
    if (!def) continue;
    const placement = pickFirstLegalPlacement(state, active.id, def, cardDb);
    if (placement) return { kind: "PLAY_CARD", instanceId: id, placement };
  }

  // No legal play — discard the first card in hand. (R5.1 allows discard
  // when no legal play remains.)
  const firstHand = active.hand[0];
  if (!firstHand) {
    // Empty hand and quota not met — quota target = startedWith (0 or low),
    // so end phase. (Defensive; setup gives 7 cards so this is unusual.)
    return { kind: "END_PHASE" };
  }
  return { kind: "DISCARD_CARD", instanceId: firstHand };
}

function pickFirstLegalPlacement(
  state: GameState,
  playerId: string,
  def: CardDefinition,
  _cardDb: CardDatabase,
): PlacementRef | null {
  switch (def.type) {
    case "entity": {
      // Battlefield first (cap 5/player).
      const onField = state.battlefield
        .map((id) => cardById(state, id))
        .filter((c) => c.ownerId === playerId).length;
      if (onField < 5) return { kind: "battlefield" };
      const active = state.players.find((p) => p.id === playerId);
      if (!active) return null;
      // Then any fortress with room.
      for (const fort of active.suburbs) {
        if (fort.occupantIds.length < 3) {
          return { kind: "fortress", fortressInstanceId: fort.fortressInstanceId };
        }
      }
      return null;
    }
    case "fortress":
      return { kind: "suburbs" };
    case "item_regular":
    case "item_consumable": {
      const targets = controlledEntitiesInPlay(state, playerId);
      for (const t of targets) {
        if (t.equippedItemIds.length < 3) {
          return { kind: "equip", entityInstanceId: t.instanceId };
        }
      }
      return null;
    }
  }
}

function controlledEntitiesInPlay(state: GameState, playerId: string) {
  const ids: InstanceId[] = [];
  for (const id of state.battlefield) {
    if (cardById(state, id).ownerId === playerId) ids.push(id);
  }
  const active = state.players.find((p) => p.id === playerId);
  if (active) {
    for (const fort of active.suburbs) {
      for (const id of fort.occupantIds) ids.push(id);
    }
  }
  return ids.map((id) => cardById(state, id));
}

// -----------------------------------------------------------------------------
// Logging helpers
// -----------------------------------------------------------------------------

function describeAction(action: Action, state: GameState, cardDb: CardDatabase): string {
  switch (action.kind) {
    case "PLAY_CARD": {
      const inst = findCard(state, action.instanceId);
      const name = inst ? (cardDb[inst.cardId]?.name ?? inst.cardId) : action.instanceId;
      const dest = describePlacement(action.placement);
      return `played ${name} → ${dest}`;
    }
    case "DISCARD_CARD": {
      const inst = findCard(state, action.instanceId);
      const name = inst ? (cardDb[inst.cardId]?.name ?? inst.cardId) : action.instanceId;
      return `discarded ${name}`;
    }
    case "END_PHASE":
      return `ended phase`;
  }
}

function describePlacement(p: PlacementRef): string {
  switch (p.kind) {
    case "battlefield": return "battlefield";
    case "fortress":    return `fortress ${p.fortressInstanceId}`;
    case "suburbs":     return "suburbs";
    case "equip":       return `equipped to ${p.entityInstanceId}`;
  }
}

/**
 * Autoplay for AI turns and phases where the human has no pending choice.
 *
 * Lives in the app layer (not the engine) to keep the engine pure of
 * "controller" logic. This file's responsibilities:
 *
 *   1. AI Card Play: when an AI player is active and we're in card_play,
 *      walk them through legal plays and end their phase. Sprint 11 will
 *      replace the deterministic-first-legal logic here with personality-
 *      weighted selection.
 *
 *   2. AI Combat: when an AI controls the active combat phase or the acting
 *      side of an engagement, it dispatches deterministic baseline combat
 *      actions. Sprint 11 will replace this with personality-weighted picks.
 *
 *   3. AI Movement: Sprint 8 makes Movement real for the human. The baseline
 *      AI strategy skips repositioning for now and ends the phase; Sprint 11
 *      can make this personality-aware.
 *
 *   4. Stub phase advance: card_draw and victory_check have no real action
 *      handlers yet. From the player's perspective there's nothing to do in
 *      those phases, so we auto-dispatch END_PHASE through them.
 *
 *   5. Loop: keep applying until either (a) human input is required, (b) the
 *      game has ended (outcome set), or (c) we hit the safety cap.
 *
 * Returns the new state after autoplay settles. Errors short-circuit and
 * propagate so the caller can surface them.
 */

import type { CardDatabase, CardDefinition } from "@gk/cards";
import {
  type Action,
  type GameState,
  type InstanceId,
  type MovementDestinationRef,
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

    // -------- Engagement is active: dispatch combat actions ---------
    // The controlling player for the side currently to act may differ from
    // the turn-owner (e.g. when defender is acting). We look at sideToAct.
    if (s.engagement) {
      const eng = s.engagement;
      const controllingId = eng.sideToAct === "attacker" ? eng.attackerSide : eng.defenderSide;
      const controlling = s.players.find((p) => p.id === controllingId);
      if (!controlling) return { state: s, events, error: `no controlling player "${controllingId}"` };

      // Hand back to the human if they need to act.
      if (controlling.kind === "human") break;

      // AI on this side: pick a combat action.
      const action = chooseAiCombatAction(s, controllingId, ctx.cardDb);
      const r = reduce(s, action, { cardDatabase: ctx.cardDb });
      if (!r.ok) {
        return { state: s, events, error: `AI combat dispatch failed: ${r.error}` };
      }
      events.push(`${controlling.name}: ${describeAction(action, s, ctx.cardDb)}`);
      s = r.value;
      continue;
    }

    // -------- No engagement: phase-based dispatch ---------

    // Card Play: human waits, AI plays.
    if (s.phase === "card_play") {
      if (active.kind === "human") break;
      const action = chooseAiCardPlayAction(s, ctx.cardDb);
      const r = reduce(s, action, { cardDatabase: ctx.cardDb });
      if (!r.ok) return { state: s, events, error: `AI dispatch failed: ${r.error}` };
      events.push(`${active.name}: ${describeAction(action, s, ctx.cardDb)}`);
      s = r.value;
      continue;
    }

    // Combat phase, no engagement: human waits to declare/end; AI tries to
    // declare a battlefield engagement, otherwise ends the phase.
    if (s.phase === "combat") {
      if (active.kind === "human") break;
      const action = chooseAiCombatPhaseAction(s, ctx.cardDb);
      const r = reduce(s, action, { cardDatabase: ctx.cardDb });
      if (!r.ok) return { state: s, events, error: `AI combat-phase dispatch failed: ${r.error}` };
      events.push(`${active.name}: ${describeAction(action, s, ctx.cardDb)}`);
      s = r.value;
      continue;
    }

    // Movement phase: human gets to reposition; current AI baseline skips it.
    if (s.phase === "movement") {
      if (active.kind === "human") break;
      const action: Action = { kind: "END_PHASE" };
      const r = reduce(s, action, { cardDatabase: ctx.cardDb });
      if (!r.ok) return { state: s, events, error: `AI movement dispatch failed: ${r.error}` };
      events.push(`${active.name}: ${describeAction(action, s, ctx.cardDb)}`);
      s = r.value;
      continue;
    }

    // Any other phase: auto-end (stub for now).
    const r = reduce(s, { kind: "END_PHASE" }, { cardDatabase: ctx.cardDb });
    if (!r.ok) {
      return { state: s, events, error: `END_PHASE in ${s.phase} failed: ${r.error}` };
    }
    s = r.value;
  }
  return { state: s, events, error: null };
}

// -----------------------------------------------------------------------------
// AI combat decisions (Sprint 6 deterministic fallback; Sprint 11 personality-weights)
// -----------------------------------------------------------------------------

/**
 * Choose an AI's action when the active player is in the combat phase but
 * NO engagement is currently active. Decides between declaring a new
 * engagement and ending the combat phase.
 *
 * Strategy: declare against the opponent with the most battlefield entities
 * if any exist. If no battlefield target exists but an opponent has a
 * fortress, assault the first such fortress. Otherwise end the phase.
 */
export function chooseAiCombatPhaseAction(
  state: GameState,
  _cardDb: CardDatabase,
): Action {
  const active = state.players.find((p) => p.id === state.activePlayerId);
  if (!active) throw new Error("chooseAiCombatPhaseAction: no active player");

  const myBattlefield = state.battlefield
    .map((id) => state.cardsByInstanceId[id]!)
    .filter((c) => c.ownerId === active.id);
  if (myBattlefield.length === 0) return { kind: "END_PHASE" };

  // Pick best target: opponent with most battlefield entities.
  let bestTargetId: string | null = null;
  let bestCount = 0;
  for (const p of state.players) {
    if (p.id === active.id) continue;
    const count = state.battlefield.filter(
      (id) => state.cardsByInstanceId[id]!.ownerId === p.id,
    ).length;
    if (count > bestCount) {
      bestCount = count;
      bestTargetId = p.id;
    }
  }
  if (!bestTargetId || bestCount === 0) {
    return chooseAiFortressAssaultOrEnd(state, myBattlefield.map((c) => c.instanceId));
  }

  return {
    kind: "DECLARE_ENGAGEMENT",
    spec: {
      kind: "battlefield",
      defenderId: bestTargetId,
      attackerEntityIds: myBattlefield.map((c) => c.instanceId),
    },
  };
}

function chooseAiFortressAssaultOrEnd(state: GameState, attackerIds: InstanceId[]): Action {
  const active = state.players.find((p) => p.id === state.activePlayerId);
  if (!active) throw new Error("chooseAiFortressAssaultOrEnd: no active player");
  for (const p of state.players) {
    if (p.id === active.id) continue;
    const target = p.suburbs.find((f) => f.ownerId === p.id);
    if (!target) continue;
    return {
      kind: "DECLARE_ENGAGEMENT",
      spec: {
        kind: "fortress_assault",
        defenderId: p.id,
        attackerEntityIds: attackerIds,
        targetFortressInstanceIds: [target.fortressInstanceId],
      },
    };
  }
  return { kind: "END_PHASE" };
}

/**
 * Choose an AI's action while an engagement is active and it's their side's
 * turn to act. Strategy: pick the first entity on this side that still has
 * an action remaining, attack the first opposing entity.
 */
export function chooseAiCombatAction(
  state: GameState,
  controllingPlayerId: string,
  _cardDb: CardDatabase,
): Action {
  const eng = state.engagement;
  if (!eng) throw new Error("chooseAiCombatAction: no engagement");

  const ownIds = eng.sideToAct === "attacker" ? eng.attackerEntityIds : eng.defenderEntityIds;
  const targetIds = eng.sideToAct === "attacker" ? eng.defenderEntityIds : eng.attackerEntityIds;

  if (
    eng.kind === "fortress_assault" &&
    eng.defenderEntityIds.length === 0 &&
    eng.targetFortressInstanceIds.length > 0 &&
    eng.attackerEntityIds.length > 0
  ) {
    return {
      kind: "RESOLVE_FORTRESS_ASSAULT",
      fortressInstanceId: eng.targetFortressInstanceIds[0]!,
      choice: "capture",
      garrisonEntityIds: [eng.attackerEntityIds[0]!],
    };
  }

  // Find the first entity on this side that still has actions.
  let actor: string | null = null;
  for (const id of ownIds) {
    if ((eng.actionsRemainingByEntity[id] ?? 0) > 0) {
      actor = id;
      break;
    }
  }
  if (!actor) {
    // Side has no remaining actions but engine hasn't flipped yet — defensive
    // pass on the first entity (engine will then advance).
    actor = ownIds[0]!;
    return { kind: "PASS_ACTION", entityInstanceId: actor };
  }

  if (targetIds.length === 0) {
    if (eng.kind === "fortress_assault" && eng.sideToAct === "attacker" && eng.targetFortressInstanceIds.length > 0) {
      return {
        kind: "NORMAL_ATTACK",
        attackerInstanceId: actor,
        targetInstanceId: eng.targetFortressInstanceIds[0]!,
      };
    }
    // No targets — pass. (maybeEndEngagement will close the engagement next turn.)
    return { kind: "PASS_ACTION", entityInstanceId: actor };
  }
  void controllingPlayerId;
  return {
    kind: "NORMAL_ATTACK",
    attackerInstanceId: actor,
    targetInstanceId: targetIds[0]!,
  };
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
    case "DECLARE_ENGAGEMENT":
      return `declared engagement (${action.spec.kind})`;
    case "RESOLVE_FORTRESS_ASSAULT":
      return `resolved fortress assault (${action.choice})`;
    case "MOVE_ENTITY": {
      const e = findCard(state, action.entityInstanceId);
      const eName = e ? (cardDb[e.cardId]?.name ?? e.cardId) : action.entityInstanceId;
      return `moved ${eName} → ${describeMovementDestination(action.destination)}`;
    }
    case "NORMAL_ATTACK": {
      const a = findCard(state, action.attackerInstanceId);
      const t = findCard(state, action.targetInstanceId);
      const aName = a ? (cardDb[a.cardId]?.name ?? a.cardId) : action.attackerInstanceId;
      const tName = t ? (cardDb[t.cardId]?.name ?? t.cardId) : action.targetInstanceId;
      return `${aName} attacked ${tName}`;
    }
    case "PASS_ACTION": {
      const e = findCard(state, action.entityInstanceId);
      const eName = e ? (cardDb[e.cardId]?.name ?? e.cardId) : action.entityInstanceId;
      return `${eName} passed`;
    }
  }
}

function describeMovementDestination(p: MovementDestinationRef): string {
  if (p.kind === "battlefield") return "battlefield";
  return `fortress ${p.fortressInstanceId}`;
}

function describePlacement(p: PlacementRef): string {
  switch (p.kind) {
    case "battlefield": return "battlefield";
    case "fortress":    return `fortress ${p.fortressInstanceId}`;
    case "suburbs":     return "suburbs";
    case "equip":       return `equipped to ${p.entityInstanceId}`;
  }
}

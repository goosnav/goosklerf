/**
 * Combat phase reducer handlers.
 *
 * Sprint 6/7 covers:
 *   R6.1   battlefield declaration
 *   R6.2   combat staging — Sprint 6 limits attackers to controlled battlefield entities
 *   R6.3   alternating round structure
 *   R6.4   action menu (NORMAL_ATTACK + PASS_ACTION only this sprint)
 *   R6.5   normal attack resolution (1d6 ≤ modified Attack)
 *   R6.6   engagement-end conditions
 *   R6.7   Initial Volley auto-resolve at declaration
 *   R6.8   fortress assault declaration and target scope
 *   R6.9   fortress assault end conditions
 *   R6.10  capture/leave choice after defenders are cleared
 *   R6.11  fortress destruction mechanics
 *   R7.1   damage application
 *   R7.3   entity defeat (items follow to graveyard)
 *   R7.4   fortress destruction (occupants/items follow to graveyards)
 *
 * Deliberate Sprint 6 simplifications, documented for the next sprints to revisit:
 *   - Initial Volley fires only from the DEFENDER's eligible fortresses
 *     (R6.7 strictly read also permits third-party fortresses to volley; we
 *     defer that until multi-engagement scenarios show up in Sprint 7+).
 *   - Volley target picking is deterministic: first occupant fires at first
 *     attacker. The rulebook says "the controlling player chooses"; the
 *     auto-pick is good enough for AI play and for human-vs-AI scenarios where
 *     the AI is the one volleying.
 *   - Battlefield engagement staging may move owned entities out of owned
 *     fortresses; this removes fortress buffs immediately (R6.2, R3.10).
 *   - Modified Attack = baseAttack + sum(equipped items' attackBuff) + the
 *     containing fortress's attackBuff when the entity is inside a fortress
 *     (R3.10).
 *   - Modified max HP uses the same item/fortress buff sources. The current
 *     HP side effects are handled when the buff source appears/disappears.
 *   - Round advance is automatic: when every entity on sideToAct has an
 *     actionsRemaining of 0, the side flips. When both sides done, round++.
 *   - Engagement end is automatic: after every action we recheck R6.6.
 */

import type { CardDatabase } from "@gk/cards";
import type { Action, EngagementSpec } from "../actions.js";
import {
  cardById,
  cloneState,
  findCard,
  findPlayer,
  playerById,
} from "../helpers.js";
import { appendLog } from "../log.js";
import { rngFromState, SeededRng, type RngState } from "../rng.js";
import { type Result, err, ok } from "../result.js";
import {
  adjustEntityHpForMaxHpChange,
  clampEntityCurrentHpToModifiedMax,
  modifiedEntityAttack,
  modifiedEntityMaxHp,
} from "../stats.js";
import type {
  CardInstance,
  DamageEvent,
  Engagement,
  EngagementSide,
  GameState,
  InstanceId,
  Player,
  PlayerId,
} from "../state.js";

type DeclareAction = Extract<Action, { kind: "DECLARE_ENGAGEMENT" }>;
type AttackAction = Extract<Action, { kind: "NORMAL_ATTACK" }>;
type PassAction = Extract<Action, { kind: "PASS_ACTION" }>;
type ResolveAssaultAction = Extract<Action, { kind: "RESOLVE_FORTRESS_ASSAULT" }>;

// -----------------------------------------------------------------------------
// DECLARE_ENGAGEMENT (R6.1, R6.2, R6.7)
// -----------------------------------------------------------------------------

export function handleDeclareEngagement(
  state: GameState,
  action: DeclareAction,
  cardDb: CardDatabase,
): Result<GameState> {
  if (state.phase !== "combat") {
    return err(`R6.1: combat actions are illegal during ${state.phase}.`);
  }
  if (state.engagement !== null) {
    return err("R6.1: an engagement is already active; resolve it before declaring another.");
  }
  if (action.spec.kind === "fortress_assault") {
    return handleDeclareFortressAssault(state, action, cardDb);
  }

  const attacker = playerById(state, state.activePlayerId);
  const validation = validateBattlefieldDeclaration(state, attacker, action.spec, cardDb);
  if (!validation.ok) return validation;

  const next = cloneState(state);
  const nextAttacker = playerById(next, attacker.id);
  const nextDefender = playerById(next, validation.value.defenderId);
  const stagedFromFortress = stageAttackersForBattlefieldEngagement(
    next,
    nextAttacker.id,
    action.spec.attackerEntityIds,
    cardDb,
  );

  // R10.7 hook: declaring an engagement resets the active player's Old Age
  // counter. (Old Age advance logic lands Sprint 10; we set the flag now so
  // it's already correct when the rest of that machinery turns on.)
  nextAttacker.declaredEngagementThisTurn = true;

  // Build initial engagement frame (R6.3: round=1, attacker acts first).
  const engagement: Engagement = {
    kind: "battlefield",
    attackerSide: nextAttacker.id,
    defenderSide: nextDefender.id,
    attackerEntityIds: [...action.spec.attackerEntityIds],
    defenderEntityIds: defenderBattlefieldEntities(next, nextDefender.id),
    targetFortressInstanceIds: [],
    initialVolleyResolved: false,
    round: 1,
    sideToAct: "attacker",
    actionsRemainingByEntity: {},
    damageHistory: [],
    retreatingEntityIds: [],
    reinforcementsCalledThisRound: { attacker: false, defender: false },
  };
  // R6.4 — one action per entity per round. Initialized for round 1's attacker side;
  // we'll re-init for the defender when sideToAct flips.
  for (const id of engagement.attackerEntityIds) engagement.actionsRemainingByEntity[id] = 1;
  next.engagement = engagement;

  appendLog(next, {
    rule: "R6.1",
    actor: nextAttacker.id,
    message: `${nextAttacker.name} declared a battlefield engagement against ${nextDefender.name} with ${engagement.attackerEntityIds.length} attacker(s).`,
    data: {
      action: "DECLARE_ENGAGEMENT",
      attackerEntityIds: engagement.attackerEntityIds,
      defenderEntityIds: engagement.defenderEntityIds,
    },
  });
  appendLog(next, {
    rule: "R6.2",
    actor: nextAttacker.id,
    message: stagedFromFortress.length > 0
      ? `${nextAttacker.name} staged ${engagement.attackerEntityIds.length} attacker(s), moving ${stagedFromFortress.map((id) => nameOf(cardById(next, id), cardDb)).join(", ")} out of fortress defense.`
      : `${nextAttacker.name} staged ${engagement.attackerEntityIds.length} battlefield attacker(s).`,
    data: {
      action: "COMBAT_STAGING",
      attackerEntityIds: engagement.attackerEntityIds,
      movedFromFortress: stagedFromFortress,
    },
  });

  // R6.7 Initial Volley resolves before round 1.
  resolveInitialVolley(next, cardDb);
  // Even if no eligible fortresses fire, mark the phase complete.
  next.engagement!.initialVolleyResolved = true;

  // Initial Volley may have killed attackers / defenders (R7.3); check end conditions before round 1 begins.
  maybeEndEngagement(next, cardDb);

  // If attackers were wiped by Initial Volley (rare but possible), engagement is null now.
  // Otherwise initialize defender's actions for when the side flips.
  if (next.engagement) {
    initializeSideActions(next.engagement, "defender", next);
  }

  return ok(next);
}

function handleDeclareFortressAssault(
  state: GameState,
  action: DeclareAction,
  cardDb: CardDatabase,
): Result<GameState> {
  const attacker = playerById(state, state.activePlayerId);
  if (action.spec.kind !== "fortress_assault") {
    throw new Error("handleDeclareFortressAssault called for non-assault spec");
  }
  const validation = validateFortressAssaultDeclaration(state, attacker, action.spec, cardDb);
  if (!validation.ok) return validation;

  const next = cloneState(state);
  const nextAttacker = playerById(next, attacker.id);
  const nextDefender = playerById(next, validation.value.defenderId);
  nextAttacker.declaredEngagementThisTurn = true;

  const engagement: Engagement = {
    kind: "fortress_assault",
    attackerSide: nextAttacker.id,
    defenderSide: nextDefender.id,
    attackerEntityIds: [...action.spec.attackerEntityIds],
    defenderEntityIds: fortressAssaultDefenders(next, action.spec.targetFortressInstanceIds),
    targetFortressInstanceIds: [...action.spec.targetFortressInstanceIds],
    // R6.7 explicitly excludes fortress assaults from Initial Volley.
    initialVolleyResolved: true,
    round: 1,
    sideToAct: "attacker",
    actionsRemainingByEntity: {},
    damageHistory: [],
    retreatingEntityIds: [],
    reinforcementsCalledThisRound: { attacker: false, defender: false },
  };
  for (const id of engagement.attackerEntityIds) engagement.actionsRemainingByEntity[id] = 1;
  for (const id of engagement.defenderEntityIds) engagement.actionsRemainingByEntity[id] = 1;
  next.engagement = engagement;

  appendLog(next, {
    rule: "R6.8",
    actor: nextAttacker.id,
    message: `${nextAttacker.name} declared a fortress assault against ${nextDefender.name} targeting ${engagement.targetFortressInstanceIds.length} fortress(es).`,
    data: {
      action: "DECLARE_ENGAGEMENT",
      kind: "fortress_assault",
      attackerEntityIds: engagement.attackerEntityIds,
      defenderEntityIds: engagement.defenderEntityIds,
      targetFortressInstanceIds: engagement.targetFortressInstanceIds,
    },
  });
  maybeEndEngagement(next, cardDb);
  return ok(next);
}

interface BattlefieldDeclarationValid {
  defenderId: PlayerId;
}

interface FortressAssaultDeclarationValid {
  defenderId: PlayerId;
}

function validateBattlefieldDeclaration(
  state: GameState,
  attacker: Player,
  spec: EngagementSpec,
  cardDb: CardDatabase,
): Result<BattlefieldDeclarationValid> {
  if (spec.kind !== "battlefield") {
    return err("R6.1: Sprint 6 only supports battlefield engagements (fortress assault arrives Sprint 7).");
  }
  if (spec.defenderId === attacker.id) {
    return err("R6.1: cannot declare an engagement against yourself.");
  }
  const defender = findPlayer(state, spec.defenderId);
  if (!defender) return err(`R6.1: no player "${spec.defenderId}".`);

  if (spec.attackerEntityIds.length === 0) {
    return err("R6.1: declaration requires at least one attacker entity (R6.7 forbids empty declarations).");
  }

  const seen = new Set<InstanceId>();
  for (const id of spec.attackerEntityIds) {
    if (seen.has(id)) return err(`R6.1: attacker "${id}" listed twice.`);
    seen.add(id);
    const inst = findCard(state, id);
    if (!inst) return err(`R6.1: no card instance "${id}".`);
    if (inst.ownerId !== attacker.id) return err(`R6.1: "${id}" is not owned by the active player.`);
    if (inst.zone.zone !== "battlefield" && inst.zone.zone !== "fortress") {
      return err("R6.2: only battlefield entities or owned fortress occupants may join a battlefield engagement.");
    }
    if (inst.zone.zone === "fortress" && inst.zone.ownerId !== attacker.id) {
      return err("R6.2: fortress occupants may only sortie from a fortress you control.");
    }
    const def = cardDb[inst.cardId];
    if (!def || def.type !== "entity") {
      return err(`R6.1: "${id}" is not an entity.`);
    }
  }

  const currentBattlefieldCount = state.battlefield.filter(
    (id) => cardById(state, id).ownerId === attacker.id,
  ).length;
  const fortressAttackers = spec.attackerEntityIds.filter((id) => {
    const inst = cardById(state, id);
    return inst.zone.zone === "fortress";
  }).length;
  if (currentBattlefieldCount + fortressAttackers > 5) {
    return err("R6.2: staging fortress occupants would exceed the 5-entity battlefield capacity (R2.7).");
  }

  // R6.1 implicit: defender must have at least one battlefield entity OR fortress
  // to be a meaningful target. For Sprint 6 (battlefield-only), require at least
  // one defender entity on battlefield. (Empty battlefield → no-op declaration.)
  if (defenderBattlefieldEntities(state, spec.defenderId).length === 0) {
    return err("R6.1: defender has no battlefield entities — nothing to fight.");
  }

  return ok({ defenderId: spec.defenderId });
}

function validateFortressAssaultDeclaration(
  state: GameState,
  attacker: Player,
  spec: Extract<EngagementSpec, { kind: "fortress_assault" }>,
  cardDb: CardDatabase,
): Result<FortressAssaultDeclarationValid> {
  if (spec.defenderId === attacker.id) {
    return err("R6.8: cannot assault your own fortress.");
  }
  const defender = findPlayer(state, spec.defenderId);
  if (!defender) return err(`R6.8: no player "${spec.defenderId}".`);

  if (spec.attackerEntityIds.length === 0) {
    return err("R6.8: fortress assault requires at least one attacking battlefield entity.");
  }
  const seenAttackers = new Set<InstanceId>();
  for (const id of spec.attackerEntityIds) {
    if (seenAttackers.has(id)) return err(`R6.8: attacker "${id}" listed twice.`);
    seenAttackers.add(id);
    const inst = findCard(state, id);
    if (!inst) return err(`R6.8: no card instance "${id}".`);
    if (inst.ownerId !== attacker.id) return err(`R6.8: "${id}" is not owned by the active player.`);
    if (inst.zone.zone !== "battlefield") {
      return err("R6.8: only battlefield entities may assault and capture fortresses.");
    }
    const def = cardDb[inst.cardId];
    if (!def || def.type !== "entity") {
      return err(`R6.8: "${id}" is not an entity.`);
    }
  }

  if (spec.targetFortressInstanceIds.length === 0) {
    return err("R6.8: fortress assault requires at least one target fortress.");
  }
  const seenFortresses = new Set<InstanceId>();
  for (const id of spec.targetFortressInstanceIds) {
    if (seenFortresses.has(id)) return err(`R6.8: target fortress "${id}" listed twice.`);
    seenFortresses.add(id);
    const fort = defender.suburbs.find((f) => f.fortressInstanceId === id);
    if (!fort || fort.ownerId !== defender.id) {
      return err("R6.8: target fortresses must be controlled by the declared defender.");
    }
    const inst = findCard(state, id);
    if (!inst) return err(`R6.8: no fortress card instance "${id}".`);
    const def = cardDb[inst.cardId];
    if (!def || def.type !== "fortress") return err(`R6.8: "${id}" is not a fortress.`);
    if (inst.hp <= 0) return err("R6.8: cannot assault a destroyed fortress.");
  }

  return ok({ defenderId: spec.defenderId });
}

function stageAttackersForBattlefieldEngagement(
  state: GameState,
  attackerId: PlayerId,
  attackerEntityIds: InstanceId[],
  cardDb: CardDatabase,
): InstanceId[] {
  const movedFromFortress: InstanceId[] = [];
  for (const id of attackerEntityIds) {
    const inst = cardById(state, id);
    if (inst.zone.zone !== "fortress") continue;

    const fortressOwner = playerById(state, inst.zone.ownerId);
    const fortressInstanceId = inst.zone.fortressInstanceId;
    const fort = fortressOwner.suburbs.find(
      (f) => f.fortressInstanceId === fortressInstanceId,
    );
    if (fort) {
      fort.occupantIds = fort.occupantIds.filter((occId) => occId !== id);
    }
    inst.zone = { zone: "battlefield", ownerId: attackerId };
    if (!state.battlefield.includes(id)) state.battlefield.push(id);
    // Leaving a fortress removes R3.10 fortress HP buffs immediately. Current
    // damage persists, but temporary HP above the battlefield max is lost.
    clampEntityCurrentHpToModifiedMax(state, inst, cardDb);
    movedFromFortress.push(id);
  }
  return movedFromFortress;
}

function defenderBattlefieldEntities(state: GameState, defenderId: PlayerId): InstanceId[] {
  return state.battlefield.filter((id) => cardById(state, id).ownerId === defenderId);
}

function fortressAssaultDefenders(
  state: GameState,
  targetFortressInstanceIds: InstanceId[],
): InstanceId[] {
  const targetSet = new Set(targetFortressInstanceIds);
  const defenders: InstanceId[] = [];
  for (const player of state.players) {
    for (const fort of player.suburbs) {
      if (!targetSet.has(fort.fortressInstanceId)) continue;
      defenders.push(...fort.occupantIds);
    }
  }
  return defenders;
}

// -----------------------------------------------------------------------------
// Initial Volley (R6.7)
// -----------------------------------------------------------------------------

function resolveInitialVolley(state: GameState, cardDb: CardDatabase): void {
  const eng = state.engagement;
  if (!eng) return;
  if (eng.kind !== "battlefield") return;

  const defender = playerById(state, eng.defenderSide);
  // R6.7 eligibility: occupied + not under assault + not in barrage. Sprint 6
  // has no fortress assault and no barrage, so the gate simplifies to "occupied."
  const eligibleForts = defender.suburbs.filter((f) => f.occupantIds.length > 0);

  for (const fort of eligibleForts) {
    if (eng.attackerEntityIds.length === 0) break; // attackers all wiped
    // Auto-pick: first occupant fires at first attacker. (Sprint 6
    // simplification — the player normally chooses both per R6.7.)
    const occId = fort.occupantIds[0]!;
    const targetId = eng.attackerEntityIds[0]!;
    const occ = cardById(state, occId);
    const target = cardById(state, targetId);

    const result = rollNormalAttack(state, occ, cardDb);
    const fortName = fortressName(state, fort.fortressInstanceId, cardDb);
    appendLog(state, {
      rule: "R6.7",
      actor: defender.id,
      message: result.hit
        ? `Initial Volley: ${nameOf(occ, cardDb)} (in ${fortName}) hit ${nameOf(target, cardDb)} (rolled ${result.roll} vs Attack ${result.modifiedAttack}).`
        : `Initial Volley: ${nameOf(occ, cardDb)} (in ${fortName}) missed ${nameOf(target, cardDb)} (rolled ${result.roll} vs Attack ${result.modifiedAttack}).`,
      data: {
        fortressInstanceId: fort.fortressInstanceId,
        attackerInstanceId: occId,
        targetInstanceId: targetId,
        roll: result.roll,
        modifiedAttack: result.modifiedAttack,
        hit: result.hit,
      },
    });

    if (result.hit) {
      applyDamageAndDefeat(state, target, 1, "normal", occId, cardDb);
    }
  }
}

// -----------------------------------------------------------------------------
// NORMAL_ATTACK (R6.5) and PASS_ACTION (R6.4)
// -----------------------------------------------------------------------------

export function handleNormalAttack(
  state: GameState,
  action: AttackAction,
  cardDb: CardDatabase,
): Result<GameState> {
  if (state.phase !== "combat") {
    return err(`R6.5: combat actions are illegal during ${state.phase}.`);
  }
  if (!state.engagement) {
    return err("R6.5: no engagement is active. Declare one first.");
  }
  const eng = state.engagement;

  // Validate attacker eligibility.
  const attacker = findCard(state, action.attackerInstanceId);
  if (!attacker) return err(`R6.5: no card "${action.attackerInstanceId}".`);

  const acting = sideOfEntity(eng, action.attackerInstanceId);
  if (acting !== eng.sideToAct) {
    return err(`R6.5: it is not ${acting ?? "this entity"}'s turn (current side: ${eng.sideToAct}).`);
  }
  const remaining = eng.actionsRemainingByEntity[action.attackerInstanceId];
  if (!remaining || remaining <= 0) {
    return err(`R6.5: ${nameOf(attacker, cardDb)} has no action remaining this round.`);
  }

  // Validate target eligibility (must be in opposing side).
  const target = findCard(state, action.targetInstanceId);
  if (!target) return err(`R6.5: no target "${action.targetInstanceId}".`);
  const targetValidation = validateNormalAttackTarget(eng, acting, target, cardDb);
  if (!targetValidation.ok) return targetValidation;

  // Execute.
  const next = cloneState(state);
  const nextEng = next.engagement!;
  const nextAttacker = cardById(next, action.attackerInstanceId);
  const nextTarget = cardById(next, action.targetInstanceId);
  const targetKind = targetValidation.value.kind;

  const result = rollNormalAttack(next, nextAttacker, cardDb);
  appendLog(next, {
    rule: "R6.5",
    actor: nextAttacker.ownerId,
    message: result.hit
      ? `${nameOf(nextAttacker, cardDb)} hit ${nameOf(nextTarget, cardDb)} (rolled ${result.roll} vs Attack ${result.modifiedAttack}).`
      : `${nameOf(nextAttacker, cardDb)} missed ${nameOf(nextTarget, cardDb)} (rolled ${result.roll} vs Attack ${result.modifiedAttack}).`,
    data: {
      action: "NORMAL_ATTACK",
      attackerInstanceId: nextAttacker.instanceId,
      targetInstanceId: nextTarget.instanceId,
      ...result,
    },
  });

  if (result.hit) {
    if (targetKind === "fortress") {
      applyFortressDamageAndMaybeDestroy(next, nextTarget, 1, "normal", nextAttacker.instanceId, cardDb);
    } else {
      applyDamageAndDefeat(next, nextTarget, 1, "normal", nextAttacker.instanceId, cardDb);
    }
  }

  spendAction(nextEng, nextAttacker.instanceId);
  advanceSideAndRound(next);
  maybeEndEngagement(next, cardDb);
  return ok(next);
}

type NormalAttackTarget =
  | { kind: "entity" }
  | { kind: "fortress" };

function validateNormalAttackTarget(
  eng: Engagement,
  acting: EngagementSide,
  target: CardInstance,
  cardDb: CardDatabase,
): Result<NormalAttackTarget> {
  const targetSide = sideOfEntity(eng, target.instanceId);
  if (targetSide) {
    if (targetSide === acting) {
      return err("R6.5: cannot target a friendly entity with a normal attack.");
    }
    return ok({ kind: "entity" });
  }

  if (eng.kind === "fortress_assault") {
    const targetDef = cardDb[target.cardId];
    if (
      acting === "attacker" &&
      targetDef?.type === "fortress" &&
      eng.targetFortressInstanceIds.includes(target.instanceId)
    ) {
      return ok({ kind: "fortress" });
    }
  }

  return err(`R6.5: target "${target.instanceId}" is not a legal target in this engagement.`);
}

export function handlePassAction(
  state: GameState,
  action: PassAction,
  cardDb: CardDatabase,
): Result<GameState> {
  if (state.phase !== "combat") {
    return err(`R6.4: combat actions are illegal during ${state.phase}.`);
  }
  if (!state.engagement) {
    return err("R6.4: no engagement is active.");
  }
  const eng = state.engagement;
  const acting = sideOfEntity(eng, action.entityInstanceId);
  if (acting !== eng.sideToAct) {
    return err(`R6.4: it is not ${acting ?? "this entity"}'s turn (current side: ${eng.sideToAct}).`);
  }
  const remaining = eng.actionsRemainingByEntity[action.entityInstanceId];
  if (!remaining || remaining <= 0) {
    return err("R6.4: this entity has no action remaining this round.");
  }
  const inst = cardById(state, action.entityInstanceId);

  const next = cloneState(state);
  const nextEng = next.engagement!;
  appendLog(next, {
    rule: "R6.4",
    actor: inst.ownerId,
    message: `${nameOf(inst, cardDb)} passed.`,
    data: { action: "PASS_ACTION", entityInstanceId: inst.instanceId },
  });
  spendAction(nextEng, inst.instanceId);
  advanceSideAndRound(next);
  maybeEndEngagement(next, cardDb);
  return ok(next);
}

// -----------------------------------------------------------------------------
// RESOLVE_FORTRESS_ASSAULT (R6.9, R6.10, R6.11)
// -----------------------------------------------------------------------------

export function handleResolveFortressAssault(
  state: GameState,
  action: ResolveAssaultAction,
  cardDb: CardDatabase,
): Result<GameState> {
  if (state.phase !== "combat") {
    return err(`R6.10: fortress assault resolution is illegal during ${state.phase}.`);
  }
  if (!state.engagement || state.engagement.kind !== "fortress_assault") {
    return err("R6.10: no fortress assault is active.");
  }

  const eng = state.engagement;
  if (!eng.targetFortressInstanceIds.includes(action.fortressInstanceId)) {
    return err("R6.10: that fortress is not a target in this assault.");
  }
  const fortInst = findCard(state, action.fortressInstanceId);
  if (!fortInst) return err(`R6.10: no fortress "${action.fortressInstanceId}".`);
  if (fortInst.hp <= 0) return err("R6.10: that fortress is already destroyed.");
  if (fortressHasDefenders(state, action.fortressInstanceId, eng)) {
    return err("R6.10: clear or remove all defenders from that fortress before resolving it.");
  }
  if (eng.attackerEntityIds.length === 0) {
    return err("R6.9: fortress assault cannot resolve because no attackers remain.");
  }

  const next = cloneState(state);
  const nextEng = next.engagement!;
  const nextFortInst = cardById(next, action.fortressInstanceId);
  const attacker = playerById(next, nextEng.attackerSide);

  switch (action.choice) {
    case "capture": {
      const garrisonIds = action.garrisonEntityIds ?? [];
      const validation = validateCaptureGarrison(nextEng, garrisonIds);
      if (!validation.ok) return validation;
      captureFortress(next, nextFortInst, garrisonIds, cardDb);
      appendLog(next, {
        rule: "R6.10",
        actor: attacker.id,
        message: `${attacker.name} captured ${nameOf(nextFortInst, cardDb)} with ${garrisonIds.length} garrison entity/entities.`,
        data: {
          action: "RESOLVE_FORTRESS_ASSAULT",
          choice: "capture",
          fortressInstanceId: nextFortInst.instanceId,
          garrisonEntityIds: garrisonIds,
        },
      });
      break;
    }
    case "destroy": {
      appendLog(next, {
        rule: "R6.11",
        actor: attacker.id,
        message: `${attacker.name} chose to destroy ${nameOf(nextFortInst, cardDb)} after clearing its defenders.`,
        data: {
          action: "RESOLVE_FORTRESS_ASSAULT",
          choice: "destroy",
          fortressInstanceId: nextFortInst.instanceId,
        },
      });
      destroyFortress(next, nextFortInst, cardDb);
      break;
    }
    case "leave": {
      nextEng.targetFortressInstanceIds = nextEng.targetFortressInstanceIds.filter(
        (id) => id !== nextFortInst.instanceId,
      );
      appendLog(next, {
        rule: "R6.10",
        actor: attacker.id,
        message: `${attacker.name} left ${nameOf(nextFortInst, cardDb)} under its current control.`,
        data: {
          action: "RESOLVE_FORTRESS_ASSAULT",
          choice: "leave",
          fortressInstanceId: nextFortInst.instanceId,
        },
      });
      break;
    }
  }

  maybeEndEngagement(next, cardDb);
  return ok(next);
}

// -----------------------------------------------------------------------------
// Damage / defeat / destruction (R7.1, R7.3, R7.4)
// -----------------------------------------------------------------------------

function applyDamageAndDefeat(
  state: GameState,
  target: CardInstance,
  amount: number,
  source: DamageEvent["source"],
  attackerInstanceId: InstanceId | null,
  cardDb: CardDatabase,
): void {
  // R7.1 — apply damage.
  target.hp = Math.max(0, target.hp - amount);
  // R6.12 Parry will reach into damageHistory; record it with engagement-local ID.
  const eng = state.engagement;
  if (eng) {
    const ev: DamageEvent = {
      id: `dmg-${eng.round}-${eng.damageHistory.length + 1}`,
      round: eng.round,
      source,
      attackerInstanceId,
      targetInstanceId: target.instanceId,
      amount,
    };
    eng.damageHistory.push(ev);
  }
  appendLog(state, {
    rule: "R7.1",
    actor: target.ownerId,
    message: `${nameOf(target, cardDb)} took ${amount} damage (HP: ${target.hp}).`,
    data: { targetInstanceId: target.instanceId, hpAfter: target.hp, source },
  });

  if (target.hp === 0) {
    defeatEntity(state, target, cardDb);
  }
}

function applyFortressDamageAndMaybeDestroy(
  state: GameState,
  target: CardInstance,
  amount: number,
  source: DamageEvent["source"],
  attackerInstanceId: InstanceId | null,
  cardDb: CardDatabase,
): void {
  target.hp = Math.max(0, target.hp - amount);
  const eng = state.engagement;
  if (eng) {
    const ev: DamageEvent = {
      id: `dmg-${eng.round}-${eng.damageHistory.length + 1}`,
      round: eng.round,
      source,
      attackerInstanceId,
      targetInstanceId: target.instanceId,
      amount,
    };
    eng.damageHistory.push(ev);
  }
  appendLog(state, {
    rule: "R7.1",
    actor: target.ownerId,
    message: `${nameOf(target, cardDb)} took ${amount} damage (HP: ${target.hp}).`,
    data: { targetInstanceId: target.instanceId, hpAfter: target.hp, source },
  });

  if (target.hp === 0) {
    appendLog(state, {
      rule: "R6.11",
      actor: attackerInstanceId ? cardById(state, attackerInstanceId).ownerId : "system",
      message: `${nameOf(target, cardDb)} was reduced to 0 HP during a fortress assault.`,
      data: { action: "FORTRESS_DESTROYED_BY_DAMAGE", fortressInstanceId: target.instanceId },
    });
    destroyFortress(state, target, cardDb);
  }
}

function defeatEntity(state: GameState, target: CardInstance, cardDb: CardDatabase): void {
  // R7.3 — entity goes to its owner's graveyard with all equipped items.
  const itemNames = moveEntityAndItemsToOwnerGraveyard(state, target, cardDb);
  const owner = playerById(state, target.ownerId);

  appendLog(state, {
    rule: "R7.3",
    actor: owner.id,
    message: itemNames.length > 0
      ? `${nameOf(target, cardDb)} was defeated. Items lost: ${itemNames.join(", ")}.`
      : `${nameOf(target, cardDb)} was defeated.`,
    data: { defeatedInstanceId: target.instanceId, itemsLost: itemNames },
  });
}

function destroyFortress(state: GameState, fortressInst: CardInstance, cardDb: CardDatabase): void {
  fortressInst.hp = 0;
  const slot = findFortressSlotByInstanceId(state, fortressInst.instanceId);
  const occupantIds = slot ? [...slot.fortress.occupantIds] : [];
  const destroyedOccupants: string[] = [];
  const destroyedItems: string[] = [];

  for (const occupantId of occupantIds) {
    const occupant = state.cardsByInstanceId[occupantId];
    if (!occupant) continue;
    const itemNames = moveEntityAndItemsToOwnerGraveyard(state, occupant, cardDb);
    destroyedOccupants.push(nameOf(occupant, cardDb));
    destroyedItems.push(...itemNames);
  }

  for (const player of state.players) {
    player.suburbs = player.suburbs.filter((f) => f.fortressInstanceId !== fortressInst.instanceId);
  }
  if (state.engagement) {
    state.engagement.targetFortressInstanceIds = state.engagement.targetFortressInstanceIds.filter(
      (id) => id !== fortressInst.instanceId,
    );
  }

  const owner = playerById(state, fortressInst.ownerId);
  fortressInst.zone = { zone: "graveyard", ownerId: owner.id };
  owner.graveyard.push(fortressInst.instanceId);

  appendLog(state, {
    rule: "R7.4",
    actor: owner.id,
    message: destroyedOccupants.length > 0
      ? `${nameOf(fortressInst, cardDb)} was destroyed. Occupants lost: ${destroyedOccupants.join(", ")}.`
      : `${nameOf(fortressInst, cardDb)} was destroyed.`,
    data: {
      fortressInstanceId: fortressInst.instanceId,
      destroyedOccupants,
      destroyedItems,
    },
  });
}

function moveEntityAndItemsToOwnerGraveyard(
  state: GameState,
  target: CardInstance,
  cardDb: CardDatabase,
): string[] {
  const owner = playerById(state, target.ownerId);
  const itemNames: string[] = [];

  for (const itemId of [...target.equippedItemIds]) {
    const item = state.cardsByInstanceId[itemId];
    if (!item) continue;
    const itemOwner = playerById(state, item.ownerId);
    item.zone = { zone: "graveyard", ownerId: itemOwner.id };
    itemOwner.graveyard.push(itemId);
    const itemDef = cardDb[item.cardId];
    itemNames.push(itemDef?.name ?? item.cardId);
  }
  target.equippedItemIds = [];

  if (target.zone.zone === "battlefield") {
    state.battlefield = state.battlefield.filter((id) => id !== target.instanceId);
  } else if (target.zone.zone === "fortress") {
    const fortSlot = findFortressSlotByInstanceId(state, target.zone.fortressInstanceId);
    if (fortSlot) {
      fortSlot.fortress.occupantIds = fortSlot.fortress.occupantIds.filter(
        (id) => id !== target.instanceId,
      );
    }
  }

  if (state.engagement) {
    state.engagement.attackerEntityIds = state.engagement.attackerEntityIds.filter(
      (id) => id !== target.instanceId,
    );
    state.engagement.defenderEntityIds = state.engagement.defenderEntityIds.filter(
      (id) => id !== target.instanceId,
    );
    delete state.engagement.actionsRemainingByEntity[target.instanceId];
  }

  target.zone = { zone: "graveyard", ownerId: owner.id };
  owner.graveyard.push(target.instanceId);
  return itemNames;
}

function validateCaptureGarrison(eng: Engagement, garrisonIds: InstanceId[]): Result<true> {
  if (garrisonIds.length === 0) {
    return err("R6.10: capture requires at least one surviving attacker to enter the fortress.");
  }
  if (garrisonIds.length > 3) {
    return err("R6.10: capture garrison cannot exceed fortress capacity of 3 entities.");
  }
  const seen = new Set<InstanceId>();
  for (const id of garrisonIds) {
    if (seen.has(id)) return err(`R6.10: garrison entity "${id}" listed twice.`);
    seen.add(id);
    if (!eng.attackerEntityIds.includes(id)) {
      return err("R6.10: only surviving assault attackers can garrison a captured fortress.");
    }
  }
  return ok(true);
}

function captureFortress(
  state: GameState,
  fortressInst: CardInstance,
  garrisonIds: InstanceId[],
  cardDb: CardDatabase,
): void {
  const eng = state.engagement;
  if (!eng) return;
  const attackerId = eng.attackerSide;
  const attacker = playerById(state, attackerId);
  const slot = findFortressSlotByInstanceId(state, fortressInst.instanceId);
  if (!slot) throw new Error(`captureFortress: no fortress slot for "${fortressInst.instanceId}"`);

  // Move the fortress slot to the attacker's suburbs so future "my fortress"
  // lookups work after capture. The card's ownerId remains its original owner
  // per R3.8; the slot ownerId and zone ownerId represent current control.
  slot.controller.suburbs = slot.controller.suburbs.filter(
    (f) => f.fortressInstanceId !== fortressInst.instanceId,
  );
  slot.fortress.ownerId = attackerId;
  slot.fortress.occupantIds = [];
  attacker.suburbs.push(slot.fortress);
  fortressInst.zone = { zone: "suburbs", ownerId: attackerId };

  for (const id of garrisonIds) {
    const entity = cardById(state, id);
    const beforeMaxHp = modifiedEntityMaxHp(state, entity, cardDb);
    state.battlefield = state.battlefield.filter((fieldId) => fieldId !== id);
    entity.zone = { zone: "fortress", ownerId: attackerId, fortressInstanceId: fortressInst.instanceId };
    slot.fortress.occupantIds.push(id);
    adjustEntityHpForMaxHpChange(entity, beforeMaxHp, modifiedEntityMaxHp(state, entity, cardDb));
    eng.attackerEntityIds = eng.attackerEntityIds.filter((attackerEntityId) => attackerEntityId !== id);
    delete eng.actionsRemainingByEntity[id];
  }

  eng.targetFortressInstanceIds = eng.targetFortressInstanceIds.filter(
    (id) => id !== fortressInst.instanceId,
  );
}

function fortressHasDefenders(
  state: GameState,
  fortressInstanceId: InstanceId,
  eng: Engagement,
): boolean {
  const slot = findFortressSlotByInstanceId(state, fortressInstanceId);
  if (!slot) return false;
  return slot.fortress.occupantIds.some((id) => eng.defenderEntityIds.includes(id));
}

function findFortressSlotByInstanceId(
  state: GameState,
  fortressInstanceId: InstanceId,
): { controller: Player; fortress: Player["suburbs"][number] } | null {
  for (const player of state.players) {
    const fortress = player.suburbs.find((f) => f.fortressInstanceId === fortressInstanceId);
    if (fortress) return { controller: player, fortress };
  }
  return null;
}

// -----------------------------------------------------------------------------
// Round / side advance (R6.3) and engagement end (R6.6)
// -----------------------------------------------------------------------------

function spendAction(eng: Engagement, instanceId: InstanceId): void {
  eng.actionsRemainingByEntity[instanceId] = Math.max(
    0,
    (eng.actionsRemainingByEntity[instanceId] ?? 0) - 1,
  );
}

function advanceSideAndRound(state: GameState): void {
  const eng = state.engagement;
  if (!eng) return;

  if (currentSideStillHasActions(eng)) return;

  // Side done. Flip; if the new side already has 0 entities (just got wiped),
  // the next maybeEndEngagement call will end the engagement.
  if (eng.sideToAct === "attacker") {
    eng.sideToAct = "defender";
    initializeSideActions(eng, "defender", state);
  } else {
    // Both sides finished round → next round.
    eng.round += 1;
    // Trim damageHistory to the last 2 rounds (R6.12 Parry only references last round).
    eng.damageHistory = eng.damageHistory.filter((d) => d.round >= eng.round - 1);
    eng.sideToAct = "attacker";
    eng.reinforcementsCalledThisRound = { attacker: false, defender: false };
    initializeSideActions(eng, "attacker", state);
  }
}

function currentSideStillHasActions(eng: Engagement): boolean {
  const ids = eng.sideToAct === "attacker" ? eng.attackerEntityIds : eng.defenderEntityIds;
  for (const id of ids) {
    if ((eng.actionsRemainingByEntity[id] ?? 0) > 0) return true;
  }
  return false;
}

function initializeSideActions(
  eng: Engagement,
  side: EngagementSide,
  _state: GameState,
): void {
  const ids = side === "attacker" ? eng.attackerEntityIds : eng.defenderEntityIds;
  for (const id of ids) {
    eng.actionsRemainingByEntity[id] = 1; // R6.4: one action per entity per round
  }
}

function maybeEndEngagement(state: GameState, _cardDb: CardDatabase): void {
  const eng = state.engagement;
  if (!eng) return;

  if (eng.kind === "fortress_assault") {
    maybeEndFortressAssault(state, eng);
    return;
  }

  const attackerLeft = eng.attackerEntityIds.length;
  const defenderLeft = eng.defenderEntityIds.length;

  if (attackerLeft === 0 || defenderLeft === 0) {
    const winner = attackerLeft > 0 ? eng.attackerSide : defenderLeft > 0 ? eng.defenderSide : null;
    appendLog(state, {
      rule: "R6.6",
      actor: "system",
      message: winner
        ? `Engagement ended after round ${eng.round}: ${winner} prevailed.`
        : `Engagement ended after round ${eng.round}: mutual wipe.`,
      data: {
        action: "END_ENGAGEMENT",
        attackerLeft,
        defenderLeft,
        rounds: eng.round,
      },
    });
    state.engagement = null;
  }
}

function maybeEndFortressAssault(state: GameState, eng: Engagement): void {
  const attackerLeft = eng.attackerEntityIds.length;
  const targetLeft = eng.targetFortressInstanceIds.length;

  if (attackerLeft === 0 || targetLeft === 0) {
    appendLog(state, {
      rule: "R6.9",
      actor: "system",
      message: targetLeft === 0
        ? `Fortress assault ended after round ${eng.round}: all target fortresses were resolved.`
        : `Fortress assault ended after round ${eng.round}: attackers were cleared.`,
      data: {
        action: "END_ENGAGEMENT",
        attackerLeft,
        targetLeft,
        defenderLeft: eng.defenderEntityIds.length,
        rounds: eng.round,
      },
    });
    state.engagement = null;
    return;
  }

  // If all defenders are gone but target fortresses remain, combat pauses on
  // the attacker for R6.10 resolution (`capture`, `destroy`, or `leave`).
  if (eng.defenderEntityIds.length === 0) {
    eng.sideToAct = "attacker";
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function sideOfEntity(eng: Engagement, id: InstanceId): EngagementSide | null {
  if (eng.attackerEntityIds.includes(id)) return "attacker";
  if (eng.defenderEntityIds.includes(id)) return "defender";
  return null;
}

interface AttackResult {
  roll: number;
  modifiedAttack: number;
  hit: boolean;
}

/**
 * R6.5: roll 1d6 ≤ modifiedAttack. The roll consumes RNG state, which we
 * persist back to GameState.rngState so determinism survives across actions.
 */
function rollNormalAttack(state: GameState, attacker: CardInstance, cardDb: CardDatabase): AttackResult {
  const modifiedAttack = modifiedEntityAttack(state, attacker, cardDb);

  const rng = rngFromCurrentState(state.rngState);
  const roll = rng.rollD6();
  state.rngState = rng.getState();

  return { roll, modifiedAttack, hit: roll <= modifiedAttack };
}

function rngFromCurrentState(rngState: RngState): SeededRng {
  return rngFromState(rngState);
}

function nameOf(inst: CardInstance, cardDb: CardDatabase): string {
  return cardDb[inst.cardId]?.name ?? inst.cardId;
}

function fortressName(state: GameState, fortressInstanceId: InstanceId, cardDb: CardDatabase): string {
  const inst = state.cardsByInstanceId[fortressInstanceId];
  if (!inst) return fortressInstanceId;
  return cardDb[inst.cardId]?.name ?? inst.cardId;
}

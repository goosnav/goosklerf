/**
 * Card Play phase reducer handlers.
 *
 * Covers R5.1-R5.4:
 *   - quota enforcement and forced discard
 *   - type-specific placement
 *   - placement capacity
 *   - consumables equip now and resolve later in Combat
 */

import type { CardDatabase, CardDefinition } from "@gk/cards";
import type { Action, PlacementRef } from "../actions.js";
import { cardById, cloneState, findCard, findFortress, playerById } from "../helpers.js";
import { appendLog } from "../log.js";
import { err, ok, type Result } from "../result.js";
import type { CardInstance, GameState, InstanceId, Player } from "../state.js";
import {
  adjustEntityHpForMaxHpChange,
  modifiedEntityMaxHp,
} from "../stats.js";

const CARD_PLAY_LIMIT = 3;
const BATTLEFIELD_ENTITY_CAP = 5;
const FORTRESS_ENTITY_CAP = 3;
const ENTITY_ITEM_CAP = 3;

type PlayAction = Extract<Action, { kind: "PLAY_CARD" }>;
type DiscardAction = Extract<Action, { kind: "DISCARD_CARD" }>;
type EndPhaseAction = Extract<Action, { kind: "END_PHASE" }>;

export function handlePlayCard(
  state: GameState,
  action: PlayAction,
  cardDb: CardDatabase,
): Result<GameState> {
  const active = playerById(state, state.activePlayerId);
  const start = ensureCardPlayActionAllowed(state, active, action.instanceId);
  if (!start.ok) return start;

  if (state.cardPlay.played >= CARD_PLAY_LIMIT) {
    return err("R5.1: cannot play more than 3 cards during Card Play.");
  }
  if (actionsTaken(state) >= cardPlayQuota(state)) {
    return err("R5.1: Card Play quota is already complete; end the phase.");
  }

  const inst = start.value;
  const def = cardDb[inst.cardId];
  if (!def) throw new Error(`handlePlayCard: missing card definition "${inst.cardId}"`);

  const next = cloneState(state);
  const nextActive = playerById(next, next.activePlayerId);
  const nextInst = cardById(next, action.instanceId);
  const nextDef = cardDb[nextInst.cardId];
  if (!nextDef) throw new Error(`handlePlayCard: missing card definition "${nextInst.cardId}"`);

  const placement = placeCard(next, nextActive, nextInst, nextDef, action.placement, cardDb);
  if (!placement.ok) return placement;

  removeFromHand(nextActive, action.instanceId);
  next.cardPlay.played += 1;
  appendLog(next, {
    rule: placement.value.rule,
    actor: nextActive.id,
    message: placement.value.message,
    data: {
      action: "PLAY_CARD",
      instanceId: action.instanceId,
      cardId: nextInst.cardId,
      placement: action.placement,
    },
  });
  return ok(next);
}

export function handleDiscardCard(
  state: GameState,
  action: DiscardAction,
  cardDb: CardDatabase,
): Result<GameState> {
  const active = playerById(state, state.activePlayerId);
  const start = ensureCardPlayActionAllowed(state, active, action.instanceId);
  if (!start.ok) return start;

  if (actionsTaken(state) >= cardPlayQuota(state)) {
    return err("R5.1: Card Play quota is already complete; end the phase.");
  }

  // R5.1: discarding is only allowed once no legal play remains before quota.
  if (state.cardPlay.played < cardPlayQuota(state) && hasAnyLegalPlay(state, active, cardDb)) {
    return err("R5.1: a legal play remains; play the maximum legal cards before discarding.");
  }

  const next = cloneState(state);
  const nextActive = playerById(next, next.activePlayerId);
  const nextInst = cardById(next, action.instanceId);
  removeFromHand(nextActive, action.instanceId);
  nextActive.graveyard.push(action.instanceId);
  nextInst.zone = { zone: "graveyard", ownerId: nextActive.id };
  next.cardPlay.discarded += 1;

  appendLog(next, {
    rule: "R5.1",
    actor: nextActive.id,
    message: `${nextActive.name} discarded ${cardName(nextInst, cardDb)}.`,
    data: { action: "DISCARD_CARD", instanceId: action.instanceId, cardId: nextInst.cardId },
  });
  return ok(next);
}

export function handleEndCardPlay(
  state: GameState,
  _action: EndPhaseAction,
  cardDb: CardDatabase,
): Result<GameState> {
  const active = playerById(state, state.activePlayerId);
  if (state.phase !== "card_play") {
    return err(`R4.1: END_PHASE for Card Play is illegal during ${state.phase}.`);
  }

  const quota = cardPlayQuota(state);
  if (state.cardPlay.played < quota && hasAnyLegalPlay(state, active, cardDb)) {
    return err("R5.1: a legal play remains; play the maximum legal cards before ending Card Play.");
  }
  if (actionsTaken(state) < quota) {
    return err(`R5.1: Card Play requires ${quota} play/discard action(s); ${actionsTaken(state)} done.`);
  }

  const next = cloneState(state);
  appendLog(next, {
    rule: "R5.1",
    actor: active.id,
    message: `${active.name} ended Card Play and advanced to Combat.`,
    data: {
      action: "END_PHASE",
      played: state.cardPlay.played,
      discarded: state.cardPlay.discarded,
    },
  });
  next.phase = "combat";
  return ok(next);
}

function ensureCardPlayActionAllowed(
  state: GameState,
  active: Player,
  instanceId: InstanceId,
): Result<CardInstance> {
  if (state.phase !== "card_play") {
    return err(`R4.1: Card Play actions are illegal during ${state.phase}.`);
  }

  const inst = findCard(state, instanceId);
  if (!inst) return err(`R5.1: no card instance "${instanceId}" exists.`);
  if (inst.ownerId !== active.id || inst.zone.zone !== "hand" || inst.zone.ownerId !== active.id) {
    return err("R5.1: only the active player's hand cards can be played or discarded.");
  }
  if (!active.hand.includes(instanceId)) {
    return err("R5.1: card is not in the active player's hand.");
  }
  return ok(inst);
}

interface PlacementLog {
  rule: "R5.2" | "R5.3" | "R5.4";
  message: string;
}

function placeCard(
  state: GameState,
  active: Player,
  inst: CardInstance,
  def: CardDefinition,
  placement: PlacementRef,
  cardDb: CardDatabase,
): Result<PlacementLog> {
  switch (def.type) {
    case "entity":
      return placeEntity(state, active, inst, def, placement, cardDb);
    case "fortress":
      return placeFortress(state, active, inst, def, placement, cardDb);
    case "item_regular":
    case "item_consumable":
      return placeItem(state, active, inst, def, placement, cardDb);
  }
}

function placeEntity(
  state: GameState,
  active: Player,
  inst: CardInstance,
  def: CardDefinition,
  placement: PlacementRef,
  cardDb: CardDatabase,
): Result<PlacementLog> {
  if (placement.kind === "battlefield") {
    const count = countBattlefieldEntities(state, active.id);
    if (count >= BATTLEFIELD_ENTITY_CAP) {
      return err("R5.3: battlefield capacity is 5 entities per player.");
    }
    const beforeMaxHp = modifiedEntityMaxHp(state, inst, cardDb);
    state.battlefield.push(inst.instanceId);
    inst.zone = { zone: "battlefield", ownerId: active.id };
    adjustEntityHpForMaxHpChange(inst, beforeMaxHp, modifiedEntityMaxHp(state, inst, cardDb));
    return ok({
      rule: "R5.2",
      message: `${active.name} played ${cardName(inst, cardDb)} to the battlefield.`,
    });
  }

  if (placement.kind === "fortress") {
    const fort = findFortress(state, active.id, placement.fortressInstanceId);
    if (!fort) return err("R5.2: entities can only enter one of your fortresses.");
    if (fort.occupantIds.length >= FORTRESS_ENTITY_CAP) {
      return err("R5.3: fortress capacity is 3 entities.");
    }
    const beforeMaxHp = modifiedEntityMaxHp(state, inst, cardDb);
    fort.occupantIds.push(inst.instanceId);
    inst.zone = {
      zone: "fortress",
      ownerId: active.id,
      fortressInstanceId: placement.fortressInstanceId,
    };
    adjustEntityHpForMaxHpChange(inst, beforeMaxHp, modifiedEntityMaxHp(state, inst, cardDb));
    return ok({
      rule: "R5.2",
      message: `${active.name} played ${cardName(inst, cardDb)} into ${cardName(cardById(state, fort.fortressInstanceId), cardDb)}.`,
    });
  }

  void def;
  return err("R5.2: entity cards must be played to the battlefield or one of your fortresses.");
}

function placeFortress(
  state: GameState,
  active: Player,
  inst: CardInstance,
  _def: CardDefinition,
  placement: PlacementRef,
  cardDb: CardDatabase,
): Result<PlacementLog> {
  if (placement.kind !== "suburbs") {
    return err("R5.2: fortress cards must be played to your suburbs.");
  }

  active.suburbs.push({
    ownerId: active.id,
    fortressInstanceId: inst.instanceId,
    occupantIds: [],
  });
  inst.zone = { zone: "suburbs", ownerId: active.id };
  return ok({
    rule: "R5.2",
    message: `${active.name} played ${cardName(inst, cardDb)} to their suburbs.`,
  });
}

function placeItem(
  state: GameState,
  active: Player,
  inst: CardInstance,
  def: CardDefinition,
  placement: PlacementRef,
  cardDb: CardDatabase,
): Result<PlacementLog> {
  if (placement.kind !== "equip") {
    return err("R5.2: item and consumable cards must be equipped to one of your entities.");
  }

  const target = findCard(state, placement.entityInstanceId);
  if (!target || target.ownerId !== active.id || !isEntityInPlay(target)) {
    return err("R5.2: items can only be equipped to one of your entities in play.");
  }
  const targetDef = cardDb[target.cardId];
  if (!targetDef) throw new Error(`placeItem: missing card definition "${target.cardId}"`);
  if (targetDef.type !== "entity") {
    return err("R5.2: items can only be equipped to entities.");
  }
  if (target.equippedItemIds.length >= ENTITY_ITEM_CAP) {
    return err("R5.3: entity item capacity is 3.");
  }

  const beforeMaxHp = modifiedEntityMaxHp(state, target, cardDb);
  target.equippedItemIds.push(inst.instanceId);
  inst.zone = { zone: "equipped", ownerId: active.id, entityInstanceId: target.instanceId };
  adjustEntityHpForMaxHpChange(target, beforeMaxHp, modifiedEntityMaxHp(state, target, cardDb));
  const rule = def.type === "item_consumable" ? "R5.4" : "R5.2";
  return ok({
    rule,
    message: `${active.name} equipped ${cardName(inst, cardDb)} to ${cardName(target, cardDb)}.`,
  });
}

function hasAnyLegalPlay(state: GameState, active: Player, cardDb: CardDatabase): boolean {
  for (const id of active.hand) {
    const inst = findCard(state, id);
    if (!inst) continue;
    const def = cardDb[inst.cardId];
    if (!def) throw new Error(`hasAnyLegalPlay: missing card definition "${inst.cardId}"`);
    if (isAnyPlacementLegal(state, active, def)) return true;
  }
  return false;
}

function isAnyPlacementLegal(state: GameState, active: Player, def: CardDefinition): boolean {
  switch (def.type) {
    case "entity":
      if (countBattlefieldEntities(state, active.id) < BATTLEFIELD_ENTITY_CAP) return true;
      return active.suburbs.some((f) => f.occupantIds.length < FORTRESS_ENTITY_CAP);
    case "fortress":
      return true;
    case "item_regular":
    case "item_consumable":
      return controlledEntitiesInPlay(state, active.id).some(
        (entity) => entity.equippedItemIds.length < ENTITY_ITEM_CAP,
      );
  }
}

function controlledEntitiesInPlay(state: GameState, playerId: string): CardInstance[] {
  const ids = new Set<InstanceId>();
  for (const id of state.battlefield) {
    const inst = cardById(state, id);
    if (inst.ownerId === playerId) ids.add(id);
  }
  for (const player of state.players) {
    for (const fort of player.suburbs) {
      if (fort.ownerId !== playerId) continue;
      for (const id of fort.occupantIds) ids.add(id);
    }
  }
  return [...ids].sort().map((id) => cardById(state, id));
}

function countBattlefieldEntities(state: GameState, playerId: string): number {
  let count = 0;
  for (const id of state.battlefield) {
    if (cardById(state, id).ownerId === playerId) count += 1;
  }
  return count;
}

function isEntityInPlay(inst: CardInstance): boolean {
  return inst.zone.zone === "battlefield" || inst.zone.zone === "fortress";
}

function removeFromHand(player: Player, instanceId: InstanceId): void {
  player.hand = player.hand.filter((id) => id !== instanceId);
}

function cardPlayQuota(state: GameState): number {
  return Math.min(CARD_PLAY_LIMIT, state.cardPlay.startedWith);
}

function actionsTaken(state: GameState): number {
  return state.cardPlay.played + state.cardPlay.discarded;
}

function cardName(inst: CardInstance, cardDb: CardDatabase): string {
  return cardDb[inst.cardId]?.name ?? inst.cardId;
}

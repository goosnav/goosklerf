/**
 * Movement phase reducer handlers.
 *
 * Covers R8.1-R8.2:
 *   - owned entities can move battlefield -> own fortress
 *   - owned entities can move own fortress -> battlefield
 *   - owned entities can move own fortress -> another own fortress
 *   - battlefield and fortress capacity limits are enforced after the move
 *
 * Items remain attached to their entity because equipment is modeled on the
 * entity itself (`equippedItemIds`) and item cards stay in the `equipped`
 * zone. Fortress stat buffs are recalculated immediately after zone changes
 * so current HP follows R3.10.
 */

import type { CardDatabase } from "@gk/cards";
import type { Action, MovementDestinationRef } from "../actions.js";
import { cardById, cloneState, findCard, findFortress, playerById } from "../helpers.js";
import { appendLog } from "../log.js";
import { err, ok, type Result } from "../result.js";
import type { CardInstance, GameState, Player } from "../state.js";
import { adjustEntityHpForMaxHpChange, modifiedEntityMaxHp } from "../stats.js";

const BATTLEFIELD_ENTITY_CAP = 5;
const FORTRESS_ENTITY_CAP = 3;

type MoveAction = Extract<Action, { kind: "MOVE_ENTITY" }>;
type EndPhaseAction = Extract<Action, { kind: "END_PHASE" }>;

export function handleMoveEntity(
  state: GameState,
  action: MoveAction,
  cardDb: CardDatabase,
): Result<GameState> {
  if (state.phase !== "movement") {
    return err(`R4.1: Movement actions are illegal during ${state.phase}.`);
  }
  if (state.engagement) {
    return err("R8.1: cannot move entities while an engagement is active.");
  }

  const active = playerById(state, state.activePlayerId);
  const entity = findCard(state, action.entityInstanceId);
  if (!entity) return err(`R8.1: no entity "${action.entityInstanceId}" exists.`);
  const def = cardDb[entity.cardId];
  if (def?.type !== "entity") return err("R8.1: only entity cards can move during Movement.");
  if (entity.ownerId !== active.id) {
    return err("R8.1: only the active player's own entities can move.");
  }
  if (entity.zone.zone !== "battlefield" && entity.zone.zone !== "fortress") {
    return err("R8.1: only entities on the battlefield or inside a fortress can move.");
  }
  if (entity.zone.zone === "fortress" && entity.zone.ownerId !== active.id) {
    return err("R8.1: an entity can only move out of one of the active player's fortresses.");
  }

  const destination = validateDestination(state, active, entity, action.destination);
  if (!destination.ok) return destination;

  const next = cloneState(state);
  const nextActive = playerById(next, active.id);
  const nextEntity = cardById(next, action.entityInstanceId);
  const before = describeEntityLocation(next, nextEntity, cardDb);
  const beforeMaxHp = modifiedEntityMaxHp(next, nextEntity, cardDb);

  removeFromCurrentZone(next, nextActive, nextEntity);
  placeInDestination(next, nextActive, nextEntity, action.destination);
  adjustEntityHpForMaxHpChange(nextEntity, beforeMaxHp, modifiedEntityMaxHp(next, nextEntity, cardDb));

  const after = describeEntityLocation(next, nextEntity, cardDb);
  appendLog(next, {
    rule: "R8.1",
    actor: nextActive.id,
    message: `${nextActive.name} moved ${cardName(nextEntity, cardDb)} from ${before} to ${after}.`,
    data: {
      action: "MOVE_ENTITY",
      entityInstanceId: nextEntity.instanceId,
      from: before,
      to: action.destination,
      beforeMaxHp,
      afterMaxHp: modifiedEntityMaxHp(next, nextEntity, cardDb),
    },
  });
  return ok(next);
}

export function handleEndMovement(
  state: GameState,
  _action: EndPhaseAction,
  _cardDb: CardDatabase,
): Result<GameState> {
  if (state.phase !== "movement") {
    return err(`R4.1: END_PHASE for Movement is illegal during ${state.phase}.`);
  }
  const next = cloneState(state);
  const active = playerById(next, next.activePlayerId);
  appendLog(next, {
    rule: "R8.1",
    actor: active.id,
    message: `${active.name} ended Movement and advanced to Card Draw.`,
    data: { action: "END_PHASE", fromPhase: "movement", toPhase: "card_draw" },
  });
  next.phase = "card_draw";
  return ok(next);
}

function validateDestination(
  state: GameState,
  active: Player,
  entity: CardInstance,
  destination: MovementDestinationRef,
): Result<true> {
  if (destination.kind === "battlefield") {
    if (entity.zone.zone === "battlefield") {
      return err("R8.1: entity is already on the battlefield.");
    }
    if (countBattlefieldEntities(state, active.id) >= BATTLEFIELD_ENTITY_CAP) {
      return err("R2.7: battlefield capacity is 5 entities per player.");
    }
    return ok(true);
  }

  const fort = findFortress(state, active.id, destination.fortressInstanceId);
  if (!fort) {
    return err("R8.1: entities can only move into a fortress controlled by the active player.");
  }
  if (
    entity.zone.zone === "fortress" &&
    entity.zone.fortressInstanceId === destination.fortressInstanceId
  ) {
    return err("R8.1: entity is already in that fortress.");
  }
  if (fort.occupantIds.length >= FORTRESS_ENTITY_CAP) {
    return err("R2.7: fortress capacity is 3 entities.");
  }
  return ok(true);
}

function removeFromCurrentZone(state: GameState, active: Player, entity: CardInstance): void {
  if (entity.zone.zone === "battlefield") {
    state.battlefield = state.battlefield.filter((id) => id !== entity.instanceId);
    return;
  }
  if (entity.zone.zone !== "fortress") {
    throw new Error(`removeFromCurrentZone: entity "${entity.instanceId}" is in ${entity.zone.zone}`);
  }

  const fort = findFortress(state, active.id, entity.zone.fortressInstanceId);
  if (!fort) {
    throw new Error(`removeFromCurrentZone: no active-player fortress "${entity.zone.fortressInstanceId}"`);
  }
  fort.occupantIds = fort.occupantIds.filter((id) => id !== entity.instanceId);
}

function placeInDestination(
  state: GameState,
  active: Player,
  entity: CardInstance,
  destination: MovementDestinationRef,
): void {
  if (destination.kind === "battlefield") {
    state.battlefield.push(entity.instanceId);
    entity.zone = { zone: "battlefield", ownerId: active.id };
    return;
  }

  const fort = findFortress(state, active.id, destination.fortressInstanceId);
  if (!fort) {
    throw new Error(`placeInDestination: no active-player fortress "${destination.fortressInstanceId}"`);
  }
  fort.occupantIds.push(entity.instanceId);
  entity.zone = {
    zone: "fortress",
    ownerId: active.id,
    fortressInstanceId: destination.fortressInstanceId,
  };
}

function countBattlefieldEntities(state: GameState, ownerId: string): number {
  return state.battlefield.filter((id) => cardById(state, id).ownerId === ownerId).length;
}

function describeEntityLocation(
  state: GameState,
  entity: CardInstance,
  cardDb: CardDatabase,
): string {
  if (entity.zone.zone === "battlefield") return "the battlefield";
  if (entity.zone.zone === "fortress") {
    const fort = cardById(state, entity.zone.fortressInstanceId);
    return cardName(fort, cardDb);
  }
  return entity.zone.zone;
}

function cardName(inst: CardInstance, cardDb: CardDatabase): string {
  return cardDb[inst.cardId]?.name ?? inst.cardId;
}

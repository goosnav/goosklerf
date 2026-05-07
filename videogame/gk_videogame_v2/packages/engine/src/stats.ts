/**
 * Runtime stat helpers.
 *
 * Card definitions hold printed stats. CardInstance.hp holds the damageable
 * current HP in this specific game. Everything else here is derived from live
 * state: equipped items (R2.4) and containing-fortress buffs (R3.10).
 *
 * Keep this module pure except for the explicit HP adjustment helpers at the
 * bottom. Reducers call those helpers immediately after a buff source appears
 * or disappears so CardInstance.hp stays aligned with the current max HP.
 */

import type { CardDatabase, CardDefinition } from "@gk/cards";
import type { CardInstance, GameState } from "./state.js";

export interface EntityStats {
  printedAttack: number;
  itemAttackBuff: number;
  fortressAttackBuff: number;
  modifiedAttack: number;
  printedMaxHp: number;
  itemHpBuff: number;
  fortressHpBuff: number;
  modifiedMaxHp: number;
}

/**
 * Full stat breakdown for one entity in its current zone.
 *
 * Consumers that only need a number should prefer `modifiedEntityAttack` or
 * `modifiedEntityMaxHp`; renderers use the breakdown to show where a buff came
 * from without duplicating rule math.
 */
export function entityStats(
  state: GameState,
  entity: CardInstance,
  cardDb: CardDatabase,
): EntityStats {
  const def = cardDb[entity.cardId];
  const printedAttack = def?.baseAttack ?? 0;
  const printedMaxHp = def?.baseHp ?? 0;

  let itemAttackBuff = 0;
  let itemHpBuff = 0;
  for (const itemId of entity.equippedItemIds) {
    const item = state.cardsByInstanceId[itemId];
    if (!item) continue;
    // Ignore stale IDs if a future reducer bug leaves an item listed but not
    // actually equipped to this entity.
    if (item.zone.zone !== "equipped" || item.zone.entityInstanceId !== entity.instanceId) continue;
    const itemDef = cardDb[item.cardId];
    itemAttackBuff += itemDef?.attackBuff ?? 0;
    itemHpBuff += itemDef?.hpBuff ?? 0;
  }

  const fortressDef = containingFortressDefinition(state, entity, cardDb);
  const fortressAttackBuff = fortressDef?.attackBuff ?? 0;
  const fortressHpBuff = fortressDef?.hpBuff ?? 0;

  return {
    printedAttack,
    itemAttackBuff,
    fortressAttackBuff,
    modifiedAttack: clampAttack(printedAttack + itemAttackBuff + fortressAttackBuff),
    printedMaxHp,
    itemHpBuff,
    fortressHpBuff,
    modifiedMaxHp: clampEntityHp(printedMaxHp + itemHpBuff + fortressHpBuff),
  };
}

/** R6.5 — target number for a normal attack after live buffs/debuffs. */
export function modifiedEntityAttack(
  state: GameState,
  entity: CardInstance,
  cardDb: CardDatabase,
): number {
  return entityStats(state, entity, cardDb).modifiedAttack;
}

/** R2.4 / R3.10 — current max HP after live item and fortress buffs. */
export function modifiedEntityMaxHp(
  state: GameState,
  entity: CardInstance,
  cardDb: CardDatabase,
): number {
  return entityStats(state, entity, cardDb).modifiedMaxHp;
}

/**
 * Apply the current-HP side effect of gaining or losing HP capacity.
 *
 * Positive max-HP deltas grant that many current HP immediately. This models
 * cards like GLOVE SOCKS: a 1 HP entity equipped with +2 HP becomes 3 current
 * HP and can survive a single hit. Negative deltas only clamp current HP down
 * to the new max; they do not deal extra damage beyond removing the buff.
 */
export function adjustEntityHpForMaxHpChange(
  entity: CardInstance,
  beforeMaxHp: number,
  afterMaxHp: number,
): void {
  const delta = afterMaxHp - beforeMaxHp;
  if (delta > 0) {
    entity.hp = Math.min(afterMaxHp, entity.hp + delta);
  } else {
    entity.hp = Math.min(entity.hp, afterMaxHp);
  }
  entity.hp = clampEntityHp(entity.hp);
}

/** Clamp current HP after a zone move or item loss removes a buff source. */
export function clampEntityCurrentHpToModifiedMax(
  state: GameState,
  entity: CardInstance,
  cardDb: CardDatabase,
): void {
  entity.hp = Math.min(clampEntityHp(entity.hp), modifiedEntityMaxHp(state, entity, cardDb));
}

function containingFortressDefinition(
  state: GameState,
  entity: CardInstance,
  cardDb: CardDatabase,
): CardDefinition | null {
  if (entity.zone.zone !== "fortress") return null;
  const fortInst = state.cardsByInstanceId[entity.zone.fortressInstanceId];
  if (!fortInst) return null;
  return cardDb[fortInst.cardId] ?? null;
}

function clampAttack(n: number): number {
  // R2.6: Attack is clamped to [1, 5]. A debuff cannot reduce an entity below
  // the minimum attack threshold unless a future card-special handler says so.
  if (n > 5) return 5;
  if (n < 1) return 1;
  return n;
}

function clampEntityHp(n: number): number {
  // R2.6: HP per die is [0, 6]. Super-entity multi-die HP is not modeled yet;
  // when it lands, this helper is the central place to widen that cap.
  if (n > 6) return 6;
  if (n < 0) return 0;
  return n;
}

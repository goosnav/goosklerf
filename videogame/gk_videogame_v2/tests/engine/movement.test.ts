/**
 * Movement reducer tests.
 *
 * Covers Sprint 8:
 *   R8.1 — legal Movement destinations and ownership checks
 *   R8.2 — end-of-Movement positions are the live board positions
 *   R2.7 — battlefield / fortress capacity remains enforced
 *   R3.8 — items stay attached to a moved entity
 *   R3.10 — fortress HP buffs apply or disappear immediately on movement
 */

import { describe, expect, it } from "vitest";
import type { CardDatabase } from "@gk/cards";
import {
  entityStats,
  reduce,
  type CardInstance,
  type Fortress,
  type GameState,
  type InstanceId,
  type LandlordStatus,
  type Player,
  type ZoneRef,
} from "@gk/engine";

const DB: CardDatabase = {
  entity: {
    id: "entity",
    name: "TEST ENTITY",
    filename: "",
    type: "entity",
    rarity: "normal",
    baseAttack: 3,
    baseHp: 2,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  fortress: {
    id: "fortress",
    name: "TEST FORTRESS",
    filename: "",
    type: "fortress",
    rarity: "normal",
    fortressHp: 4,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  hp_fortress: {
    id: "hp_fortress",
    name: "TEST HP FORTRESS",
    filename: "",
    type: "fortress",
    rarity: "normal",
    fortressHp: 4,
    hpBuff: 2,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  item_regular: {
    id: "item_regular",
    name: "TEST ITEM",
    filename: "",
    type: "item_regular",
    rarity: "normal",
    attackBuff: 1,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
};

const noLandlord: LandlordStatus = { pending: false, roundsRemaining: 0 };

function inst(
  instanceId: InstanceId,
  cardId: keyof typeof DB,
  zone: ZoneRef,
  ownerId = zone.ownerId,
): CardInstance {
  const def = DB[cardId]!;
  const hp =
    def.type === "entity" ? def.baseHp ?? 0 :
    def.type === "fortress" ? def.fortressHp ?? 0 :
    0;
  return {
    instanceId,
    cardId,
    ownerId,
    zone,
    hp,
    equippedItemIds: [],
    consumed: false,
  };
}

function player(id: string, suburbs: Fortress[] = []): Player {
  return {
    id,
    name: id === "p1" ? "Player 1" : "Player 2",
    kind: id === "p1" ? "human" : "ai",
    personality: id === "p1" ? null : "butcher",
    hand: [],
    deck: [],
    graveyard: [],
    suburbs,
    shop: [],
    oldAgeCounter: 0,
    landlord: noLandlord,
    declaredEngagementThisTurn: false,
  };
}

interface FixtureOptions {
  extraCards?: CardInstance[];
  battlefield?: InstanceId[];
  p1Suburbs?: Fortress[];
  p2Suburbs?: Fortress[];
  phase?: GameState["phase"];
}

function fixture(opts: FixtureOptions = {}): GameState {
  const cardsByInstanceId: Record<InstanceId, CardInstance> = {};
  for (const card of opts.extraCards ?? []) cardsByInstanceId[card.instanceId] = card;

  return {
    seed: "movement-fixture",
    rngState: { seed: "movement-fixture", callCount: 0 },
    deckSize: "medium",
    players: [player("p1", opts.p1Suburbs ?? []), player("p2", opts.p2Suburbs ?? [])],
    activePlayerId: "p1",
    phase: opts.phase ?? "movement",
    cardPlay: { startedWith: 0, played: 0, discarded: 0 },
    turnNumber: 1,
    cardsByInstanceId,
    battlefield: opts.battlefield ?? [],
    engagement: null,
    log: [],
    outcome: null,
  };
}

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function expectErr(
  result: { ok: true; value: GameState } | { ok: false; error: string },
  requirement: string,
): string {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected reducer error");
  expect(result.error).toContain(requirement);
  return result.error;
}

describe("MOVE_ENTITY", () => {
  it("R8.1 — moves a battlefield entity into the active player's fortress", () => {
    const fort = inst("f1", "fortress", { zone: "suburbs", ownerId: "p1" });
    const entity = inst("e1", "entity", { zone: "battlefield", ownerId: "p1" });
    entity.equippedItemIds = ["i1"];
    const item = inst("i1", "item_regular", { zone: "equipped", ownerId: "p1", entityInstanceId: "e1" });
    const state = fixture({
      extraCards: [fort, entity, item],
      battlefield: ["e1"],
      p1Suburbs: [{ ownerId: "p1", fortressInstanceId: "f1", occupantIds: [] }],
    });

    const next = expectOk(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e1", destination: { kind: "fortress", fortressInstanceId: "f1" } },
      { cardDatabase: DB },
    ));

    expect(next.battlefield).toEqual([]);
    expect(next.players[0]!.suburbs[0]!.occupantIds).toEqual(["e1"]);
    expect(next.cardsByInstanceId["e1"]!.zone).toEqual({ zone: "fortress", ownerId: "p1", fortressInstanceId: "f1" });
    expect(next.cardsByInstanceId["e1"]!.equippedItemIds).toEqual(["i1"]);
    expect(next.cardsByInstanceId["i1"]!.zone).toEqual({ zone: "equipped", ownerId: "p1", entityInstanceId: "e1" });
    expect(next.log.at(-1)?.rule).toBe("R8.1");
  });

  it("R8.1 — moves a fortress occupant back to the battlefield", () => {
    const fort = inst("f1", "fortress", { zone: "suburbs", ownerId: "p1" });
    const entity = inst("e1", "entity", { zone: "fortress", ownerId: "p1", fortressInstanceId: "f1" });
    const state = fixture({
      extraCards: [fort, entity],
      p1Suburbs: [{ ownerId: "p1", fortressInstanceId: "f1", occupantIds: ["e1"] }],
    });

    const next = expectOk(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e1", destination: { kind: "battlefield" } },
      { cardDatabase: DB },
    ));

    expect(next.battlefield).toEqual(["e1"]);
    expect(next.players[0]!.suburbs[0]!.occupantIds).toEqual([]);
    expect(next.cardsByInstanceId["e1"]!.zone).toEqual({ zone: "battlefield", ownerId: "p1" });
  });

  it("R8.1 — moves an entity from one owned fortress into another", () => {
    const f1 = inst("f1", "fortress", { zone: "suburbs", ownerId: "p1" });
    const f2 = inst("f2", "fortress", { zone: "suburbs", ownerId: "p1" });
    const entity = inst("e1", "entity", { zone: "fortress", ownerId: "p1", fortressInstanceId: "f1" });
    const state = fixture({
      extraCards: [f1, f2, entity],
      p1Suburbs: [
        { ownerId: "p1", fortressInstanceId: "f1", occupantIds: ["e1"] },
        { ownerId: "p1", fortressInstanceId: "f2", occupantIds: [] },
      ],
    });

    const next = expectOk(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e1", destination: { kind: "fortress", fortressInstanceId: "f2" } },
      { cardDatabase: DB },
    ));

    expect(next.players[0]!.suburbs[0]!.occupantIds).toEqual([]);
    expect(next.players[0]!.suburbs[1]!.occupantIds).toEqual(["e1"]);
    expect(next.cardsByInstanceId["e1"]!.zone).toEqual({ zone: "fortress", ownerId: "p1", fortressInstanceId: "f2" });
  });

  it("R2.7 — rejects moving out when the active player's battlefield is full", () => {
    const fort = inst("f1", "fortress", { zone: "suburbs", ownerId: "p1" });
    const occupant = inst("e0", "entity", { zone: "fortress", ownerId: "p1", fortressInstanceId: "f1" });
    const field = Array.from({ length: 5 }, (_, i) =>
      inst(`e${i + 1}`, "entity", { zone: "battlefield", ownerId: "p1" }),
    );
    const state = fixture({
      extraCards: [fort, occupant, ...field],
      battlefield: field.map((c) => c.instanceId),
      p1Suburbs: [{ ownerId: "p1", fortressInstanceId: "f1", occupantIds: ["e0"] }],
    });

    expectErr(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e0", destination: { kind: "battlefield" } },
      { cardDatabase: DB },
    ), "R2.7");
  });

  it("R2.7 — rejects moving into a full fortress", () => {
    const fort = inst("f1", "fortress", { zone: "suburbs", ownerId: "p1" });
    const mover = inst("e0", "entity", { zone: "battlefield", ownerId: "p1" });
    const occupants = ["e1", "e2", "e3"].map((id) =>
      inst(id, "entity", { zone: "fortress", ownerId: "p1", fortressInstanceId: "f1" }),
    );
    const state = fixture({
      extraCards: [fort, mover, ...occupants],
      battlefield: ["e0"],
      p1Suburbs: [{ ownerId: "p1", fortressInstanceId: "f1", occupantIds: ["e1", "e2", "e3"] }],
    });

    expectErr(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e0", destination: { kind: "fortress", fortressInstanceId: "f1" } },
      { cardDatabase: DB },
    ), "R2.7");
  });

  it("R3.10 — entering and leaving an HP-buff fortress updates current and max HP immediately", () => {
    const fort = inst("f1", "hp_fortress", { zone: "suburbs", ownerId: "p1" });
    const entity = inst("e1", "entity", { zone: "battlefield", ownerId: "p1" });
    let state = fixture({
      extraCards: [fort, entity],
      battlefield: ["e1"],
      p1Suburbs: [{ ownerId: "p1", fortressInstanceId: "f1", occupantIds: [] }],
    });

    state = expectOk(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e1", destination: { kind: "fortress", fortressInstanceId: "f1" } },
      { cardDatabase: DB },
    ));
    let moved = state.cardsByInstanceId["e1"]!;
    expect(moved.hp).toBe(4);
    expect(entityStats(state, moved, DB).modifiedMaxHp).toBe(4);

    state = expectOk(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e1", destination: { kind: "battlefield" } },
      { cardDatabase: DB },
    ));
    moved = state.cardsByInstanceId["e1"]!;
    expect(moved.hp).toBe(2);
    expect(entityStats(state, moved, DB).modifiedMaxHp).toBe(2);
  });

  it("R8.1 — rejects movement of enemy entities or movement into enemy fortresses", () => {
    const enemyEntity = inst("e2", "entity", { zone: "battlefield", ownerId: "p2" }, "p2");
    const enemyFort = inst("f2", "fortress", { zone: "suburbs", ownerId: "p2" }, "p2");
    const ownEntity = inst("e1", "entity", { zone: "battlefield", ownerId: "p1" });
    const state = fixture({
      extraCards: [enemyEntity, enemyFort, ownEntity],
      battlefield: ["e2", "e1"],
      p2Suburbs: [{ ownerId: "p2", fortressInstanceId: "f2", occupantIds: [] }],
    });

    expectErr(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e2", destination: { kind: "battlefield" } },
      { cardDatabase: DB },
    ), "R8.1");
    expectErr(reduce(
      state,
      { kind: "MOVE_ENTITY", entityInstanceId: "e1", destination: { kind: "fortress", fortressInstanceId: "f2" } },
      { cardDatabase: DB },
    ), "R8.1");
  });

  it("R4.1 / R8.1 — rejects outside Movement and advances to Card Draw when Movement ends", () => {
    const entity = inst("e1", "entity", { zone: "battlefield", ownerId: "p1" });
    const combatState = fixture({ extraCards: [entity], battlefield: ["e1"], phase: "combat" });
    expectErr(reduce(
      combatState,
      { kind: "MOVE_ENTITY", entityInstanceId: "e1", destination: { kind: "battlefield" } },
      { cardDatabase: DB },
    ), "R4.1");

    const ended = expectOk(reduce(fixture(), { kind: "END_PHASE" }, { cardDatabase: DB }));
    expect(ended.phase).toBe("card_draw");
    expect(ended.log.at(-1)?.rule).toBe("R8.1");
  });
});

/**
 * Card Play reducer tests.
 *
 * Covers R5.1-R5.4: quota enforcement, legal placement, capacity, and
 * consumable equip timing.
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
  hp_item_regular: {
    id: "hp_item_regular",
    name: "TEST HP ITEM",
    filename: "",
    type: "item_regular",
    rarity: "normal",
    hpBuff: 2,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  item_consumable: {
    id: "item_consumable",
    name: "TEST CONSUMABLE",
    filename: "",
    type: "item_consumable",
    rarity: "normal",
    hpBuff: 1,
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
};

const noLandlord: LandlordStatus = { pending: false, roundsRemaining: 0 };

function inst(
  instanceId: InstanceId,
  cardId: keyof typeof DB,
  zone: ZoneRef = { zone: "hand", ownerId: "p1" },
  ownerId = "p1",
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

function player(id: string, hand: InstanceId[] = [], suburbs: Fortress[] = []): Player {
  return {
    id,
    name: id === "p1" ? "Player 1" : "Player 2",
    kind: id === "p1" ? "human" : "ai",
    personality: id === "p1" ? null : "butcher",
    hand,
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
  hand?: CardInstance[];
  extraCards?: CardInstance[];
  battlefield?: InstanceId[];
  suburbs?: Fortress[];
  phase?: GameState["phase"];
  cardPlay?: Partial<GameState["cardPlay"]>;
}

function fixture(opts: FixtureOptions = {}): GameState {
  const hand = opts.hand ?? [];
  const extraCards = opts.extraCards ?? [];
  const cards = [...hand, ...extraCards];
  const cardsByInstanceId: Record<InstanceId, CardInstance> = {};
  for (const card of cards) cardsByInstanceId[card.instanceId] = card;

  const p1 = player("p1", hand.map((c) => c.instanceId), opts.suburbs ?? []);
  const p2 = player("p2");
  const startedWith = opts.cardPlay?.startedWith ?? hand.length;

  return {
    seed: "card-play-fixture",
    rngState: { seed: "card-play-fixture", callCount: 0 },
    deckSize: "medium",
    players: [p1, p2],
    activePlayerId: "p1",
    phase: opts.phase ?? "card_play",
    cardPlay: {
      startedWith,
      played: opts.cardPlay?.played ?? 0,
      discarded: opts.cardPlay?.discarded ?? 0,
    },
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

describe("PLAY_CARD", () => {
  it("R5.2 — plays an entity from hand to the battlefield", () => {
    const state = fixture({ hand: [inst("h1", "entity")] });

    const next = expectOk(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "h1", placement: { kind: "battlefield" } },
      { cardDatabase: DB },
    ));

    expect(next.players[0]!.hand).toEqual([]);
    expect(next.battlefield).toEqual(["h1"]);
    expect(next.cardsByInstanceId["h1"]!.zone).toEqual({ zone: "battlefield", ownerId: "p1" });
    expect(next.cardPlay.played).toBe(1);
    expect(next.log.at(-1)?.rule).toBe("R5.2");
    expect(state.players[0]!.hand).toEqual(["h1"]);
  });

  it("R5.2 — plays a fortress card to the active player's suburbs", () => {
    const state = fixture({ hand: [inst("f1", "fortress")] });

    const next = expectOk(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "f1", placement: { kind: "suburbs" } },
      { cardDatabase: DB },
    ));

    expect(next.players[0]!.suburbs).toEqual([
      { ownerId: "p1", fortressInstanceId: "f1", occupantIds: [] },
    ]);
    expect(next.cardsByInstanceId["f1"]!.zone).toEqual({ zone: "suburbs", ownerId: "p1" });
  });

  it("R5.2 / R5.4 — equips regular items and consumables without resolving consumables", () => {
    const target = inst("e1", "entity", { zone: "battlefield", ownerId: "p1" });
    let state = fixture({
      hand: [inst("i1", "item_regular"), inst("c1", "item_consumable")],
      extraCards: [target],
      battlefield: ["e1"],
    });

    state = expectOk(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "i1", placement: { kind: "equip", entityInstanceId: "e1" } },
      { cardDatabase: DB },
    ));
    state = expectOk(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "c1", placement: { kind: "equip", entityInstanceId: "e1" } },
      { cardDatabase: DB },
    ));

    expect(state.cardsByInstanceId["e1"]!.equippedItemIds).toEqual(["i1", "c1"]);
    expect(state.cardsByInstanceId["i1"]!.zone).toEqual({ zone: "equipped", ownerId: "p1", entityInstanceId: "e1" });
    expect(state.cardsByInstanceId["c1"]!.zone).toEqual({ zone: "equipped", ownerId: "p1", entityInstanceId: "e1" });
    expect(state.cardsByInstanceId["c1"]!.consumed).toBe(false);
    expect(state.cardPlay.played).toBe(2);
    expect(state.log.at(-1)?.rule).toBe("R5.4");
  });

  it("R2.4 — equipping an HP item raises current HP and modified max HP", () => {
    const target = inst("e1", "entity", { zone: "battlefield", ownerId: "p1" });
    const state = fixture({
      hand: [inst("i1", "hp_item_regular")],
      extraCards: [target],
      battlefield: ["e1"],
    });

    const next = expectOk(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "i1", placement: { kind: "equip", entityInstanceId: "e1" } },
      { cardDatabase: DB },
    ));

    const entity = next.cardsByInstanceId["e1"]!;
    const stats = entityStats(next, entity, DB);
    expect(stats.itemHpBuff).toBe(2);
    expect(stats.modifiedMaxHp).toBe(4);
    expect(entity.hp).toBe(4);
  });

  it("R3.10 — playing an entity into an HP-buff fortress raises current HP", () => {
    const fortCard = inst("f1", "hp_fortress", { zone: "suburbs", ownerId: "p1" });
    const state = fixture({
      hand: [inst("h1", "entity")],
      extraCards: [fortCard],
      suburbs: [{ ownerId: "p1", fortressInstanceId: "f1", occupantIds: [] }],
    });

    const next = expectOk(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "h1", placement: { kind: "fortress", fortressInstanceId: "f1" } },
      { cardDatabase: DB },
    ));

    const entity = next.cardsByInstanceId["h1"]!;
    const stats = entityStats(next, entity, DB);
    expect(stats.fortressHpBuff).toBe(2);
    expect(stats.modifiedMaxHp).toBe(4);
    expect(entity.hp).toBe(4);
  });

  it("R5.2 — rejects type-incompatible placements", () => {
    expectErr(reduce(
      fixture({ hand: [inst("h1", "entity")] }),
      { kind: "PLAY_CARD", instanceId: "h1", placement: { kind: "suburbs" } },
      { cardDatabase: DB },
    ), "R5.2");

    expectErr(reduce(
      fixture({ hand: [inst("i1", "item_regular")] }),
      { kind: "PLAY_CARD", instanceId: "i1", placement: { kind: "battlefield" } },
      { cardDatabase: DB },
    ), "R5.2");
  });
});

describe("capacity", () => {
  it("R5.3 — rejects entity play when the active player's battlefield is full", () => {
    const field = Array.from({ length: 5 }, (_, i) =>
      inst(`e${i + 1}`, "entity", { zone: "battlefield", ownerId: "p1" }),
    );
    const state = fixture({
      hand: [inst("h1", "entity")],
      extraCards: field,
      battlefield: field.map((c) => c.instanceId),
    });

    expectErr(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "h1", placement: { kind: "battlefield" } },
      { cardDatabase: DB },
    ), "R5.3");
  });

  it("R5.3 — rejects entity play into a full fortress", () => {
    const fortCard = inst("f1", "fortress", { zone: "suburbs", ownerId: "p1" });
    const occupants = ["o1", "o2", "o3"].map((id) =>
      inst(id, "entity", { zone: "fortress", ownerId: "p1", fortressInstanceId: "f1" }),
    );
    const state = fixture({
      hand: [inst("h1", "entity")],
      extraCards: [fortCard, ...occupants],
      suburbs: [{ ownerId: "p1", fortressInstanceId: "f1", occupantIds: ["o1", "o2", "o3"] }],
    });

    expectErr(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "h1", placement: { kind: "fortress", fortressInstanceId: "f1" } },
      { cardDatabase: DB },
    ), "R5.3");
  });

  it("R5.3 — rejects item play onto an entity with 3 equipped items", () => {
    const target = inst("e1", "entity", { zone: "battlefield", ownerId: "p1" });
    target.equippedItemIds = ["i1", "i2", "i3"];
    const equipped = target.equippedItemIds.map((id) =>
      inst(id, "item_regular", { zone: "equipped", ownerId: "p1", entityInstanceId: "e1" }),
    );
    const state = fixture({
      hand: [inst("h1", "item_regular")],
      extraCards: [target, ...equipped],
      battlefield: ["e1"],
    });

    expectErr(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "h1", placement: { kind: "equip", entityInstanceId: "e1" } },
      { cardDatabase: DB },
    ), "R5.3");
  });
});

describe("Card Play quota", () => {
  it("R5.1 — stops play after 3 played cards and then advances to combat", () => {
    let state = fixture({
      hand: [
        inst("h1", "entity"),
        inst("h2", "entity"),
        inst("h3", "entity"),
        inst("h4", "entity"),
      ],
    });

    for (const id of ["h1", "h2", "h3"] as const) {
      state = expectOk(reduce(
        state,
        { kind: "PLAY_CARD", instanceId: id, placement: { kind: "battlefield" } },
        { cardDatabase: DB },
      ));
    }

    expectErr(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "h4", placement: { kind: "battlefield" } },
      { cardDatabase: DB },
    ), "R5.1");

    const ended = expectOk(reduce(state, { kind: "END_PHASE" }, { cardDatabase: DB }));
    expect(ended.phase).toBe("combat");
    expect(ended.log.at(-1)?.rule).toBe("R5.1");
  });

  it("R5.1 — allows discard only when no legal play remains", () => {
    const legalPlay = fixture({ hand: [inst("h1", "entity")] });
    expectErr(reduce(
      legalPlay,
      { kind: "DISCARD_CARD", instanceId: "h1" },
      { cardDatabase: DB },
    ), "R5.1");

    const noLegalPlay = fixture({ hand: [inst("i1", "item_regular")] });
    const discarded = expectOk(reduce(
      noLegalPlay,
      { kind: "DISCARD_CARD", instanceId: "i1" },
      { cardDatabase: DB },
    ));
    expect(discarded.players[0]!.graveyard).toEqual(["i1"]);
    expect(discarded.cardPlay.discarded).toBe(1);
  });

  it("R5.1 — requires enough play/discard actions before ending Card Play", () => {
    const state = fixture({ hand: [inst("i1", "item_regular"), inst("i2", "item_regular"), inst("i3", "item_regular")] });

    expectErr(reduce(state, { kind: "END_PHASE" }, { cardDatabase: DB }), "R5.1");

    let next = expectOk(reduce(state, { kind: "DISCARD_CARD", instanceId: "i1" }, { cardDatabase: DB }));
    next = expectOk(reduce(next, { kind: "DISCARD_CARD", instanceId: "i2" }, { cardDatabase: DB }));
    next = expectOk(reduce(next, { kind: "DISCARD_CARD", instanceId: "i3" }, { cardDatabase: DB }));

    const ended = expectOk(reduce(next, { kind: "END_PHASE" }, { cardDatabase: DB }));
    expect(ended.phase).toBe("combat");
  });

  it("R5.1 — skips Card Play when the phase starts with an empty hand", () => {
    const state = fixture({ hand: [], cardPlay: { startedWith: 0 } });
    const ended = expectOk(reduce(state, { kind: "END_PHASE" }, { cardDatabase: DB }));
    expect(ended.phase).toBe("combat");
  });

  it("R4.1 — rejects Card Play actions outside the Card Play phase", () => {
    const state = fixture({ hand: [inst("h1", "entity")], phase: "combat" });
    expectErr(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: "h1", placement: { kind: "battlefield" } },
      { cardDatabase: DB },
    ), "R4.1");
  });
});

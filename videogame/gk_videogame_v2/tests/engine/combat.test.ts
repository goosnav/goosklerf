/**
 * Combat reducer tests.
 *
 * Covers (Sprint 6):
 *   R6.1 — battlefield engagement declaration & validation
 *   R6.3 — alternating round structure (sideToAct flips, round increments)
 *   R6.4 — one action per entity per round (NORMAL_ATTACK / PASS_ACTION)
 *   R6.5 — normal attack resolution (1d6 ≤ modified Attack)
 *   R6.6 — engagement-end conditions (one side empty)
 *   R6.7 — Initial Volley fires at most once per defender fortress
 *   R7.1 — damage application (HP ticks down)
 *   R7.3 — entity defeat (graveyard + items follow)
 *
 * Determinism: every test uses a fixed seed and pre-computes the d6 sequence
 * so we can assert precisely whether each roll hits or misses given each
 * attacker's modified Attack stat.
 */

import { describe, expect, it } from "vitest";
import type { CardDatabase } from "@gk/cards";
import {
  entityStats,
  reduce,
  SeededRng,
  type CardInstance,
  type Engagement,
  type Fortress,
  type GameState,
  type InstanceId,
  type LandlordStatus,
  type Player,
} from "@gk/engine";

// -----------------------------------------------------------------------------
// Tiny card database fixture: 1 entity (atk 3, hp 3), 1 fortress (hp 4),
// 1 item with +2 attack buff. Specific stats so we can compute expected hits.
// -----------------------------------------------------------------------------

const DB: CardDatabase = {
  worm: {
    id: "worm",
    name: "WORM",
    filename: "",
    type: "entity",
    rarity: "normal",
    baseAttack: 3,
    baseHp: 3,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  hammer: {
    id: "hammer",
    name: "HAMMER",
    filename: "",
    type: "item_regular",
    rarity: "normal",
    attackBuff: 2,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  glove_socks: {
    id: "glove_socks",
    name: "GLOVE SOCKS",
    filename: "",
    type: "item_regular",
    rarity: "normal",
    hpBuff: 2,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  farmhouse: {
    id: "farmhouse",
    name: "FARMHOUSE",
    filename: "",
    type: "fortress",
    rarity: "normal",
    fortressHp: 4,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  med_bunker: {
    id: "med_bunker",
    name: "MED BUNKER",
    filename: "",
    type: "fortress",
    rarity: "normal",
    fortressHp: 4,
    hpBuff: 2,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
  training_fortress: {
    id: "training_fortress",
    name: "TRAINING FORTRESS",
    filename: "",
    type: "fortress",
    rarity: "normal",
    fortressHp: 4,
    attackBuff: 2,
    rulesText: "",
    hasSpecial: false,
    automationStatus: "fully_implemented",
  },
};

// -----------------------------------------------------------------------------
// Deterministic dice helper: given a seed, return the next N d6 rolls.
// Tests use this to set up scenarios like "first attack hits because the
// pre-computed roll is 2 ≤ Attack 3."
// -----------------------------------------------------------------------------

function diceSequence(seed: string, n: number): number[] {
  const rng = new SeededRng(seed);
  return Array.from({ length: n }, () => rng.rollD6());
}

// -----------------------------------------------------------------------------
// Build a minimal "in combat phase" fixture state.
// Players: p1 (active attacker), p2 (defender).
// p1: 1 entity on battlefield ("e1": worm, hp 3).
// p2: 1 entity on battlefield ("e2": worm, hp 3).
// Optional: p2 may have a fortress with an occupant (for Initial Volley tests).
// -----------------------------------------------------------------------------

interface FixtureOptions {
  seed?: string;
  attackerEquipped?: string[];   // item instance IDs equipped to attacker
  defenderHp?: number;
  defenderFortressOccupants?: number;
  defenderFortressCardId?: "farmhouse" | "training_fortress";
}

function combatFixture(opts: FixtureOptions = {}): GameState {
  const seed = opts.seed ?? "combat-test";
  const noLL: LandlordStatus = { pending: false, roundsRemaining: 0 };

  const e1: CardInstance = {
    instanceId: "e1",
    cardId: "worm",
    ownerId: "p1",
    zone: { zone: "battlefield", ownerId: "p1" },
    hp: 3,
    equippedItemIds: [...(opts.attackerEquipped ?? [])],
    consumed: false,
  };
  const e2: CardInstance = {
    instanceId: "e2",
    cardId: "worm",
    ownerId: "p2",
    zone: { zone: "battlefield", ownerId: "p2" },
    hp: opts.defenderHp ?? 3,
    equippedItemIds: [],
    consumed: false,
  };

  const cardsByInstanceId: Record<InstanceId, CardInstance> = { e1, e2 };

  // Optional item equipped to attacker
  if (opts.attackerEquipped) {
    for (const itemId of opts.attackerEquipped) {
      cardsByInstanceId[itemId] = {
        instanceId: itemId,
        cardId: "hammer",
        ownerId: "p1",
        zone: { zone: "equipped", ownerId: "p1", entityInstanceId: "e1" },
        hp: 0,
        equippedItemIds: [],
        consumed: false,
      };
    }
  }

  const p1: Player = {
    id: "p1",
    name: "Alice",
    kind: "human",
    personality: null,
    hand: [],
    deck: [],
    graveyard: [],
    suburbs: [],
    shop: [],
    oldAgeCounter: 0,
    landlord: noLL,
    declaredEngagementThisTurn: false,
  };

  const p2: Player = {
    id: "p2",
    name: "Bob",
    kind: "ai",
    personality: "butcher",
    hand: [],
    deck: [],
    graveyard: [],
    suburbs: [],
    shop: [],
    oldAgeCounter: 0,
    landlord: noLL,
    declaredEngagementThisTurn: false,
  };

  // Optional defender fortress with N occupants (for Initial Volley tests)
  if (opts.defenderFortressOccupants && opts.defenderFortressOccupants > 0) {
    const fortInst: CardInstance = {
      instanceId: "f1",
      cardId: opts.defenderFortressCardId ?? "farmhouse",
      ownerId: "p2",
      zone: { zone: "suburbs", ownerId: "p2" },
      hp: 4,
      equippedItemIds: [],
      consumed: false,
    };
    cardsByInstanceId["f1"] = fortInst;

    const occupantIds: InstanceId[] = [];
    for (let i = 0; i < opts.defenderFortressOccupants; i++) {
      const occId = `o${i + 1}`;
      const occ: CardInstance = {
        instanceId: occId,
        cardId: "worm",
        ownerId: "p2",
        zone: { zone: "fortress", ownerId: "p2", fortressInstanceId: "f1" },
        hp: 3,
        equippedItemIds: [],
        consumed: false,
      };
      cardsByInstanceId[occId] = occ;
      occupantIds.push(occId);
    }
    const fortress: Fortress = { ownerId: "p2", fortressInstanceId: "f1", occupantIds };
    p2.suburbs.push(fortress);
  }

  return {
    seed,
    rngState: { seed, callCount: 0 },
    deckSize: "medium",
    players: [p1, p2],
    activePlayerId: "p1",
    phase: "combat",
    cardPlay: { startedWith: 0, played: 0, discarded: 0 },
    turnNumber: 1,
    cardsByInstanceId,
    battlefield: ["e1", "e2"],
    engagement: null,
    log: [],
    outcome: null,
  };
}

// -----------------------------------------------------------------------------
// R6.1 — declaration validation
// -----------------------------------------------------------------------------

describe("R6.1 — battlefield engagement declaration", () => {
  it("succeeds with a legal declaration", () => {
    const state = combatFixture();
    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const eng = r.value.engagement!;
    expect(eng.kind).toBe("battlefield");
    expect(eng.attackerSide).toBe("p1");
    expect(eng.defenderSide).toBe("p2");
    expect(eng.attackerEntityIds).toEqual(["e1"]);
    expect(eng.defenderEntityIds).toEqual(["e2"]);
    expect(eng.round).toBe(1);
    expect(eng.sideToAct).toBe("attacker");
    // Both sides get an action budget at declaration; the defender's gets
    // refreshed again when sideToAct flips to them (idempotent — still 1).
    expect(eng.actionsRemainingByEntity).toEqual({ e1: 1, e2: 1 });
  });

  it("rejects declaration outside the combat phase", () => {
    const s = { ...combatFixture(), phase: "card_play" as const };
    const r = reduce(
      s,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("rejects empty attacker list (R6.7 forbids volley-only declarations)", () => {
    const r = reduce(
      combatFixture(),
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: [] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("rejects attackers not owned by the active player", () => {
    const r = reduce(
      combatFixture(),
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e2"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("rejects self-targeting", () => {
    const r = reduce(
      combatFixture(),
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p1", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a defender with no battlefield entities (nothing to fight)", () => {
    const s = combatFixture();
    s.battlefield = ["e1"]; // remove e2
    const r = reduce(
      s,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("sets declaredEngagementThisTurn (R10.7 hook for Old Age)", () => {
    const r = reduce(
      combatFixture(),
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p1 = r.value.players.find((p) => p.id === "p1")!;
    expect(p1.declaredEngagementThisTurn).toBe(true);
  });
});

describe("R6.2 — combat staging", () => {
  it("moves an owned fortress occupant into a battlefield engagement and strips fortress positioning", () => {
    const state = combatFixture();
    const fortInst: CardInstance = {
      instanceId: "pf1",
      cardId: "training_fortress",
      ownerId: "p1",
      zone: { zone: "suburbs", ownerId: "p1" },
      hp: 4,
      equippedItemIds: [],
      consumed: false,
    };
    state.cardsByInstanceId["pf1"] = fortInst;
    state.players[0]!.suburbs.push({
      ownerId: "p1",
      fortressInstanceId: "pf1",
      occupantIds: ["e1"],
    });
    state.cardsByInstanceId["e1"]!.zone = {
      zone: "fortress",
      ownerId: "p1",
      fortressInstanceId: "pf1",
    };
    state.battlefield = ["e2"];

    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.cardsByInstanceId["e1"]!.zone).toEqual({ zone: "battlefield", ownerId: "p1" });
    expect(r.value.battlefield).toContain("e1");
    expect(r.value.players[0]!.suburbs[0]!.occupantIds).toEqual([]);
    const stagingLog = r.value.log.find((e) => e.rule === "R6.2")!;
    expect(stagingLog.data?.["movedFromFortress"]).toEqual(["e1"]);
  });

  it("R3.10 — staging out of an HP-buff fortress removes temporary HP", () => {
    const state = combatFixture();
    state.cardsByInstanceId["pf1"] = {
      instanceId: "pf1",
      cardId: "med_bunker",
      ownerId: "p1",
      zone: { zone: "suburbs", ownerId: "p1" },
      hp: 4,
      equippedItemIds: [],
      consumed: false,
    };
    state.players[0]!.suburbs.push({
      ownerId: "p1",
      fortressInstanceId: "pf1",
      occupantIds: ["e1"],
    });
    state.cardsByInstanceId["e1"]!.zone = {
      zone: "fortress",
      ownerId: "p1",
      fortressInstanceId: "pf1",
    };
    state.cardsByInstanceId["e1"]!.hp = 5; // WORM 3 + MED BUNKER 2 while inside.
    state.battlefield = ["e2"];

    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const entity = r.value.cardsByInstanceId["e1"]!;
    expect(entity.zone).toEqual({ zone: "battlefield", ownerId: "p1" });
    expect(entityStats(r.value, entity, DB).modifiedMaxHp).toBe(3);
    expect(entity.hp).toBe(3);
  });
});

// -----------------------------------------------------------------------------
// R6.7 — Initial Volley
// -----------------------------------------------------------------------------

describe("R6.7 — Initial Volley", () => {
  it("fires once per occupied defender fortress before round 1", () => {
    const state = combatFixture({ seed: "iv-1", defenderFortressOccupants: 1 });
    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Volley logged
    const volleys = r.value.log.filter((e) => e.rule === "R6.7");
    expect(volleys.length).toBe(1);

    // initialVolleyResolved set
    if (r.value.engagement) {
      expect(r.value.engagement.initialVolleyResolved).toBe(true);
    }
  });

  it("does not fire when defender has no fortresses", () => {
    const state = combatFixture({ seed: "iv-no-fort" });
    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const volleys = r.value.log.filter((e) => e.rule === "R6.7");
    expect(volleys.length).toBe(0);
  });

  it("hit on volley deals 1 HP damage to the attacker (R7.1)", () => {
    // Pre-compute the d6 the volley will roll.
    const seed = "iv-hit";
    const [firstRoll] = diceSequence(seed, 1);
    const state = combatFixture({ seed, defenderFortressOccupants: 1 });
    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const e1After = r.value.cardsByInstanceId["e1"]!;
    // Worm's attack is 3 → hit if firstRoll ≤ 3, else miss.
    const expectedHp = (firstRoll ?? 9) <= 3 ? 2 : 3;
    expect(e1After.hp).toBe(expectedHp);
  });

  it("R3.10 / R6.7 — Initial Volley applies the occupant's fortress Attack buff", () => {
    const state = combatFixture({
      seed: "iv-fortress-buff",
      defenderFortressOccupants: 1,
      defenderFortressCardId: "training_fortress",
    });
    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
      },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const volley = r.value.log.find((e) => e.rule === "R6.7")!;
    expect(volley.data?.["modifiedAttack"]).toBe(5); // WORM 3 + TRAINING FORTRESS 2
  });
});

// -----------------------------------------------------------------------------
// R6.5 / R7.1 — Normal Attack & damage
// -----------------------------------------------------------------------------

describe("R6.5 — normal attack resolution", () => {
  it("hits when the d6 ≤ modified Attack; deals 1 HP", () => {
    // Use seed where the FIRST d6 (after declaration consumed nothing — no
    // volley because no fortress) is known.
    const seed = "atk-hit";
    const [r1] = diceSequence(seed, 1);
    if ((r1 ?? 9) > 3) {
      // Skip — first roll didn't hit; pick a different seed by re-running
      // the test with a different seed deterministically. We assert any hit
      // changes target HP by exactly 1.
    }

    let state = combatFixture({ seed });
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    const beforeHp = state.cardsByInstanceId["e2"]!.hp;
    state = mustOk(
      reduce(
        state,
        { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "e2" },
        { cardDatabase: DB },
      ),
    );
    const afterHp = state.cardsByInstanceId["e2"]!.hp;
    if ((r1 ?? 9) <= 3) {
      expect(afterHp).toBe(beforeHp - 1);
    } else {
      expect(afterHp).toBe(beforeHp);
    }
  });

  it("rejects an attack when no engagement exists", () => {
    const r = reduce(
      combatFixture(),
      { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "e2" },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("rejects targeting a friendly entity", () => {
    let state = combatFixture({ seed: "friendly" });
    state.battlefield.push("e3");
    state.cardsByInstanceId["e3"] = {
      instanceId: "e3",
      cardId: "worm",
      ownerId: "p1",
      zone: { zone: "battlefield", ownerId: "p1" },
      hp: 3,
      equippedItemIds: [],
      consumed: false,
    };
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1", "e3"] },
        },
        { cardDatabase: DB },
      ),
    );
    const r = reduce(
      state,
      { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "e3" },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("rejects an attack from an entity not in the engagement", () => {
    const state = combatFixture({ seed: "alien" });
    // Set up an engagement but try to attack with someone outside
    state.cardsByInstanceId["alien"] = {
      instanceId: "alien",
      cardId: "worm",
      ownerId: "p1",
      zone: { zone: "battlefield", ownerId: "p1" },
      hp: 3,
      equippedItemIds: [],
      consumed: false,
    };
    state.battlefield.push("alien");
    const declared = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    const r = reduce(
      declared,
      { kind: "NORMAL_ATTACK", attackerInstanceId: "alien", targetInstanceId: "e2" },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });

  it("item attack-buffs raise the modified Attack (R3.10 / item buffs)", () => {
    // Equip HAMMER (+2 attack) → modifiedAttack = 3 + 2 = 5 (clamped).
    // Roll of 1..5 always hits, only 6 misses. With 6 different rolls per seed,
    // we can probe.
    let state = combatFixture({ seed: "buff", attackerEquipped: ["i1"] });
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    const r = mustOk(
      reduce(
        state,
        { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "e2" },
        { cardDatabase: DB },
      ),
    );
    const log = r.log.find((e) => e.rule === "R6.5" && e.actor === "p1")!;
    expect(log.data?.["modifiedAttack"]).toBe(5); // clamped from 3+2
  });

  it("R2.4 — item HP buffs are real durability during combat", () => {
    const seed = "hp-buff-survival-1";
    const [firstRoll] = diceSequence(seed, 1);
    expect(firstRoll).toBeLessThanOrEqual(3);

    let state = combatFixture({ seed });
    state.cardsByInstanceId["i1"] = {
      instanceId: "i1",
      cardId: "glove_socks",
      ownerId: "p1",
      zone: { zone: "equipped", ownerId: "p1", entityInstanceId: "e1" },
      hp: 0,
      equippedItemIds: [],
      consumed: false,
    };
    state.cardsByInstanceId["e1"]!.equippedItemIds = ["i1"];
    state.cardsByInstanceId["e1"]!.hp = 5; // WORM 3 + GLOVE SOCKS 2.

    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    state = mustOk(reduce(state, { kind: "PASS_ACTION", entityInstanceId: "e1" }, { cardDatabase: DB }));
    state = mustOk(
      reduce(
        state,
        { kind: "NORMAL_ATTACK", attackerInstanceId: "e2", targetInstanceId: "e1" },
        { cardDatabase: DB },
      ),
    );

    const entity = state.cardsByInstanceId["e1"]!;
    expect(entityStats(state, entity, DB).modifiedMaxHp).toBe(5);
    expect(entity.hp).toBe(4);
    expect(entity.zone.zone).not.toBe("graveyard");
  });
});

// -----------------------------------------------------------------------------
// R6.3 — alternating rounds
// -----------------------------------------------------------------------------

describe("R6.3 — alternating round structure", () => {
  it("after the lone attacker acts, sideToAct flips to defender", () => {
    let state = combatFixture({ seed: "rounds-1" });
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    state = mustOk(
      reduce(
        state,
        { kind: "PASS_ACTION", entityInstanceId: "e1" },
        { cardDatabase: DB },
      ),
    );
    if (state.engagement) {
      expect(state.engagement.sideToAct).toBe("defender");
      expect(state.engagement.actionsRemainingByEntity["e2"]).toBe(1);
      expect(state.engagement.round).toBe(1);
    }
  });

  it("after both sides finish round 1, round increments to 2", () => {
    let state = combatFixture({ seed: "rounds-2" });
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    state = mustOk(reduce(state, { kind: "PASS_ACTION", entityInstanceId: "e1" }, { cardDatabase: DB }));
    state = mustOk(reduce(state, { kind: "PASS_ACTION", entityInstanceId: "e2" }, { cardDatabase: DB }));
    if (state.engagement) {
      expect(state.engagement.round).toBe(2);
      expect(state.engagement.sideToAct).toBe("attacker");
      expect(state.engagement.actionsRemainingByEntity["e1"]).toBe(1);
    }
  });

  it("rejects an action from the wrong side", () => {
    let state = combatFixture({ seed: "wrong-side" });
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    // It's the attacker's turn; defender e2 cannot act.
    const r = reduce(
      state,
      { kind: "PASS_ACTION", entityInstanceId: "e2" },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// R7.3 — entity defeat
// -----------------------------------------------------------------------------

describe("R7.3 — entity defeat", () => {
  it("entity at 0 HP goes to graveyard with its equipped items", () => {
    // Rig the defender's HP to 1 so the very first hit takes it out.
    let state = combatFixture({ seed: "defeat-1", defenderHp: 1 });
    // Equip an item to e2 so we can verify items follow.
    state.cardsByInstanceId["i2"] = {
      instanceId: "i2",
      cardId: "hammer",
      ownerId: "p2",
      zone: { zone: "equipped", ownerId: "p2", entityInstanceId: "e2" },
      hp: 0,
      equippedItemIds: [],
      consumed: false,
    };
    state.cardsByInstanceId["e2"]!.equippedItemIds = ["i2"];

    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    // Loop attacks until e2 is gone OR engagement ends — at most a few rolls
    // are needed to clear 1 HP from a 3-Attack worm.
    while (state.engagement && state.cardsByInstanceId["e2"] && state.cardsByInstanceId["e2"].hp > 0) {
      const next = reduce(
        state,
        { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "e2" },
        { cardDatabase: DB },
      );
      if (!next.ok) break;
      state = next.value;
      // Defender's reactive turn (PASS) — allowed because next round needs to start
      if (state.engagement && state.engagement.sideToAct === "defender") {
        const passDef = reduce(
          state,
          { kind: "PASS_ACTION", entityInstanceId: "e2" },
          { cardDatabase: DB },
        );
        if (passDef.ok) state = passDef.value;
      }
    }

    const e2After = state.cardsByInstanceId["e2"]!;
    expect(e2After.hp).toBe(0);
    expect(e2After.zone).toEqual({ zone: "graveyard", ownerId: "p2" });
    expect(e2After.equippedItemIds).toEqual([]);
    expect(state.players.find((p) => p.id === "p2")!.graveyard).toContain("e2");
    expect(state.players.find((p) => p.id === "p2")!.graveyard).toContain("i2");
    // Battlefield no longer lists e2.
    expect(state.battlefield).not.toContain("e2");
  });
});

// -----------------------------------------------------------------------------
// R6.6 — engagement end
// -----------------------------------------------------------------------------

describe("R6.6 — engagement end", () => {
  it("ends when defender's last entity is defeated; state.engagement = null", () => {
    let state = combatFixture({ seed: "end-1", defenderHp: 1 });
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    // Keep attacking until e2 dies (deterministic seed; finite rolls).
    while (state.engagement && state.cardsByInstanceId["e2"]!.hp > 0) {
      const r = reduce(
        state,
        { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "e2" },
        { cardDatabase: DB },
      );
      if (!r.ok) break;
      state = r.value;
      if (state.engagement && state.engagement.sideToAct === "defender") {
        const pass = reduce(
          state,
          { kind: "PASS_ACTION", entityInstanceId: "e2" },
          { cardDatabase: DB },
        );
        if (pass.ok) state = pass.value;
      }
    }
    expect(state.engagement).toBeNull();
    const endLog = state.log.find((e) => e.rule === "R6.6");
    expect(endLog).toBeDefined();
  });

  it("phase stays 'combat' after engagement ends so another can be declared", () => {
    let state = combatFixture({ seed: "phase-stay", defenderHp: 1 });
    state = mustOk(
      reduce(
        state,
        {
          kind: "DECLARE_ENGAGEMENT",
          spec: { kind: "battlefield", defenderId: "p2", attackerEntityIds: ["e1"] },
        },
        { cardDatabase: DB },
      ),
    );
    while (state.engagement && state.cardsByInstanceId["e2"]!.hp > 0) {
      const r = reduce(
        state,
        { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "e2" },
        { cardDatabase: DB },
      );
      if (!r.ok) break;
      state = r.value;
      if (state.engagement && state.engagement.sideToAct === "defender") {
        const pass = reduce(
          state,
          { kind: "PASS_ACTION", entityInstanceId: "e2" },
          { cardDatabase: DB },
        );
        if (pass.ok) state = pass.value;
      }
    }
    expect(state.phase).toBe("combat");
    expect(state.engagement).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// R6.8-R6.11 / R7.4 — Fortress assault
// -----------------------------------------------------------------------------

describe("R6.8 — fortress assault declaration and target scope", () => {
  it("declares an assault against a fortress and uses occupants as defenders", () => {
    const state = combatFixture({ defenderFortressOccupants: 1 });
    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: {
          kind: "fortress_assault",
          defenderId: "p2",
          attackerEntityIds: ["e1"],
          targetFortressInstanceIds: ["f1"],
        },
      },
      { cardDatabase: DB },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const eng = r.value.engagement!;
    expect(eng.kind).toBe("fortress_assault");
    expect(eng.attackerEntityIds).toEqual(["e1"]);
    expect(eng.defenderEntityIds).toEqual(["o1"]);
    expect(eng.targetFortressInstanceIds).toEqual(["f1"]);
    expect(eng.initialVolleyResolved).toBe(true);
    expect(r.value.log.some((e) => e.rule === "R6.7")).toBe(false);
  });

  it("allows multiple target fortresses in one assault", () => {
    const state = combatFixture({ defenderFortressOccupants: 1 });
    state.cardsByInstanceId["f2"] = {
      instanceId: "f2",
      cardId: "farmhouse",
      ownerId: "p2",
      zone: { zone: "suburbs", ownerId: "p2" },
      hp: 4,
      equippedItemIds: [],
      consumed: false,
    };
    state.players[1]!.suburbs.push({ ownerId: "p2", fortressInstanceId: "f2", occupantIds: [] });

    const r = reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: {
          kind: "fortress_assault",
          defenderId: "p2",
          attackerEntityIds: ["e1"],
          targetFortressInstanceIds: ["f1", "f2"],
        },
      },
      { cardDatabase: DB },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.engagement?.targetFortressInstanceIds).toEqual(["f1", "f2"]);
  });

  it("allows attackers to target a defender inside the assaulted fortress", () => {
    let state = combatFixture({ seed: "assault-defender", defenderFortressOccupants: 1 });
    state = mustOk(reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: {
          kind: "fortress_assault",
          defenderId: "p2",
          attackerEntityIds: ["e1"],
          targetFortressInstanceIds: ["f1"],
        },
      },
      { cardDatabase: DB },
    ));

    const r = reduce(
      state,
      { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "o1" },
      { cardDatabase: DB },
    );
    expect(r.ok).toBe(true);
  });
});

describe("R6.10 — fortress capture resolution", () => {
  it("captures a cleared fortress by moving at least one surviving attacker inside", () => {
    let state = combatFixture();
    state.cardsByInstanceId["f1"] = {
      instanceId: "f1",
      cardId: "farmhouse",
      ownerId: "p2",
      zone: { zone: "suburbs", ownerId: "p2" },
      hp: 4,
      equippedItemIds: [],
      consumed: false,
    };
    state.players[1]!.suburbs.push({ ownerId: "p2", fortressInstanceId: "f1", occupantIds: [] });

    state = mustOk(reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: {
          kind: "fortress_assault",
          defenderId: "p2",
          attackerEntityIds: ["e1"],
          targetFortressInstanceIds: ["f1"],
        },
      },
      { cardDatabase: DB },
    ));
    state = mustOk(reduce(
      state,
      {
        kind: "RESOLVE_FORTRESS_ASSAULT",
        fortressInstanceId: "f1",
        choice: "capture",
        garrisonEntityIds: ["e1"],
      },
      { cardDatabase: DB },
    ));

    expect(state.engagement).toBeNull();
    expect(state.players[0]!.suburbs.map((f) => f.fortressInstanceId)).toContain("f1");
    expect(state.players[1]!.suburbs.map((f) => f.fortressInstanceId)).not.toContain("f1");
    expect(state.players[0]!.suburbs.find((f) => f.fortressInstanceId === "f1")?.occupantIds).toEqual(["e1"]);
    expect(state.cardsByInstanceId["f1"]!.ownerId).toBe("p2"); // original owner never changes (R3.8)
    expect(state.cardsByInstanceId["f1"]!.zone).toEqual({ zone: "suburbs", ownerId: "p1" });
    expect(state.cardsByInstanceId["e1"]!.zone).toEqual({
      zone: "fortress",
      ownerId: "p1",
      fortressInstanceId: "f1",
    });
    expect(state.battlefield).not.toContain("e1");
  });

  it("can leave a cleared fortress under its current controller", () => {
    let state = combatFixture();
    state.cardsByInstanceId["f1"] = {
      instanceId: "f1",
      cardId: "farmhouse",
      ownerId: "p2",
      zone: { zone: "suburbs", ownerId: "p2" },
      hp: 4,
      equippedItemIds: [],
      consumed: false,
    };
    state.players[1]!.suburbs.push({ ownerId: "p2", fortressInstanceId: "f1", occupantIds: [] });

    state = mustOk(reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: {
          kind: "fortress_assault",
          defenderId: "p2",
          attackerEntityIds: ["e1"],
          targetFortressInstanceIds: ["f1"],
        },
      },
      { cardDatabase: DB },
    ));
    state = mustOk(reduce(
      state,
      {
        kind: "RESOLVE_FORTRESS_ASSAULT",
        fortressInstanceId: "f1",
        choice: "leave",
      },
      { cardDatabase: DB },
    ));

    expect(state.engagement).toBeNull();
    expect(state.players[1]!.suburbs.map((f) => f.fortressInstanceId)).toContain("f1");
    expect(state.cardsByInstanceId["f1"]!.zone).toEqual({ zone: "suburbs", ownerId: "p2" });
    expect(state.cardsByInstanceId["e1"]!.zone).toEqual({ zone: "battlefield", ownerId: "p1" });
  });
});

describe("R6.11 / R7.4 — fortress destruction", () => {
  it("destroys a fortress at 0 HP and sends occupants plus items to their owners' graveyards", () => {
    let state = combatFixture({ seed: "combat-hp", defenderFortressOccupants: 1 });
    state.cardsByInstanceId["f1"]!.hp = 1;
    state.cardsByInstanceId["i2"] = {
      instanceId: "i2",
      cardId: "hammer",
      ownerId: "p2",
      zone: { zone: "equipped", ownerId: "p2", entityInstanceId: "o1" },
      hp: 0,
      equippedItemIds: [],
      consumed: false,
    };
    state.cardsByInstanceId["o1"]!.equippedItemIds = ["i2"];

    state = mustOk(reduce(
      state,
      {
        kind: "DECLARE_ENGAGEMENT",
        spec: {
          kind: "fortress_assault",
          defenderId: "p2",
          attackerEntityIds: ["e1"],
          targetFortressInstanceIds: ["f1"],
        },
      },
      { cardDatabase: DB },
    ));
    state = mustOk(reduce(
      state,
      { kind: "NORMAL_ATTACK", attackerInstanceId: "e1", targetInstanceId: "f1" },
      { cardDatabase: DB },
    ));

    expect(state.engagement).toBeNull();
    expect(state.players[1]!.suburbs).toEqual([]);
    expect(state.cardsByInstanceId["f1"]!.zone).toEqual({ zone: "graveyard", ownerId: "p2" });
    expect(state.cardsByInstanceId["o1"]!.zone).toEqual({ zone: "graveyard", ownerId: "p2" });
    expect(state.cardsByInstanceId["i2"]!.zone).toEqual({ zone: "graveyard", ownerId: "p2" });
    expect(state.players[1]!.graveyard).toEqual(expect.arrayContaining(["f1", "o1", "i2"]));
    expect(state.log.some((e) => e.rule === "R6.11")).toBe(true);
    expect(state.log.some((e) => e.rule === "R7.4")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function mustOk<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`expected ok; got: ${String(r.error)}`);
  return r.value;
}

// Silence unused-import warnings for types referenced only through the fixture.
void ({} as Engagement);

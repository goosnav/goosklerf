/**
 * State type sanity tests.
 *
 * Sprint 2 ships only the type definitions and pure helpers — there's no
 * reducer yet. These tests exercise the helpers against hand-built minimal
 * states. Real per-rule fidelity tests arrive once setup (Sprint 3) and
 * action handling (Sprint 5+) land.
 *
 * Covers helpers from `packages/engine/src/helpers.ts`:
 *   playerById, findPlayer, cardById, findCard
 *   getZoneContents, findFortress, totalFortressesOnBoard
 *   cloneState, zoneSize
 *
 * And SPEC-system invariants that don't require reducer execution:
 *   I-1 (player count 2..4), I-2 (instance ID resolution), I-7 (HP range
 *   for entities — sanity check that the type allows it).
 */

import { describe, expect, it } from "vitest";
import {
  type GameState,
  type Player,
  type CardInstance,
  type Fortress,
  type LandlordStatus,
  playerById,
  findPlayer,
  cardById,
  findCard,
  getZoneContents,
  findFortress,
  totalFortressesOnBoard,
  cloneState,
  zoneSize,
} from "@gk/engine";

// -----------------------------------------------------------------------------
// Tiny fixture: a 2-player state with one fortress and a couple of cards.
// -----------------------------------------------------------------------------

function fixture(): GameState {
  const noLandlord: LandlordStatus = { pending: false, roundsRemaining: 0 };

  const fortressInst: CardInstance = {
    instanceId: "f1",
    cardId: "farmhouse",
    ownerId: "p1",
    zone: { zone: "suburbs", ownerId: "p1" },
    hp: 4,
    equippedItemIds: [],
    consumed: false,
  };

  const occupant: CardInstance = {
    instanceId: "e1",
    cardId: "butcher_worm",
    ownerId: "p1",
    zone: { zone: "fortress", ownerId: "p1", fortressInstanceId: "f1" },
    hp: 3,
    equippedItemIds: [],
    consumed: false,
  };

  const battlefieldEntity: CardInstance = {
    instanceId: "e2",
    cardId: "happy_guy",
    ownerId: "p2",
    zone: { zone: "battlefield", ownerId: "p2" },
    hp: 2,
    equippedItemIds: [],
    consumed: false,
  };

  const handCard: CardInstance = {
    instanceId: "c1",
    cardId: "hammer",
    ownerId: "p1",
    zone: { zone: "hand", ownerId: "p1" },
    hp: 0,
    equippedItemIds: [],
    consumed: false,
  };

  const fortress: Fortress = {
    ownerId: "p1",
    fortressInstanceId: "f1",
    occupantIds: ["e1"],
  };

  const p1: Player = {
    id: "p1",
    name: "Player 1",
    kind: "human",
    personality: null,
    hand: ["c1"],
    deck: [],
    graveyard: [],
    suburbs: [fortress],
    shop: [],
    oldAgeCounter: 0,
    landlord: noLandlord,
    declaredEngagementThisTurn: false,
  };

  const p2: Player = {
    id: "p2",
    name: "Player 2",
    kind: "ai",
    personality: "butcher",
    hand: [],
    deck: [],
    graveyard: [],
    suburbs: [],
    shop: [],
    oldAgeCounter: 0,
    landlord: noLandlord,
    declaredEngagementThisTurn: false,
  };

  return {
    seed: "fixture",
    rngState: { seed: "fixture", callCount: 0 },
    deckSize: "medium",
    players: [p1, p2],
    activePlayerId: "p1",
    phase: "card_play",
    cardPlay: { startedWith: 1, played: 0, discarded: 0 },
    turnNumber: 1,
    cardsByInstanceId: {
      f1: fortressInst,
      e1: occupant,
      e2: battlefieldEntity,
      c1: handCard,
    },
    battlefield: ["e2"],
    engagement: null,
    log: [],
    outcome: null,
  };
}

// -----------------------------------------------------------------------------

describe("invariant I-1: player count", () => {
  it("fixture has 2 players (within [2, 4])", () => {
    const s = fixture();
    expect(s.players.length).toBeGreaterThanOrEqual(2);
    expect(s.players.length).toBeLessThanOrEqual(4);
  });
});

describe("playerById / findPlayer", () => {
  it("playerById returns the player when present", () => {
    const s = fixture();
    expect(playerById(s, "p2").name).toBe("Player 2");
  });

  it("playerById throws when missing", () => {
    expect(() => playerById(fixture(), "ghost")).toThrow();
  });

  it("findPlayer returns undefined when missing", () => {
    expect(findPlayer(fixture(), "ghost")).toBeUndefined();
  });
});

describe("cardById / findCard", () => {
  it("cardById returns the instance when present", () => {
    expect(cardById(fixture(), "e1").cardId).toBe("butcher_worm");
  });

  it("cardById throws when missing", () => {
    expect(() => cardById(fixture(), "nope")).toThrow();
  });

  it("findCard returns undefined when missing", () => {
    expect(findCard(fixture(), "nope")).toBeUndefined();
  });
});

describe("getZoneContents", () => {
  it("R3.1 — battlefield zone is filtered by owner", () => {
    const s = fixture();
    expect(getZoneContents(s, { zone: "battlefield", ownerId: "p1" })).toEqual([]);
    expect(getZoneContents(s, { zone: "battlefield", ownerId: "p2" })).toEqual(["e2"]);
  });

  it("R3.4 — hand and deck are per-player", () => {
    const s = fixture();
    expect(getZoneContents(s, { zone: "hand", ownerId: "p1" })).toEqual(["c1"]);
    expect(getZoneContents(s, { zone: "hand", ownerId: "p2" })).toEqual([]);
    expect(getZoneContents(s, { zone: "deck", ownerId: "p1" })).toEqual([]);
  });

  it("R3.2 — fortress zone returns occupant instance IDs", () => {
    const s = fixture();
    const occ = getZoneContents(s, {
      zone: "fortress",
      ownerId: "p1",
      fortressInstanceId: "f1",
    });
    expect(occ).toEqual(["e1"]);
  });

  it("R3.2 — suburbs zone returns fortress instance IDs", () => {
    const s = fixture();
    expect(getZoneContents(s, { zone: "suburbs", ownerId: "p1" })).toEqual(["f1"]);
  });

  it("R3.5 / R5.6 — shop zone is per-player", () => {
    const s = fixture();
    expect(getZoneContents(s, { zone: "shop", ownerId: "p1" })).toEqual([]);
    expect(getZoneContents(s, { zone: "shop", ownerId: "p2" })).toEqual([]);
  });

  it("returns a fresh copy (mutating result does not affect state)", () => {
    const s = fixture();
    const occ = getZoneContents(s, {
      zone: "fortress",
      ownerId: "p1",
      fortressInstanceId: "f1",
    });
    occ.push("intruder");
    expect(s.players[0]!.suburbs[0]!.occupantIds).toEqual(["e1"]);
  });

  it("throws on a fortress ZoneRef that doesn't exist", () => {
    const s = fixture();
    expect(() =>
      getZoneContents(s, { zone: "fortress", ownerId: "p1", fortressInstanceId: "ghost" }),
    ).toThrow();
  });
});

describe("findFortress / totalFortressesOnBoard", () => {
  it("finds an existing fortress", () => {
    const f = findFortress(fixture(), "p1", "f1");
    expect(f?.fortressInstanceId).toBe("f1");
  });

  it("returns undefined for an unknown fortress", () => {
    expect(findFortress(fixture(), "p1", "nope")).toBeUndefined();
    expect(findFortress(fixture(), "ghost", "f1")).toBeUndefined();
  });

  it("totalFortressesOnBoard sums all suburbs (R10.3 prerequisite)", () => {
    expect(totalFortressesOnBoard(fixture())).toBe(1);
  });
});

describe("zoneSize", () => {
  it("counts entries in a zone", () => {
    const s = fixture();
    expect(zoneSize(s, { zone: "battlefield", ownerId: "p2" })).toBe(1);
    expect(zoneSize(s, { zone: "hand", ownerId: "p1" })).toBe(1);
    expect(zoneSize(s, { zone: "shop", ownerId: "p1" })).toBe(0);
  });
});

describe("cloneState", () => {
  it("produces an independent deep copy", () => {
    const s = fixture();
    const c = cloneState(s);
    expect(c).toEqual(s);
    expect(c).not.toBe(s);
    expect(c.players).not.toBe(s.players);
    expect(c.players[0]).not.toBe(s.players[0]);
    expect(c.cardsByInstanceId.e1).not.toBe(s.cardsByInstanceId.e1);
  });

  it("mutating the clone does not affect the original", () => {
    const s = fixture();
    const c = cloneState(s);
    c.players[0]!.hand.push("intruder");
    c.cardsByInstanceId.e1!.hp = 1;
    expect(s.players[0]!.hand).toEqual(["c1"]);
    expect(s.cardsByInstanceId.e1!.hp).toBe(3);
  });
});

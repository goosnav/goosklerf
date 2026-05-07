/**
 * Game-setup rule fidelity tests.
 *
 * Covers:
 *   R1.2  deck regimes — sizes, minimums, 3-copy limit
 *   R1.3  starting hand of 7; mulligan triggers when hand has no entity/fortress
 *   R1.4  first player chosen by RNG; deterministic per seed
 *   R1.5  shop draw at setup — per-player, sized 3/7/7 by regime
 *
 * Plus determinism guarantees (same seed → same state).
 *
 * Tests run against the real generated card database — they require
 * `pnpm cards:build` to have produced `packages/cards/data/cards.generated.json`.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { type CardDatabase, loadCardDatabase } from "@gk/cards";
import { setupGame, type DeckSize, type SetupOptions } from "@gk/engine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARDS_PATH = join(__dirname, "../../packages/cards/data/cards.generated.json");

let db: CardDatabase;

beforeAll(() => {
  if (!existsSync(CARDS_PATH)) {
    throw new Error(
      `${CARDS_PATH} missing — run \`pnpm cards:build\` before running tests.`,
    );
  }
  db = loadCardDatabase(CARDS_PATH);
});

function defaultOpts(overrides: Partial<SetupOptions> = {}): SetupOptions {
  return {
    seed: "setup-test",
    deckSize: "medium",
    cardDatabase: db,
    players: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "ai", personality: "butcher" },
    ],
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// R1.2 deck regimes
// -----------------------------------------------------------------------------

describe("R1.2 — deck regimes", () => {
  const regimes: Array<{ size: DeckSize; total: number; minE: number; minF: number; minI: number }> = [
    { size: "small",  total: 24, minE: 5,  minF: 1, minI: 10 },
    { size: "medium", total: 36, minE: 10, minF: 2, minI: 15 },
    { size: "large",  total: 54, minE: 15, minF: 3, minI: 25 },
  ];

  for (const r of regimes) {
    it(`R1.2 — ${r.size} regime: deck has exactly ${r.total} cards`, () => {
      const result = setupGame(defaultOpts({ seed: `r1.2-${r.size}`, deckSize: r.size }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Total per player = hand + deck + shop (entities haven't been played yet)
      for (const p of result.value.players) {
        const inDeckOrHandOrShop = p.hand.length + p.deck.length + p.shop.length;
        expect(inDeckOrHandOrShop).toBe(r.total);
      }
    });

    it(`R1.2 — ${r.size} regime satisfies minimums (entities ≥${r.minE}, fortresses ≥${r.minF}, items ≥${r.minI})`, () => {
      const result = setupGame(defaultOpts({ seed: `r1.2-min-${r.size}`, deckSize: r.size }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const p of result.value.players) {
        const allCards = [...p.hand, ...p.deck, ...p.shop].map((id) => result.value.cardsByInstanceId[id]!);
        const types = allCards.map((c) => db[c.cardId]!.type);
        const e = types.filter((t) => t === "entity").length;
        const f = types.filter((t) => t === "fortress").length;
        const i = types.filter((t) => t === "item_regular" || t === "item_consumable").length;
        expect(e).toBeGreaterThanOrEqual(r.minE);
        expect(f).toBeGreaterThanOrEqual(r.minF);
        expect(i).toBeGreaterThanOrEqual(r.minI);
        expect(e + f + i).toBe(r.total);
      }
    });
  }

  it("R1.2 — no card name appears more than 3 times in any one player's deck", () => {
    const result = setupGame(defaultOpts({ seed: "r1.2-copies", deckSize: "large" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.value.players) {
      const allIds = [...p.hand, ...p.deck, ...p.shop];
      const cardIds = allIds.map((id) => result.value.cardsByInstanceId[id]!.cardId);
      const counts = new Map<string, number>();
      for (const cid of cardIds) counts.set(cid, (counts.get(cid) ?? 0) + 1);
      for (const [cid, n] of counts) {
        expect(n, `card ${cid} appears ${n} times for player ${p.id}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("R1.2 — no data_error card appears in any deck (M1 scope: text-ignored cards permitted)", () => {
    const result = setupGame(defaultOpts({ seed: "r1.2-impl", deckSize: "medium" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const allInstances = Object.values(result.value.cardsByInstanceId);
    for (const inst of allInstances) {
      // M1 admits both fully_implemented and not_implemented (ignoring the
      // latter's special text). Only data_error is excluded.
      expect(db[inst.cardId]!.automationStatus).not.toBe("data_error");
    }
  });
});

// -----------------------------------------------------------------------------
// R1.3 starting hand and mulligan
// -----------------------------------------------------------------------------

describe("R1.3 — starting hand", () => {
  it("R1.3 — every player draws exactly 7 cards", () => {
    const result = setupGame(defaultOpts({ seed: "r1.3-size" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.value.players) {
      expect(p.hand.length).toBe(7);
    }
  });

  it("R1.3 — after mulligan, every player's hand has at least one entity or fortress", () => {
    // Across many seeds, the mulligan should always produce a legal hand on
    // the first or second draw. Check 10 seeds; all must be legal.
    for (let i = 0; i < 10; i++) {
      const result = setupGame(defaultOpts({ seed: `r1.3-mull-${i}` }));
      expect(result.ok, `seed r1.3-mull-${i}`).toBe(true);
      if (!result.ok) continue;
      for (const p of result.value.players) {
        const handDefs = p.hand.map((id) => db[result.value.cardsByInstanceId[id]!.cardId]!);
        const hasEntityOrFortress = handDefs.some(
          (d) => d.type === "entity" || d.type === "fortress",
        );
        // Strictly speaking the rulebook allows a player to keep an illegal
        // hand if they choose, and our auto-mulligan only retries once. So
        // this is a probabilistic check — if it ever fires we'd want to know.
        expect(hasEntityOrFortress, `${p.id} has no entity or fortress`).toBe(true);
      }
    }
  });
});

// -----------------------------------------------------------------------------
// R1.4 first player & turn order
// -----------------------------------------------------------------------------

describe("R1.4 — first player", () => {
  it("R1.4 — active player is one of the input players", () => {
    const result = setupGame(defaultOpts({ seed: "r1.4-active" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.players.map((p) => p.id);
    expect(ids).toContain(result.value.activePlayerId);
  });

  it("R1.4 — first player choice is deterministic for a given seed", () => {
    const a = setupGame(defaultOpts({ seed: "r1.4-determ" }));
    const b = setupGame(defaultOpts({ seed: "r1.4-determ" }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.activePlayerId).toBe(b.value.activePlayerId);
  });

  it("R1.4 — different seeds can pick different first players (over many seeds, both are seen)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const result = setupGame(defaultOpts({ seed: `r1.4-spread-${i}` }));
      if (result.ok) seen.add(result.value.activePlayerId);
    }
    // With 2 players and 30 seeds, both should appear unless we got
    // astronomically unlucky.
    expect(seen.size).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// R1.5 shop setup
// -----------------------------------------------------------------------------

describe("R1.5 — shop setup", () => {
  const cases: Array<{ size: DeckSize; expected: number }> = [
    { size: "small",  expected: 3 },
    { size: "medium", expected: 7 },
    { size: "large",  expected: 7 },
  ];

  for (const c of cases) {
    it(`R1.5 — ${c.size} regime: each player has a shop of ${c.expected}`, () => {
      const result = setupGame(defaultOpts({ seed: `r1.5-${c.size}`, deckSize: c.size }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const p of result.value.players) {
        expect(p.shop.length).toBe(c.expected);
      }
    });
  }

  it("R1.5 / R5.6 — every shop card is owned by the player it sits with", () => {
    const result = setupGame(defaultOpts({ seed: "r1.5-owner" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.value.players) {
      for (const id of p.shop) {
        const inst = result.value.cardsByInstanceId[id]!;
        expect(inst.ownerId).toBe(p.id);
        expect(inst.zone).toEqual({ zone: "shop", ownerId: p.id });
      }
    }
  });

  it("R1.5 — shop disabled: every player has an empty shop", () => {
    const result = setupGame(defaultOpts({ seed: "r1.5-off", enableShop: false }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.value.players) {
      expect(p.shop).toEqual([]);
      // The deck-or-hand should now contain the full deck total.
      expect(p.hand.length + p.deck.length).toBe(36); // medium
    }
  });

  it("R1.5 — shop cards do not duplicate hand or deck cards (instance ids unique)", () => {
    const result = setupGame(defaultOpts({ seed: "r1.5-uniq" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.value.players) {
      const ids = [...p.hand, ...p.deck, ...p.shop];
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

// -----------------------------------------------------------------------------
// Determinism + invariants
// -----------------------------------------------------------------------------

describe("setupGame — determinism", () => {
  it("same seed → structurally identical state", () => {
    const a = setupGame(defaultOpts({ seed: "determ-1" }));
    const b = setupGame(defaultOpts({ seed: "determ-1" }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value).toEqual(b.value);
  });

  it("different seeds → different decks", () => {
    const a = setupGame(defaultOpts({ seed: "diff-aaa" }));
    const b = setupGame(defaultOpts({ seed: "diff-bbb" }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const handsA = a.value.players.map((p) => p.hand.map((id) => a.value.cardsByInstanceId[id]!.cardId));
    const handsB = b.value.players.map((p) => p.hand.map((id) => b.value.cardsByInstanceId[id]!.cardId));
    expect(handsA).not.toEqual(handsB);
  });

  it("rngState is preserved at end of setup, not zeroed", () => {
    const result = setupGame(defaultOpts({ seed: "rng-snap" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rngState.seed).toBe("rng-snap");
    // Setup consumes a lot of randomness; callCount should be far above 0.
    expect(result.value.rngState.callCount).toBeGreaterThan(50);
  });
});

// -----------------------------------------------------------------------------
// Input validation
// -----------------------------------------------------------------------------

describe("setupGame — input validation", () => {
  it("rejects fewer than 2 players", () => {
    const r = setupGame(defaultOpts({ players: [{ name: "Solo", kind: "human" }] }));
    expect(r.ok).toBe(false);
  });

  it("rejects more than 4 players", () => {
    const r = setupGame(
      defaultOpts({
        players: [
          { name: "A", kind: "human" },
          { name: "B", kind: "ai", personality: "butcher" },
          { name: "C", kind: "ai", personality: "landlord" },
          { name: "D", kind: "ai", personality: "goblin" },
          { name: "E", kind: "ai", personality: "accountant" },
        ],
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects an AI player without a personality", () => {
    const r = setupGame(
      defaultOpts({
        players: [
          { name: "Alice", kind: "human" },
          { name: "Bot", kind: "ai" }, // missing personality
        ],
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("accepts a 4-player game", () => {
    const r = setupGame(
      defaultOpts({
        seed: "four-players",
        players: [
          { name: "A", kind: "human" },
          { name: "B", kind: "ai", personality: "butcher" },
          { name: "C", kind: "ai", personality: "landlord" },
          { name: "D", kind: "ai", personality: "goblin" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.players.length).toBe(4);
    expect(r.value.players.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

// -----------------------------------------------------------------------------
// Top-level state shape
// -----------------------------------------------------------------------------

describe("setupGame — initial GameState shape", () => {
  it("starts in card_play phase, turn 1, no engagement, no outcome", () => {
    const r = setupGame(defaultOpts({ seed: "shape" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.phase).toBe("card_play");
    expect(r.value.turnNumber).toBe(1);
    expect(r.value.engagement).toBeNull();
    expect(r.value.outcome).toBeNull();
    expect(r.value.battlefield).toEqual([]);
    expect(r.value.log.length).toBeGreaterThan(0);
    expect(r.value.log[0]!.rule).toBe("R1.4");
  });

  it("every CardInstance has a zone matching its actual location", () => {
    const r = setupGame(defaultOpts({ seed: "zones" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const p of r.value.players) {
      for (const id of p.hand) {
        expect(r.value.cardsByInstanceId[id]!.zone).toEqual({ zone: "hand", ownerId: p.id });
      }
      for (const id of p.deck) {
        expect(r.value.cardsByInstanceId[id]!.zone).toEqual({ zone: "deck", ownerId: p.id });
      }
      for (const id of p.shop) {
        expect(r.value.cardsByInstanceId[id]!.zone).toEqual({ zone: "shop", ownerId: p.id });
      }
    }
  });

  it("instance ids are unique across the whole game", () => {
    const r = setupGame(defaultOpts({ seed: "uniq-global" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const allIds = Object.keys(r.value.cardsByInstanceId);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

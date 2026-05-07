/**
 * Phase rotation tests.
 *
 * Covers R4.1 (5-phase turn structure) end-to-end:
 *   card_play → combat → movement → card_draw → victory_check → next player's card_play
 *
 * The non-card-play phases are stubs at this point (their rich logic lands
 * Sprints 6+, 8, 9, 10). What we test now:
 *   - END_PHASE during a stub phase advances correctly.
 *   - End of victory_check rotates the active player and increments turnNumber.
 *   - cardPlay state resets for the incoming player.
 *   - declaredEngagementThisTurn resets at turn-start.
 *   - END_PHASE refuses to advance past victory_check after outcome is set.
 *
 * As phase logic lands in later sprints, these tests stay; the stubs simply
 * become richer.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { type CardDatabase, loadCardDatabase } from "@gk/cards";
import { reduce, setupGame, type GameState } from "@gk/engine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARDS_PATH = join(__dirname, "../../packages/cards/data/cards.generated.json");

let db: CardDatabase;

beforeAll(() => {
  if (!existsSync(CARDS_PATH)) {
    throw new Error(`${CARDS_PATH} missing — run \`pnpm cards:build\` first.`);
  }
  db = loadCardDatabase(CARDS_PATH);
});

/** Build a fixture state and force-skip Card Play so we can test the stub phases. */
function fixtureAtPhase(phase: GameState["phase"], seed = "phase-test"): GameState {
  const r = setupGame({
    seed,
    deckSize: "medium",
    cardDatabase: db,
    enableShop: false,
    players: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "ai", personality: "butcher" },
    ],
  });
  if (!r.ok) throw new Error("setup failed: " + r.error);
  // Bypass quota-checked phases by setting state.phase directly. This is safe
  // for tests because GameState is plain JSON; the fixture is short-lived.
  return { ...r.value, phase };
}

describe("R4.1 — phase advancement (stub phases)", () => {
  it("combat → movement on END_PHASE", () => {
    const state = fixtureAtPhase("combat");
    const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.phase).toBe("movement");
    const lastLog = r.value.log[r.value.log.length - 1]!;
    expect(lastLog.rule).toBe("R4.1");
    expect(lastLog.data?.["toPhase"]).toBe("movement");
  });

  it("movement → card_draw on END_PHASE", () => {
    const state = fixtureAtPhase("movement");
    const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.phase).toBe("card_draw");
  });

  it("card_draw → victory_check on END_PHASE", () => {
    const state = fixtureAtPhase("card_draw");
    const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.phase).toBe("victory_check");
  });
});

describe("R4.1 — end of victory_check rotates active player", () => {
  it("active player advances; turnNumber increments; phase returns to card_play", () => {
    const state = fixtureAtPhase("victory_check");
    const beforeActive = state.activePlayerId;
    const beforeTurn = state.turnNumber;
    const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.activePlayerId).not.toBe(beforeActive);
    expect(r.value.turnNumber).toBe(beforeTurn + 1);
    expect(r.value.phase).toBe("card_play");
  });

  it("rotation wraps around the players array", () => {
    let state = fixtureAtPhase("victory_check");
    const order: string[] = [state.activePlayerId];
    // Two players, so two rotations should bring us back.
    for (let i = 0; i < 2; i++) {
      const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // Re-enter victory_check for the next rotation.
      state = { ...r.value, phase: "victory_check" };
      order.push(state.activePlayerId);
    }
    // Wrapped: order[2] === order[0]
    expect(order[2]).toBe(order[0]);
  });

  it("resets cardPlay state to incoming player's hand size", () => {
    const state = fixtureAtPhase("victory_check");
    const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const newActive = r.value.players.find((p) => p.id === r.value.activePlayerId)!;
    expect(r.value.cardPlay.played).toBe(0);
    expect(r.value.cardPlay.discarded).toBe(0);
    expect(r.value.cardPlay.startedWith).toBe(newActive.hand.length);
  });

  it("resets declaredEngagementThisTurn for incoming player", () => {
    let state = fixtureAtPhase("victory_check");
    // Pretend the OUTGOING player declared an engagement this turn so we can
    // confirm the rotation does not preserve that flag for the new player.
    const newActiveId = state.players.find((p) => p.id !== state.activePlayerId)!.id;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === newActiveId ? { ...p, declaredEngagementThisTurn: true } : p,
      ),
    };
    const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const newActive = r.value.players.find((p) => p.id === newActiveId)!;
    expect(newActive.declaredEngagementThisTurn).toBe(false);
  });
});

describe("R4.1 — full rotation: human turn → AI turn (stub phases)", () => {
  it("can advance through all 5 phases and return to card_play for next player", () => {
    // Skip card_play (Sprint 5 covered) and rotate from combat onward.
    let state = fixtureAtPhase("combat");
    const transitions: GameState["phase"][] = [];
    transitions.push(state.phase);
    for (const _ of [0, 1, 2, 3]) {
      const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.value;
      transitions.push(state.phase);
    }
    expect(transitions).toEqual([
      "combat",
      "movement",
      "card_draw",
      "victory_check",
      "card_play",
    ]);
  });
});

describe("R10.x guard", () => {
  it("rotation is rejected once outcome is set", () => {
    const state: GameState = {
      ...fixtureAtPhase("victory_check"),
      outcome: { kind: "hamlet" },
    };
    const r = reduce(state, { kind: "END_PHASE" }, { cardDatabase: db });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("R10");
  });
});

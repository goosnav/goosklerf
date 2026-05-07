/**
 * Render-layer tests.
 *
 * - Snapshot of the full initial render for a fixed seed: protects against
 *   accidental visual regressions.
 * - Targeted unit tests on individual render sections: protects against
 *   semantic regressions (e.g. accidentally hiding the active-player marker).
 *
 * All snapshots run with useColor=false so ANSI codes don't pollute them.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { type CardDatabase, loadCardDatabase } from "@gk/cards";
import { setupGame, type GameState } from "@gk/engine";
import {
  renderHeader,
  renderBoard,
  renderHand,
  renderShop,
  renderLog,
  renderAll,
} from "../../apps/play-cli/src/render.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARDS_PATH = join(__dirname, "../../packages/cards/data/cards.generated.json");

let db: CardDatabase;

beforeAll(() => {
  if (!existsSync(CARDS_PATH)) {
    throw new Error(`${CARDS_PATH} missing — run \`pnpm cards:build\` first.`);
  }
  db = loadCardDatabase(CARDS_PATH);
});

function fixtureState(): GameState {
  const r = setupGame({
    seed: "render-fixture",
    deckSize: "medium",
    cardDatabase: db,
    players: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "ai", personality: "butcher" },
    ],
  });
  if (!r.ok) throw new Error("setup failed: " + r.error);
  return r.value;
}

describe("renderHeader", () => {
  it("includes turn, active player name, phase, seed, regime", () => {
    const state = fixtureState();
    const lines = renderHeader(state, { useColor: false, cardDb: db });
    const all = lines.join("\n");
    expect(all).toContain("turn 1");
    expect(all).toContain("Card Play phase");
    expect(all).toContain("seed: render-fixture");
    expect(all).toContain("regime: medium");
  });
});

describe("renderBoard", () => {
  it("shows BATTLEFIELD and SUBURBS sections", () => {
    const state = fixtureState();
    const lines = renderBoard(state, { useColor: false, cardDb: db });
    const all = lines.join("\n");
    expect(all).toContain("BATTLEFIELD");
    expect(all).toContain("SUBURBS");
  });

  it("marks the active player with ▶", () => {
    const state = fixtureState();
    const lines = renderBoard(state, { useColor: false, cardDb: db });
    const activePlayer = state.players.find((p) => p.id === state.activePlayerId)!;
    const activeLine = lines.find((l) => l.includes(activePlayer.name));
    expect(activeLine, "active player line").toBeDefined();
    expect(activeLine).toContain("▶");
  });

  it("shows an empty battlefield message when nothing is on the field", () => {
    const state = fixtureState();
    const lines = renderBoard(state, { useColor: false, cardDb: db });
    expect(lines.some((l) => l.includes("(empty)"))).toBe(true);
  });
});

describe("renderHand", () => {
  it("renders 7 cards for the active player at game start (R1.3)", () => {
    const state = fixtureState();
    const lines = renderHand(state, { useColor: false, cardDb: db });
    const cardLines = lines.filter((l) => /^\s*\[\d+\]/.test(l));
    expect(cardLines.length).toBe(7);
  });

  it("hand header names the active player", () => {
    const state = fixtureState();
    const lines = renderHand(state, { useColor: false, cardDb: db });
    const active = state.players.find((p) => p.id === state.activePlayerId)!;
    expect(lines[0]).toContain(active.name);
  });
});

describe("renderShop", () => {
  it("renders 7 cards for medium-regime shop (R1.5)", () => {
    const state = fixtureState();
    const lines = renderShop(state, { useColor: false, cardDb: db });
    const cardLines = lines.filter((l) => /^\s*\[\d+\]/.test(l));
    expect(cardLines.length).toBe(7);
  });

  it("returns no lines when shop is empty (--no-shop)", () => {
    const r = setupGame({
      seed: "no-shop",
      deckSize: "medium",
      cardDatabase: db,
      enableShop: false,
      players: [
        { name: "A", kind: "human" },
        { name: "B", kind: "ai", personality: "butcher" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lines = renderShop(r.value, { useColor: false, cardDb: db });
    expect(lines.length).toBe(0);
  });
});

describe("renderLog", () => {
  it("renders the R1.4 setup-start entry", () => {
    const state = fixtureState();
    const lines = renderLog(state, { useColor: false, cardDb: db });
    const all = lines.join("\n");
    expect(all).toContain("R1.4");
    expect(all).toContain("Game start");
  });
});

describe("renderAll — full snapshot", () => {
  it("matches a stable snapshot for a fixed seed and player roster", () => {
    const state = fixtureState();
    const out = renderAll(state, { useColor: false, cardDb: db });
    // Strip the dim "─" separator's exact length (depends on string lengths
    // that may shift if names change). We replace runs of 3+ "─" with a stub.
    const normalized = out.replace(/─+/g, "───");
    expect(normalized).toMatchSnapshot();
  });
});

/**
 * End-to-end build pipeline test against the real CSV.
 *
 * Verifies that the canonical card_data-003.csv produces a card database
 * with the expected shape and counts. Citing R2.1/R2.2/R2.3/R2.4 because
 * the schema validation that drives the counts is what enforces those rules.
 *
 * If the CSV is edited and counts shift, update the assertions here AND in
 * docs/CHANGELOG.md so we have a paper trail.
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { loadCardDatabase, parseCsvFile, rowToCardDefinition } from "@gk/cards";

const __dirname = dirname(fileURLToPath(import.meta.url));
// gk_videogame_v2/tests/cards/build.test.ts
// -> ../../../archive/gk_videogame_v1/card_data-003.csv
const CSV_PATH = join(__dirname, "../../../archive/gk_videogame_v1/card_data-003.csv");
const JSON_PATH = join(__dirname, "../../packages/cards/data/cards.generated.json");

describe("CSV → CardDatabase pipeline against real data", () => {
  it("parses 128 rows from the canonical CSV", () => {
    const rows = parseCsvFile(CSV_PATH);
    expect(rows).toHaveLength(128);
  });

  it("emits the expected automation-status distribution", () => {
    const rows = parseCsvFile(CSV_PATH);
    const cards = rows.map(rowToCardDefinition);

    // de-duplicate by id for a fair count
    const byId = new Map<string, (typeof cards)[number]>();
    for (const c of cards) if (!byId.has(c.id)) byId.set(c.id, c);
    const all = [...byId.values()];

    const fully = all.filter((c) => c.automationStatus === "fully_implemented").length;
    const notImpl = all.filter((c) => c.automationStatus === "not_implemented").length;
    const errors = all.filter((c) => c.automationStatus === "data_error").length;

    expect(all.length).toBe(127); // one duplicate id in the CSV
    expect(fully + notImpl + errors).toBe(127);
    expect(errors).toBe(11); // R2.2 — 11 entities missing baseAttack
  });

  it("flags exactly the 11 known missing-attack entities", () => {
    const rows = parseCsvFile(CSV_PATH);
    const cards = rows.map(rowToCardDefinition);
    const errored = cards
      .filter((c) => c.automationStatus === "data_error")
      .map((c) => c.id)
      .sort();

    expect(errored).toEqual(
      [
        "billy_is_stranded",
        "bionicus_brunkle",
        "cybertoade",
        "imposter_kite",
        "jeremy_wormfield",
        "jimmy_two_hats",
        "just_a_happy_guy",
        "lord_flumpuqat",
        "snail_rider",
        "sneefus",
        "wormson_wormley",
      ].sort(),
    );
  });
});

describe("loadCardDatabase round-trip", () => {
  it("loads the generated JSON and round-trips through Zod (R2.1–R2.4)", () => {
    if (!existsSync(JSON_PATH)) {
      throw new Error(
        `${JSON_PATH} missing — run \`pnpm cards:build\` before running tests.`,
      );
    }
    const db = loadCardDatabase(JSON_PATH);

    // Database is keyed by id; key === card.id for every entry
    for (const [id, card] of Object.entries(db)) {
      expect(card.id, `key/id mismatch for ${id}`).toBe(id);
    }

    // R2.2: every fully-implemented entity has baseAttack and baseHp
    for (const c of Object.values(db)) {
      if (c.type === "entity" && c.automationStatus === "fully_implemented") {
        expect(c.baseAttack, `${c.id} missing baseAttack`).toBeDefined();
        expect(c.baseHp, `${c.id} missing baseHp`).toBeDefined();
      }
    }

    // R2.3: every fully-implemented fortress has fortressHp
    for (const c of Object.values(db)) {
      if (c.type === "fortress" && c.automationStatus === "fully_implemented") {
        expect(c.fortressHp, `${c.id} missing fortressHp`).toBeDefined();
      }
    }
  });
});

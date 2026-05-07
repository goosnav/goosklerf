/**
 * CSV-to-JSON build script.
 *
 * Reads the canonical card_data-003.csv and emits cards.generated.json
 * keyed by card id. Run via `pnpm cards:build`.
 *
 * The output is gitignored — each developer regenerates from the CSV.
 * If schema or import logic changes, re-run this script to refresh the JSON.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { parseCsvFile } from "./csv.js";
import { rowToCardDefinition } from "./import.js";
import type { CardDatabase } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// CSV path resolved relative to this file:
//   gk_videogame_v2/packages/cards/src/build.ts
//   -> ../../../../archive/gk_videogame_v1/card_data-003.csv
const CSV_PATH = join(__dirname, "../../../../archive/gk_videogame_v1/card_data-003.csv");
const OUT_DIR = join(__dirname, "../data");
const OUT_PATH = join(OUT_DIR, "cards.generated.json");

function main(): void {
  console.log(`Reading CSV: ${CSV_PATH}`);
  const rows = parseCsvFile(CSV_PATH);
  console.log(`  parsed ${rows.length} rows`);

  // De-duplicate by id, keeping the first occurrence.
  // The CSV has been validated to have unique card names, but defending against
  // accidental duplicates is cheap.
  const seen = new Set<string>();
  const db: CardDatabase = {};
  let dropped = 0;
  for (const row of rows) {
    const card = rowToCardDefinition(row);
    if (seen.has(card.id)) {
      dropped++;
      continue;
    }
    seen.add(card.id);
    db[card.id] = card;
  }

  const all = Object.values(db);
  const fully = all.filter((c) => c.automationStatus === "fully_implemented").length;
  const notImpl = all.filter((c) => c.automationStatus === "not_implemented").length;
  const errors = all.filter((c) => c.automationStatus === "data_error").length;

  console.log("Validation summary:");
  console.log(`  fully_implemented: ${fully}`);
  console.log(`  not_implemented:   ${notImpl}  (special-text cards; text ignored at M1)`);
  console.log(`  data_error:        ${errors}   (missing required stats; always excluded)`);
  if (dropped > 0) console.log(`  duplicate ids dropped: ${dropped}`);

  if (errors > 0) {
    console.log("\nData errors (these cards are loaded but excluded from decks):");
    for (const c of all.filter((c) => c.automationStatus === "data_error")) {
      console.log(`  ${c.id}: type=${c.type}`);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(db, null, 2));
  console.log(`\nWrote ${all.length} cards to ${OUT_PATH}`);
}

main();

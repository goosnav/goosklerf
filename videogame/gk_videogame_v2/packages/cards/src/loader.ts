/**
 * Runtime loader for cards.generated.json.
 *
 * The engine and AI consume cards via this loader, never via the CSV directly.
 * Validates with Zod at the boundary so a stale or hand-edited JSON won't
 * silently feed bad data into the engine.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { CardDatabaseSchema } from "./schema.js";
import type { CardDatabase } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, "../data/cards.generated.json");

/**
 * Load and validate the card database.
 *
 * Throws if the JSON is missing, malformed, or fails schema validation.
 * Callers are expected to handle the error (typically by exiting with a
 * "run pnpm cards:build" hint).
 */
export function loadCardDatabase(path: string = DEFAULT_PATH): CardDatabase {
  if (!existsSync(path)) {
    throw new Error(
      `Card database not found at ${path}. Run \`pnpm cards:build\` first.`,
    );
  }
  const raw = readFileSync(path, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  return CardDatabaseSchema.parse(parsed);
}

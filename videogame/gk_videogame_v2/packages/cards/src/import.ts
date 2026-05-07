/**
 * Convert raw CSV rows into typed CardDefinition records.
 *
 * The CSV columns:
 *   filename, card_name, card_type, hp, fortress_hp, attack,
 *   attack_buff, hp_buff, misc_stat, description, has_special, notes
 *
 * Spec references:
 *   R2.1  card type normalization
 *   R2.2, R2.3, R2.4  per-type required fields
 */

import type { CsvRow } from "./csv.js";
import type { CardDefinition, CardType, Rarity, AutomationStatus } from "./types.js";
import { validateCard } from "./schema.js";

/** Stable slug from a printed card name. */
export function generateCardId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumeric(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const trimmed = s.trim();
  if (trimmed === "") return undefined;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeType(raw: string): CardType | undefined {
  const key = raw.toLowerCase().trim();
  switch (key) {
    case "entity":
      return "entity";
    case "fortress":
      return "fortress";
    case "item_regular":
    case "item regular":
      return "item_regular";
    case "item_consumable":
    case "item consumable":
      return "item_consumable";
    default:
      return undefined;
  }
}

/**
 * Rarity inference. The CSV doesn't have a rarity column today, so we look at
 * filename hints. If/when the CSV grows a real rarity column, replace this.
 *
 * R2.1: rare cards exist for all three card types; rarity is shown by border color.
 */
function inferRarity(filename: string): Rarity {
  const lower = filename.toLowerCase();
  if (lower.includes("rare") || lower.includes("_r_") || lower.includes("super_")) {
    return "rare";
  }
  return "normal";
}

function parseHasSpecial(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.toLowerCase().trim();
  return v === "true" || v === "yes" || v === "y" || v === "1";
}

/**
 * Convert one CSV row to a CardDefinition.
 *
 * Returns either a complete definition or, if the row is missing required
 * fields per its declared type, returns a definition tagged
 * automationStatus="data_error" so the build can surface it as a warning
 * without crashing.
 */
export function rowToCardDefinition(row: CsvRow): CardDefinition {
  const name = (row["card_name"] ?? "").trim();
  const filename = (row["filename"] ?? "").trim();
  const id = generateCardId(name || filename || "unknown");

  const type = normalizeType(row["card_type"] ?? "") ?? "entity";
  const rulesText = (row["description"] ?? "").trim();
  const hasSpecial = parseHasSpecial(row["has_special"]);

  const partial: Partial<CardDefinition> = {
    id,
    name,
    filename,
    type,
    rarity: inferRarity(filename),
    baseAttack: parseNumeric(row["attack"]),
    baseHp: parseNumeric(row["hp"]),
    fortressHp: parseNumeric(row["fortress_hp"]),
    attackBuff: parseNumeric(row["attack_buff"]),
    hpBuff: parseNumeric(row["hp_buff"]),
    rulesText,
    hasSpecial,
  };

  const errors = validateCard(partial);

  // Determine automation status:
  //   data_error  — missing required stats per type
  //   not_implemented — has special text we don't handle at M1
  //   fully_implemented — vanilla card, safe to put in decks
  const automationStatus: AutomationStatus =
    errors.length > 0 ? "data_error"
    : hasSpecial ? "not_implemented"
    : "fully_implemented";

  return { ...(partial as CardDefinition), automationStatus };
}

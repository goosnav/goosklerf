/**
 * Runtime validation for card data.
 *
 * Two layers:
 *   1. Zod schema — checks shape and primitive types at the JSON-load boundary.
 *   2. validateCard() — checks per-type structural requirements (e.g. R2.2
 *      entities must have baseAttack and baseHp).
 *
 * Validation deliberately does NOT enforce R2.6 stat-range limits (Attack 1–5,
 * HP 0–6). Those are gameplay invariants, not data invariants — they apply to
 * runtime CardInstance values after buffs/debuffs, not to printed values.
 */

import { z } from "zod";
import type { CardDefinition } from "./types.js";

// Zod schema — kept aligned with CardDefinition. Update both together.
export const CardDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  filename: z.string(),
  type: z.enum(["entity", "fortress", "item_regular", "item_consumable"]),
  rarity: z.enum(["normal", "rare"]),
  baseAttack: z.number().optional(),
  baseHp: z.number().optional(),
  fortressHp: z.number().optional(),
  attackBuff: z.number().optional(),
  hpBuff: z.number().optional(),
  rulesText: z.string(),
  hasSpecial: z.boolean(),
  automationStatus: z.enum(["fully_implemented", "not_implemented", "data_error"]),
});

export const CardDatabaseSchema = z.record(z.string(), CardDefinitionSchema);

/**
 * Per-type structural validation, run during CSV import.
 *
 * Returns a list of error strings; empty list means the card is valid.
 * Cards that fail this check get automationStatus="data_error" and are
 * excluded from deck generation, but they still load — we don't lose the data.
 */
export function validateCard(card: Partial<CardDefinition>): string[] {
  const errors: string[] = [];

  if (!card.id || card.id.trim() === "") errors.push("missing id");
  if (!card.name || card.name.trim() === "") errors.push("missing name");

  if (!card.type) {
    errors.push("missing type");
    return errors; // can't validate further without a type
  }

  // R2.2 / R2.5: entities must declare baseAttack and baseHp.
  if (card.type === "entity") {
    if (card.baseAttack === undefined) errors.push("entity missing baseAttack (R2.2, R2.5)");
    if (card.baseHp === undefined) errors.push("entity missing baseHp (R2.2, R2.5)");
  }

  // R2.3: fortresses must declare fortressHp.
  if (card.type === "fortress") {
    if (card.fortressHp === undefined) errors.push("fortress missing fortressHp (R2.3)");
  }

  // R2.4: items have no additional structural requirements at load time.
  // (attackBuff / hpBuff are optional; a card may be a buffless flavor item.)

  return errors;
}

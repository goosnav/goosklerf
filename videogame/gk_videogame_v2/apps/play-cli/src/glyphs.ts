/**
 * Display glyphs for the CLI render.
 *
 * Centralizing them here means the entire UI shifts together if we change
 * the visual language. Tests can also stub these out for stable snapshots.
 */

import type { CardType } from "@gk/cards";

/** Card-type icons per R2.1. */
export const TYPE_ICON: Record<CardType, string> = {
  entity: "⚔",
  fortress: "🛡",
  item_regular: "🎒",
  item_consumable: "🧪",
};

/** Phase labels (used in headers; R4.1). */
export const PHASE_LABEL: Record<string, string> = {
  card_play: "Card Play",
  combat: "Combat",
  movement: "Movement",
  card_draw: "Card Draw",
  victory_check: "Victory Check",
};

/**
 * D6 face glyphs. Index 0 unused; 1..6 are the faces (R2.5 convention).
 *
 * Used to render an entity's current HP (R2.5: "tracked with a die").
 * Falls back to numeric for HP > 6 (some buffs can push HP out of range).
 */
const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function dieFace(n: number): string {
  if (!Number.isInteger(n)) return String(n);
  if (n < 0) return "0";
  if (n >= DIE_FACES.length) return String(n);
  return DIE_FACES[n] as string;
}

/** Status marker for a card whose printed text is silenced at M1. */
export const TEXT_INACTIVE = "🌀";

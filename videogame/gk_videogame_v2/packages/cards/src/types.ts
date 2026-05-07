/**
 * Card data type definitions.
 *
 * These describe immutable card *definitions* (what's printed on the card).
 * Per-game runtime state (current HP, position, etc.) lives in the engine's
 * CardInstance type — never here.
 *
 * Spec references:
 *   R2.1  card types overview (entity, fortress, item_regular, item_consumable)
 *   R2.2  entity cards
 *   R2.3  fortress cards
 *   R2.4  item cards (regular and consumable)
 *   R2.5  card anatomy and stat values
 *   R2.6  stat limits (Attack 1–5, HP 0–6)
 *   R2.7  capacity limits (3 items/entity, 3 entities/fortress, 5/battlefield)
 */

/** R2.1: there are three card types; items have two subtypes (R2.4). */
export type CardType =
  | "entity"          // R2.2
  | "fortress"        // R2.3
  | "item_regular"    // R2.4 — equipped items (continuous effect)
  | "item_consumable" // R2.4 — consumables (one-time use)
  ;

/** R2.1: each card type has a normal and rare variant; rarity affects shop pricing (R5.5). */
export type Rarity = "normal" | "rare";

/**
 * Whether this card definition's mechanics are realized in the engine yet.
 *
 * - `fully_implemented`: vanilla stats only, or a special whose handler exists. Safe in decks.
 * - `not_implemented`: card has special text we deliberately do not handle yet.
 *   At M1 these are excluded from deck generation. At M2 they return via the ability registry.
 * - `data_error`: card is missing required stats (e.g. an entity with no baseAttack).
 *   Always excluded from decks; treated as a build-time warning, not an error.
 */
export type AutomationStatus =
  | "fully_implemented"
  | "not_implemented"
  | "data_error";

/**
 * A printed card. Immutable; loaded once from cards.generated.json.
 *
 * Validation invariants (enforced by schema.ts):
 *   - entity:   baseAttack and baseHp required (R2.2, R2.5)
 *   - fortress: fortressHp required (R2.3)
 *   - item_*:   no additional required stats (R2.4)
 */
export interface CardDefinition {
  /** Stable slug derived from card name; primary key. */
  id: string;
  /** Display name as printed on the card, e.g. "BUTCHER WORM". */
  name: string;
  /** Image filename for the GUI shells; the CLI doesn't use this. */
  filename: string;
  type: CardType;
  rarity: Rarity;
  /** Entity Attack stat (R2.5). Printed range [1, 5] per R2.6. */
  baseAttack?: number;
  /** Entity HP (R2.5). Printed range [0, 6] per R2.6. */
  baseHp?: number;
  /** Fortress HP (R2.3). Fortresses are destroyed at 0 HP (R7.4). */
  fortressHp?: number;
  /** Item attack buff applied to the equipping entity (R2.4). */
  attackBuff?: number;
  /** Item HP buff (or fortress buff applied to occupants — R3.10). */
  hpBuff?: number;
  /** Raw text printed on the card; not parsed at M1, used by ability registry at M2. */
  rulesText: string;
  /** True if the card has special text. At M1 these cards are still data-loaded but excluded from decks. */
  hasSpecial: boolean;
  automationStatus: AutomationStatus;
}

/** Keyed by card id for O(1) lookup at runtime. */
export type CardDatabase = Record<string, CardDefinition>;

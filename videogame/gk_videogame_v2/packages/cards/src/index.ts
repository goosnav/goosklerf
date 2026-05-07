// Public API for @gk/cards.
// Engine, AI, and apps import from here; never reach into subpaths.

export type {
  CardDefinition,
  CardDatabase,
  CardType,
  Rarity,
  AutomationStatus,
} from "./types.js";

export { CardDefinitionSchema, CardDatabaseSchema, validateCard } from "./schema.js";
export { loadCardDatabase } from "./loader.js";
export { rowToCardDefinition, generateCardId } from "./import.js";
export { parseCsvFile, parseCsvText } from "./csv.js";

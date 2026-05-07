// Public API for @gk/engine.
// Engine consumers (AI, apps, tests) import from here; never reach into subpaths.

export { SeededRng, rngFromState, type RngState } from "./rng.js";

export type {
  // Identifiers
  PlayerId,
  InstanceId,
  // Zones
  ZoneRef,
  // Cards in play
  CardInstance,
  // Players & fortresses
  Player,
  PlayerKind,
  Fortress,
  LandlordStatus,
  // Phase
  Phase,
  // Engagements
  Engagement,
  EngagementKind,
  EngagementSide,
  DamageEvent,
  // Game lifecycle
  Outcome,
  DeckSize,
  // Logging
  LogEntry,
  // Top-level state
  GameState,
} from "./state.js";

export {
  type Result,
  ok,
  err,
  mapResult,
  flatMapResult,
} from "./result.js";

export {
  playerById,
  findPlayer,
  cardById,
  findCard,
  getZoneContents,
  findFortress,
  totalFortressesOnBoard,
  cloneState,
  zoneSize,
} from "./helpers.js";

export {
  setupGame,
  type SetupOptions,
  type PlayerSpec,
  __INTERNAL_SETUP__,
} from "./setup.js";

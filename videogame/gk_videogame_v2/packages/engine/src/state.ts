/**
 * Game state types.
 *
 * This is the canonical shape of a Goosklerf game in progress. The reducer
 * (later sprints) is the only function allowed to construct new GameState
 * values from existing ones; consumers (CLI, AI, sim) read GameState but
 * never mutate it.
 *
 * Every field cites the rulebook requirement(s) it serves. See
 * `docs/SPEC-system.md §3.2` for the normative contract — keep these in sync.
 *
 * Spec references:
 *   R1.4   turn order
 *   R2.x   cards & stat limits
 *   R3.x   zones & core concepts
 *   R4.1   five-phase turn structure
 *   R6.x   combat (engagement state)
 *   R10.x  victory & Old Age
 */

import type { RngState } from "./rng.js";

// -----------------------------------------------------------------------------
// Identifier types
// -----------------------------------------------------------------------------

/**
 * Player identity. Stable across the entire game. Generated at setup as
 * "p1", "p2", … to keep tests readable. Do not assume any particular format —
 * always treat as opaque.
 */
export type PlayerId = string;

/**
 * Per-game card identity. Two physical copies of the same card share a `cardId`
 * (the card definition slug) but each has a unique `instanceId` — that's how
 * we tell "the second BUTCHER WORM in P1's hand" from "the first one on the
 * battlefield."
 */
export type InstanceId = string;

// -----------------------------------------------------------------------------
// Zones (R3.1–R3.5)
// -----------------------------------------------------------------------------

/**
 * A specific location on the table. Used both as a "where this card lives now"
 * pointer (in CardInstance.zone) and as a target for actions like MOVE_ENTITY.
 *
 * Per R3.5 / R5.6, the shop is PER-PLAYER (each player draws their own shop
 * row from their own deck at setup). Other players can see the shop but only
 * the owner may buy from it.
 */
export type ZoneRef =
  | { zone: "battlefield"; ownerId: PlayerId }              // R3.1
  | { zone: "fortress"; ownerId: PlayerId; fortressInstanceId: InstanceId } // R3.2 (suburb)
  | { zone: "suburbs"; ownerId: PlayerId }                  // R3.2 fortress card in a suburb slot
  | { zone: "equipped"; ownerId: PlayerId; entityInstanceId: InstanceId } // R2.7, R3.8 item slot
  | { zone: "hand"; ownerId: PlayerId }                     // R3.4
  | { zone: "deck"; ownerId: PlayerId }                     // R3.4
  | { zone: "graveyard"; ownerId: PlayerId }                // R3.3
  | { zone: "shop"; ownerId: PlayerId };                    // R3.5, R5.6 — owned by one player

// -----------------------------------------------------------------------------
// Card instances
// -----------------------------------------------------------------------------

/**
 * A card in play. The card *definition* (printed stats, type, name) lives in
 * @gk/cards and is referenced by `cardId`. Per-game state — current HP,
 * current zone, equipped items, used/unused — lives here.
 *
 * R3.6 (control) and R3.8 (item ownership) attach to `ownerId`. Ownership
 * NEVER changes during a game — even when a fortress is captured (R6.10),
 * the fortress card itself doesn't move; we track capture via Fortress.ownerId
 * separately.
 */
export interface CardInstance {
  instanceId: InstanceId;
  /** Card definition slug — look up in CardDatabase to get printed stats. */
  cardId: string;
  /** Owning player. Never changes. */
  ownerId: PlayerId;
  /** Current location on the table. */
  zone: ZoneRef;
  /**
   * Current HP for entities and fortresses. For items in hand/deck/graveyard,
   * this is irrelevant and conventionally 0.
   *
   * R7.2: HP persists between combats — it does NOT reset at end of turn.
   * R7.3 / R7.4: an entity at 0 HP is defeated and discarded (with its items);
   * a fortress at 0 HP is destroyed (with its occupants and their items).
   *
   * Range constraint (R2.6): HP ∈ [0, 6] for entities. Some buffs may push HP
   * higher per card text; clamping happens in rule code, not the type system.
   */
  hp: number;
  /**
   * R2.7 capacity: maximum 3 items equipped to an entity. Items here are
   * referenced by their own InstanceId; they live in this entity's "slot"
   * rather than appearing separately on the board.
   */
  equippedItemIds: InstanceId[];
  /**
   * For consumables (R2.4) only — once true, the consumable has been used
   * and is en route to the graveyard. Used to suppress double-fire while
   * the action sequence resolves.
   */
  consumed: boolean;
}

// -----------------------------------------------------------------------------
// Fortresses (R3.2, R6.10)
// -----------------------------------------------------------------------------

/**
 * A fortress slot in a player's suburb. Distinct from the fortress *card*
 * (which is a CardInstance with type=fortress) because:
 *   - capture (R6.10) changes which player controls the slot, but the card
 *     itself is the same printed object — it just answers to a new owner.
 *   - the slot tracks occupancy (R2.7: max 3 entities).
 *
 * Captured fortresses behave like the new owner's own fortresses for all
 * purposes (defenders, Initial Volley eligibility, Landlord counting).
 */
export interface Fortress {
  /** Current controller. Changes on capture (R6.10). */
  ownerId: PlayerId;
  /** The fortress card instance occupying this slot. */
  fortressInstanceId: InstanceId;
  /** Entity instance IDs currently inside. R2.7 cap: 3. */
  occupantIds: InstanceId[];
}

// -----------------------------------------------------------------------------
// Players
// -----------------------------------------------------------------------------

export type PlayerKind = "human" | "ai";

/** R10.7 Old Age counter behavior. */
export type LandlordStatus = {
  /**
   * R10.3: when a player owns every fortress, this flag flips on. They must
   * survive one full round (each other player getting a turn) without losing
   * a fortress to win.
   */
  pending: boolean;
  /** Number of opponent turns remaining before Landlord wins. 0 → check at next victory phase. */
  roundsRemaining: number;
};

export interface Player {
  id: PlayerId;
  name: string;                // display name; not gameplay-relevant
  kind: PlayerKind;
  /**
   * Personality identifier (e.g. "butcher", "landlord"). Required for AI
   * players, null for humans. The actual weight tables live in @gk/ai.
   */
  personality: string | null;

  /** R3.4 — private hand. Order matters for UI but not for game rules. */
  hand: InstanceId[];
  /**
   * R3.4 — face-down draw pile. Top of deck = index 0. Card Draw phase
   * removes from index 0; deck shuffles use SeededRng.shuffle.
   */
  deck: InstanceId[];
  /** R3.3 — discard pile. Append-only during a game. */
  graveyard: InstanceId[];
  /** R3.2 — this player's fortresses. May be empty (no fortresses played yet). */
  suburbs: Fortress[];
  /**
   * R3.5 / R1.5 / R5.6 — this player's shop row. Drawn from this player's
   * deck at setup (3/7/7 cards by deck regime). Visible to everyone but only
   * this player can buy from it (R5.6). Does not refill (R5.7).
   * Empty array if the Shop rule is not active for this game.
   */
  shop: InstanceId[];

  /**
   * R10.7 Old Age: increments at the END of this player's turn, but ONLY if
   * the player did not declare an engagement during this turn. Initial Volley
   * does NOT count as declaring an engagement (it's a reaction). On reaching
   * 3, a random surviving entity is discarded and the counter resets to 0.
   * Range: [0, 3].
   */
  oldAgeCounter: number;

  /** R10.3 Landlord status; see type doc above. */
  landlord: LandlordStatus;

  /**
   * Whether this player declared at least one engagement during their CURRENT
   * turn. Reset to false at start of each of their own turns; checked at end
   * of turn to decide whether oldAgeCounter advances or resets.
   */
  declaredEngagementThisTurn: boolean;
}

// -----------------------------------------------------------------------------
// Phase (R4.1)
// -----------------------------------------------------------------------------

/**
 * The five-phase rotation per R4.1. Each turn advances through these in order.
 *
 *   card_play     R5.x   play 3 or discard down to 3
 *   combat        R6.x   declare zero or more engagements
 *   movement      R8.x   reposition entities (battlefield ↔ fortress, etc.)
 *   card_draw     R9.x   draw 2 random + search 1
 *   victory_check R10.x  Old Age tick + LMS / Landlord / Hamlet checks
 */
export type Phase =
  | "card_play"
  | "combat"
  | "movement"
  | "card_draw"
  | "victory_check";

/**
 * R5.1: Card Play is a quota phase. The player must play exactly 3 cards if
 * legal, otherwise play the maximum legal cards and discard until the quota
 * is met. `startedWith` freezes the hand size at phase entry so later hand
 * mutations do not change the quota mid-phase.
 */
export interface CardPlayState {
  startedWith: number;
  played: number;
  discarded: number;
}

// -----------------------------------------------------------------------------
// Engagement (R6.x)
// -----------------------------------------------------------------------------

export type EngagementKind =
  | "battlefield"        // R6.1 — attacker battlefield entities vs enemy battlefield entities
  | "fortress_assault"   // R6.8 — attackers from battlefield vs one or more enemy fortresses
  | "fortress_barrage";  // R6.21 — fortress(es) of one player engaging fortress(es) of another

export type EngagementSide = "attacker" | "defender";

/**
 * A single damage event recorded during a combat round. Used by Parry (R6.12),
 * which references hits dealt in the *previous* round, and by Last Stand
 * (R6.18) to know what brought an entity to 0.
 */
export interface DamageEvent {
  id: string;                          // unique per engagement
  round: number;                       // 1-indexed round number
  source: "normal" | "supercharged" | "consumable" | "special";
  attackerInstanceId: InstanceId | null; // null for ambient effects
  targetInstanceId: InstanceId;
  amount: number;
}

/**
 * Active engagement state. Lives on GameState while combat is in progress;
 * cleared (set to null) when the engagement ends per R6.6.
 */
export interface Engagement {
  kind: EngagementKind;
  attackerSide: PlayerId;
  defenderSide: PlayerId;
  /** Entities (not fortress cards) currently committed by the attacker. */
  attackerEntityIds: InstanceId[];
  /** Entities currently committed by the defender. */
  defenderEntityIds: InstanceId[];
  /**
   * Fortresses being attacked (assault) or attacking and defending (barrage).
   * Empty for pure battlefield engagements. R6.8: multiple fortresses may be
   * targeted in one assault.
   */
  targetFortressInstanceIds: InstanceId[];
  /** R6.7: each eligible fortress fires Initial Volley at most once before round 1. */
  initialVolleyResolved: boolean;

  /** R6.3 alternating rounds; starts at 1 and increments after both sides act. */
  round: number;
  sideToAct: EngagementSide;

  /**
   * R6.4: each entity gets exactly 1 action per round, +1 per Buy Extra Action
   * purchased (R6.17). Reset at the start of each round.
   */
  actionsRemainingByEntity: Record<InstanceId, number>;

  /**
   * R6.12 Parry needs to reference last round's normal hits. Trimmed to the
   * last 2 rounds at end-of-round to keep size bounded.
   */
  damageHistory: DamageEvent[];

  /**
   * R6.13 Retreat: an entity that declared retreat last round leaves the
   * engagement at end of THIS round if still alive. Tracked by instance id.
   */
  retreatingEntityIds: InstanceId[];

  /**
   * R6.19 Reinforcements: max 1 call per side per round. Reset at start of
   * each round.
   */
  reinforcementsCalledThisRound: Record<EngagementSide, boolean>;
}

// -----------------------------------------------------------------------------
// Outcome (R10.x)
// -----------------------------------------------------------------------------

/**
 * How the game ended. `null` while the game is in progress.
 *
 * R10.5 (special card victories) is M2 territory — we'll add a "special"
 * variant when the ability registry lands.
 */
export type Outcome =
  | { kind: "last_man_standing"; winnerId: PlayerId }   // R10.2
  | { kind: "landlord"; winnerId: PlayerId }            // R10.3
  | { kind: "hamlet" };                                  // R10.4 — loss for everyone

// -----------------------------------------------------------------------------
// Logging
// -----------------------------------------------------------------------------

/**
 * Append-only narration entry. Every state-mutating reducer step produces one
 * or more of these. `rule` cites the requirement that fired (e.g. "R6.5").
 *
 * The CLI renders these as the game log; the simulator emits them as
 * `actions.jsonl` lines.
 */
export interface LogEntry {
  turn: number;
  phase: Phase;
  /** Requirement ID that fired, e.g. "R6.5". Empty string forbidden (see SPEC-system invariant I-8). */
  rule: string;
  actor: PlayerId | "system";
  message: string;
  /** Structured payload for sim/replay. Optional — `message` alone is enough for human reading. */
  data?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Top-level GameState
// -----------------------------------------------------------------------------

export type DeckSize = "small" | "medium" | "large";

export interface GameState {
  /** Original seed used to derive RNG. Stays constant across the game. */
  seed: string;
  /** Snapshotted RNG position; pair with the rest of state for save/load. */
  rngState: RngState;
  /** R1.2 — Small (24), Medium (36), or Large (54). */
  deckSize: DeckSize;
  /** R1.4 — players in turn order. 2..4 entries (invariant I-1). */
  players: Player[];
  /** Whose turn it is right now. */
  activePlayerId: PlayerId;
  /** Current phase within the active player's turn. */
  phase: Phase;
  /** R5.1 progress counters for the current/most recent Card Play phase. */
  cardPlay: CardPlayState;
  /** Increments at the start of each player's turn. Used for Old Age, Landlord countdown, logging. */
  turnNumber: number;

  /**
   * All card instances in the game, keyed by instanceId. The Player.hand /
   * .deck / .graveyard, Fortress.occupantIds, and the battlefield list below
   * all hold instance IDs that index into this map.
   *
   * Design note: keeping cards in one normalized map (instead of inlined into
   * each zone) means ZoneRef updates touch one place and the various zone
   * lists are just ID arrays. This avoids the "duplicated card data" class of
   * bug the v1 codebase suffered from.
   */
  cardsByInstanceId: Record<InstanceId, CardInstance>;

  /** R3.1 — battlefield occupants (entities only). Shared across players. */
  battlefield: InstanceId[];

  /** R6.x — current engagement, or null if not in combat. */
  engagement: Engagement | null;

  /** Append-only narration. Logical history of the game. */
  log: LogEntry[];

  /** Set when the game ends (R10.x). null until then. */
  outcome: Outcome | null;
}

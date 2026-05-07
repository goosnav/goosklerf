/**
 * Game setup — produces the initial GameState from a `(seed, players, deckSize)` triple.
 *
 * Spec references covered here (in order of execution):
 *   R1.2  deck regimes & 3-copy limit
 *   R1.4  first player determination & turn order
 *   R1.5  shop draw at game start (per-player)
 *   R1.3  starting hand of 7 + mulligan
 *
 * Determinism contract:
 *   - All randomness flows through ONE SeededRng instance.
 *   - Player order in the input determines deck-construction order, which means
 *     a different player order yields different decks (because the same RNG
 *     sequence is consumed in different order). This is intentional and
 *     reproducible — same input, same output.
 *
 * What this does NOT do:
 *   - It does not run any phase logic. The game starts in `card_play` phase
 *     for the first player; the next reducer step is up to the caller.
 *   - It does not implement any rule from §5+ (those are later sprints).
 */

import type { CardDatabase, CardDefinition, CardType } from "@gk/cards";
import { SeededRng } from "./rng.js";
import type {
  CardInstance,
  DeckSize,
  Fortress,
  GameState,
  InstanceId,
  Player,
  PlayerId,
  PlayerKind,
} from "./state.js";
import { type Result, ok, err } from "./result.js";

// -----------------------------------------------------------------------------
// Inputs
// -----------------------------------------------------------------------------

export interface PlayerSpec {
  /** Display name. */
  name: string;
  kind: PlayerKind;
  /** Required for AI players, ignored (or null) for humans. */
  personality?: string | null;
}

export interface SetupOptions {
  seed: string;
  /** 2..4 players; order is significant for determinism (see file header). */
  players: PlayerSpec[];
  deckSize: DeckSize;
  cardDatabase: CardDatabase;
  /** Whether the Shop rule (R3.5, R5.5–R5.7) is active. Defaults to true. */
  enableShop?: boolean;
}

// -----------------------------------------------------------------------------
// Regime constants — R1.2
// -----------------------------------------------------------------------------

interface RegimeSpec {
  totalDeckCards: number;
  minEntities: number;
  minFortresses: number;
  minItems: number;
  shopSize: number;       // R1.5: 3 / 7 / 7
}

const REGIMES: Record<DeckSize, RegimeSpec> = {
  small:  { totalDeckCards: 24, minEntities: 5,  minFortresses: 1, minItems: 10, shopSize: 3 },
  medium: { totalDeckCards: 36, minEntities: 10, minFortresses: 2, minItems: 15, shopSize: 7 },
  large:  { totalDeckCards: 54, minEntities: 15, minFortresses: 3, minItems: 25, shopSize: 7 },
};

/** R1.2 max 3 copies per card name. */
const MAX_COPIES_PER_CARD = 3;

/** R1.3 starting hand size. */
const STARTING_HAND_SIZE = 7;

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

/**
 * Build a fully-initialized GameState. Returns Err on illegal inputs (bad
 * player count, missing personality, card pool too small for the regime).
 *
 * On success the state has:
 *   - phase = "card_play", turnNumber = 1
 *   - active player chosen by R1.4 (RNG over the input player list)
 *   - each player has: a shuffled deck (regime-legal), a shop row, a starting
 *     hand of 7 (mulligan applied if needed)
 *   - empty battlefield, no engagement, empty graveyards, no outcome
 */
export function setupGame(opts: SetupOptions): Result<GameState> {
  // ---- Validate inputs ----------------------------------------------------

  if (opts.players.length < 2 || opts.players.length > 4) {
    return err(
      `setupGame: player count must be 2..4 (R1.2 implicit); got ${opts.players.length}`,
    );
  }
  for (const p of opts.players) {
    if (p.kind === "ai" && (p.personality === undefined || p.personality === null)) {
      return err(`setupGame: AI player "${p.name}" has no personality`);
    }
  }

  // ---- Validate the card pool can satisfy this regime ---------------------

  const regime = REGIMES[opts.deckSize];
  const pool = filterPool(opts.cardDatabase);
  const poolCheck = validatePool(pool, regime);
  if (!poolCheck.ok) return poolCheck;

  // ---- Construct the engine: one RNG drives ALL randomness ---------------

  const rng = new SeededRng(opts.seed);
  const enableShop = opts.enableShop ?? true;

  // Counter that hands out unique InstanceIds. Every card instance created in
  // this setup gets `c0001`, `c0002`, ... in creation order. Determinism note:
  // since creation order is itself driven by the RNG (deck construction is
  // randomized), two different seeds produce different bind-orderings — but
  // for the same seed the sequence is identical.
  let nextOrdinal = 0;
  const newInstanceId = (): InstanceId => {
    nextOrdinal += 1;
    return `c${String(nextOrdinal).padStart(4, "0")}`;
  };

  const cardsByInstanceId: Record<InstanceId, CardInstance> = {};
  const players: Player[] = [];

  // ---- Per player: build deck, instantiate, shuffle, draw shop, draw hand,
  // ----            apply mulligan if needed.
  for (let i = 0; i < opts.players.length; i++) {
    const spec = opts.players[i]!;
    const playerId: PlayerId = `p${i + 1}`;

    // R1.2: build a legal deck (CardDefinition[]) for this player
    const deckDefs = buildLegalDeck(rng, pool, regime);

    // Instantiate: each definition becomes a fresh CardInstance with a unique id
    const deckInstances: CardInstance[] = deckDefs.map((def) =>
      instantiateCard(def, playerId, newInstanceId()),
    );
    for (const inst of deckInstances) cardsByInstanceId[inst.instanceId] = inst;

    // Shuffle the deck (R1.2 implicit — random draws presume a shuffled deck)
    const shuffledDeck = rng.shuffle(deckInstances);

    // R1.5: shop is drawn first (before the 7-card hand) — only if enabled.
    let shopIds: InstanceId[] = [];
    let workingDeck = shuffledDeck;
    if (enableShop) {
      const drawn = workingDeck.slice(0, regime.shopSize);
      workingDeck = workingDeck.slice(regime.shopSize);
      shopIds = drawn.map((c) => c.instanceId);
      // Update each shop card's zone reference
      for (const inst of drawn) {
        const updated = cardsByInstanceId[inst.instanceId]!;
        updated.zone = { zone: "shop", ownerId: playerId };
      }
    }

    // R1.3: draw 7 to hand
    let { hand, deckRemainder } = drawHand(workingDeck, STARTING_HAND_SIZE);

    // R1.3: mulligan — if hand contains no entity AND no fortress, shuffle the
    // hand back into the deck and redraw. We do this AT MOST ONCE; if the
    // second draw is also illegal, we accept it. (Rulebook is silent on
    // recursion; one chance keeps determinism predictable.)
    if (!handHasEntityOrFortress(hand, cardsByInstanceId, opts.cardDatabase)) {
      const reshuffled = rng.shuffle([...deckRemainder, ...hand]);
      const redraw = drawHand(reshuffled, STARTING_HAND_SIZE);
      hand = redraw.hand;
      deckRemainder = redraw.deckRemainder;
    }

    // Update zones for hand and deck cards
    for (const inst of hand) {
      cardsByInstanceId[inst.instanceId]!.zone = { zone: "hand", ownerId: playerId };
    }
    for (const inst of deckRemainder) {
      cardsByInstanceId[inst.instanceId]!.zone = { zone: "deck", ownerId: playerId };
    }

    players.push({
      id: playerId,
      name: spec.name,
      kind: spec.kind,
      personality: spec.kind === "ai" ? (spec.personality ?? null) : null,
      hand: hand.map((c) => c.instanceId),
      deck: deckRemainder.map((c) => c.instanceId),
      graveyard: [],
      suburbs: [],
      shop: shopIds,
      oldAgeCounter: 0,
      landlord: { pending: false, roundsRemaining: 0 },
      declaredEngagementThisTurn: false,
    });
  }

  // ---- R1.4: first player determined randomly ---------------------------
  // Note: turn order in the players[] array stays the same as input order.
  // The active player is whoever the RNG picks. Subsequent turns advance
  // through the array (wrap-around).
  const firstPlayerIndex = rng.nextInt(0, players.length);
  const activePlayerId = players[firstPlayerIndex]!.id;

  // ---- Construct GameState ------------------------------------------------

  const state: GameState = {
    seed: opts.seed,
    rngState: rng.getState(),
    deckSize: opts.deckSize,
    players,
    activePlayerId,
    phase: "card_play",
    cardPlay: {
      startedWith: players[firstPlayerIndex]!.hand.length,
      played: 0,
      discarded: 0,
    },
    turnNumber: 1,
    cardsByInstanceId,
    battlefield: [],
    engagement: null,
    log: [
      {
        turn: 1,
        phase: "card_play",
        rule: "R1.4",
        actor: "system",
        message: `Game start. ${players.length} players, ${opts.deckSize} regime. ${players[firstPlayerIndex]!.name} goes first.`,
        data: { firstPlayerIndex, deckSize: opts.deckSize, enableShop },
      },
    ],
    outcome: null,
  };

  return ok(state);
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

/**
 * Filter the card database to cards eligible for M1 deck inclusion.
 *
 * Scope adjustment (2026-05-06): originally we planned to admit only
 * `fully_implemented` (vanilla) cards at M1. But the canonical CSV has ZERO
 * fortresses tagged fully_implemented (every fortress is flagged
 * `has_special: Y`), which would make all regimes unbuildable. So we admit
 * any non-data_error card and IGNORE card text at M1. The printed numeric
 * stats (HP, attack, attackBuff, hpBuff) still drive the engine; the special
 * text returns at M2 via the ability registry.
 *
 * This matches the v1 codebase's behavior. data_error cards (missing required
 * stats) remain excluded.
 */
function filterPool(db: CardDatabase): CardDefinition[] {
  return Object.values(db).filter((c) => c.automationStatus !== "data_error");
}

/** R1.2 sanity: ensure the pool can support the requested regime. */
function validatePool(pool: CardDefinition[], regime: RegimeSpec): Result<void> {
  const byType = countByType(pool);
  if (byType.entity === 0) return err("setupGame: no fully_implemented entities in card pool");
  if (byType.fortress === 0) return err("setupGame: no fully_implemented fortresses in card pool");
  if (byType.item === 0) return err("setupGame: no fully_implemented items in card pool");

  // 3-copy rule means the EFFECTIVE pool size is 3 × distinct cards.
  // Check we can hit each minimum even if every copy is used.
  if (byType.entity * MAX_COPIES_PER_CARD < regime.minEntities) {
    return err(
      `setupGame: pool has ${byType.entity} distinct entities; cannot fill ${regime.minEntities} slots with 3-copy limit`,
    );
  }
  if (byType.fortress * MAX_COPIES_PER_CARD < regime.minFortresses) {
    return err(
      `setupGame: pool has ${byType.fortress} distinct fortresses; cannot fill ${regime.minFortresses} slots`,
    );
  }
  if (byType.item * MAX_COPIES_PER_CARD < regime.minItems) {
    return err(
      `setupGame: pool has ${byType.item} distinct items; cannot fill ${regime.minItems} slots`,
    );
  }

  // Filling the remainder needs enough headroom too.
  const remainder = regime.totalDeckCards - regime.minEntities - regime.minFortresses - regime.minItems;
  if (pool.length * MAX_COPIES_PER_CARD < regime.totalDeckCards) {
    return err(
      `setupGame: pool of ${pool.length} cards × 3 copies = ${pool.length * MAX_COPIES_PER_CARD} < required ${regime.totalDeckCards}`,
    );
  }
  // remainder might pull from any type, so we just need overall headroom; the
  // earlier per-type checks already cover the critical path.
  void remainder;

  return ok(undefined);
}

interface PoolCounts { entity: number; fortress: number; item: number }
function countByType(pool: CardDefinition[]): PoolCounts {
  const c: PoolCounts = { entity: 0, fortress: 0, item: 0 };
  for (const card of pool) {
    if (card.type === "entity") c.entity += 1;
    else if (card.type === "fortress") c.fortress += 1;
    else c.item += 1; // item_regular and item_consumable both count as items here
  }
  return c;
}

/**
 * Build a regime-legal deck of CardDefinitions. Uses two phases:
 *   1) fill the minimums (entities, fortresses, items) — guarantees R1.2 lower bounds
 *   2) fill the remainder from the full pool — anything goes, respecting 3-copy rule
 *
 * The output is unshuffled (in fill order). Caller shuffles before use.
 */
function buildLegalDeck(
  rng: SeededRng,
  pool: CardDefinition[],
  regime: RegimeSpec,
): CardDefinition[] {
  const isEntity = (c: CardDefinition) => c.type === "entity";
  const isFortress = (c: CardDefinition) => c.type === "fortress";
  const isItem = (c: CardDefinition) => c.type !== "entity" && c.type !== "fortress";

  const deck: CardDefinition[] = [];
  const counts = new Map<string, number>();

  pickWithMaxCopies(rng, pool.filter(isEntity),  regime.minEntities,   deck, counts);
  pickWithMaxCopies(rng, pool.filter(isFortress), regime.minFortresses, deck, counts);
  pickWithMaxCopies(rng, pool.filter(isItem),     regime.minItems,      deck, counts);

  const remainder = regime.totalDeckCards - deck.length;
  pickWithMaxCopies(rng, pool, remainder, deck, counts);

  return deck;
}

/**
 * Pick `count` cards from `source` into `into`, respecting MAX_COPIES_PER_CARD.
 * Uses the running `counts` map of "card id → copies in deck so far" to avoid
 * exceeding 3 copies of any one card name (R1.2).
 *
 * Throws if the eligible pool is exhausted before reaching `count` — this is
 * a configuration error (the pool was too small) and indicates `validatePool`
 * missed something. Should not happen given the upstream check.
 */
function pickWithMaxCopies(
  rng: SeededRng,
  source: CardDefinition[],
  count: number,
  into: CardDefinition[],
  counts: Map<string, number>,
): void {
  for (let i = 0; i < count; i++) {
    const eligible = source.filter((c) => (counts.get(c.id) ?? 0) < MAX_COPIES_PER_CARD);
    if (eligible.length === 0) {
      throw new Error(
        `pickWithMaxCopies: ran out of eligible cards (need ${count - i} more from a pool of ${source.length})`,
      );
    }
    const picked = rng.pick(eligible);
    if (!picked) throw new Error("pickWithMaxCopies: rng.pick returned undefined unexpectedly");
    into.push(picked);
    counts.set(picked.id, (counts.get(picked.id) ?? 0) + 1);
  }
}

/** Construct a fresh CardInstance from a CardDefinition. */
function instantiateCard(
  def: CardDefinition,
  ownerId: PlayerId,
  instanceId: InstanceId,
): CardInstance {
  // Initial HP per type:
  //   entity:   def.baseHp (R1.9 / R2.5 — printed HP)
  //   fortress: def.fortressHp (R2.3)
  //   items:    HP is irrelevant; convention 0
  let hp = 0;
  if (def.type === "entity" && def.baseHp !== undefined) hp = def.baseHp;
  else if (def.type === "fortress" && def.fortressHp !== undefined) hp = def.fortressHp;

  return {
    instanceId,
    cardId: def.id,
    ownerId,
    // Initial zone is "deck"; setup will rewrite it for cards drawn into hand or shop.
    zone: { zone: "deck", ownerId },
    hp,
    equippedItemIds: [],
    consumed: false,
  };
}

interface DrawResult { hand: CardInstance[]; deckRemainder: CardInstance[] }

/** Take the first N cards as the hand; the remainder is the deck. */
function drawHand(deck: CardInstance[], n: number): DrawResult {
  return { hand: deck.slice(0, n), deckRemainder: deck.slice(n) };
}

/**
 * R1.3 mulligan check: hand is legal if it contains at least one entity OR
 * fortress. Pure helper — does not mutate.
 */
function handHasEntityOrFortress(
  hand: CardInstance[],
  cardsByInstanceId: Record<InstanceId, CardInstance>,
  cardDatabase: CardDatabase,
): boolean {
  for (const inst of hand) {
    const live = cardsByInstanceId[inst.instanceId];
    if (!live) continue;
    const def = cardDatabase[live.cardId];
    if (!def) continue;
    if (def.type === "entity" || def.type === "fortress") return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Convenience exports for tests
// -----------------------------------------------------------------------------

/** Exposed only to make tests assertion-friendly. */
export const __INTERNAL_SETUP__ = { REGIMES, MAX_COPIES_PER_CARD, STARTING_HAND_SIZE };

/** Re-exported types for callers. */
export type { CardType };

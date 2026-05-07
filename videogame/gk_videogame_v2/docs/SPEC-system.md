# Goosklerf II — System Specification

> **Companion to** `SPEC-rules.md` (the *what*).
> This document defines the *how*: architecture, type contracts, action surface, lifecycle, and invariants.
> Every type, action, and module is traced back to the rule requirement(s) it implements.

## 1. Goals & non-goals

### Goals

- **Rule fidelity above all else.** Every behavior in `SPEC-rules.md` is realized exactly once, in one place, with a citation.
- **Determinism.** Given the same `(seed, player decisions)`, the engine always produces the same state. This makes simulators reproducible and bugs replayable.
- **Pure reducer at the core.** State is data; behavior is pure functions. UI/AI/sim are different shells over the same engine.
- **One engine, four shells.** `play-cli`, `play-gui`, `sim-cli`, `sim-gui` all import `@gk/engine` and never reach across each other.
- **Readable rule traces.** Every action produces a `LogEntry` that names the rule that fired and the dice rolled.

### Non-goals (for M1)

- Animation, art, audio.
- Card text effects (tracked in M2).
- Networked multiplayer.
- Live editing of decks during a game.

## 2. Module map

```
packages/
  cards/    Card schema + CSV import. No game logic. Outputs typed CardDefinition records.
  engine/   Pure rules engine. State, actions, reducer, RNG, victory checks. No I/O.
  ai/       Personality-weighted controller. Reads engine, returns actions. No I/O.
apps/
  play-cli/ Terminal client. Owns I/O, render, prompts. Calls engine + ai.
  ...       (play-gui, sim-cli, sim-gui — later milestones)
```

**Dependency direction is one-way.** `cards ← engine ← ai ← app`. The engine must compile and pass tests with no AI or app code present.

## 3. Type contracts (M1)

The names below are normative. If implementation diverges, update this document first.

### 3.1 Cards (`@gk/cards`)

```ts
type CardType = "entity" | "fortress" | "item_regular" | "item_consumable";
type Rarity = "normal" | "rare";
type AutomationStatus =
  | "fully_implemented"      // vanilla card; engine handles it completely
  | "not_implemented"        // has special text we deliberately ignore at M1
  | "data_error";            // missing required stats; excluded from decks

interface CardDefinition {
  id: string;                // stable slug, e.g. "butcher_worm"
  name: string;              // display name, e.g. "BUTCHER WORM"
  filename: string;          // image filename for future GUI use
  type: CardType;
  rarity: Rarity;            // covers R5.5 shop pricing
  baseAttack?: number;       // entities only; 1..5 (R2.2, R2.5, R2.6)
  baseHp?: number;           // entities only; 0..6 per HP die (R2.2, R2.5, R2.6)
  fortressHp?: number;       // fortresses only
  attackBuff?: number;       // items/fortresses modify entity stats (R2.4, R3.10)
  hpBuff?: number;           // items/fortresses modify entity stats (R2.4, R3.10)
  rulesText: string;         // raw text from card; not parsed at M1
  hasSpecial: boolean;
  automationStatus: AutomationStatus;
}
```

Cards are *definitions*. They are never mutated at runtime. Per-game state lives in `CardInstance` (see 3.2).

### 3.2 Game state (`@gk/engine`)

Core state shape. Every field has a citation comment in the source linking to the requirement it serves.

```ts
interface GameState {
  seed: string;                           // deterministic RNG seed
  rngState: SeededRngState;               // saved RNG position
  deckSize: "small" | "medium" | "large"; // R1.2
  players: Player[];                      // 2..4, ordered by table order (R1.4)
  activePlayerId: PlayerId;
  phase: Phase;                           // R4.1
  cardPlay: {
    startedWith: number;                  // R5.1 hand size at Card Play entry
    played: number;                       // R5.1 cards played this Card Play
    discarded: number;                    // R5.1 cards discarded this Card Play
  };
  turnNumber: number;                     // increments on each player's turn start
  cardsByInstanceId: Record<InstanceId, CardInstance>;
  battlefield: InstanceId[];              // shared zone; filter by owner for per-player cap (R3.1, R2.7)
  engagement: Engagement | null;          // present during Combat phase (R3.7, R6.x)
  log: LogEntry[];                        // append-only narration (R-cite per entry)
  outcome: Outcome | null;                // null until game ends
}

interface Player {
  id: PlayerId;
  name: string;
  kind: "human" | "ai";
  personality: PersonalityId | null;     // null for human
  hand: InstanceId[];                    // R3.4
  deck: InstanceId[];                    // R3.4; top-of-deck = index 0
  graveyard: InstanceId[];               // R3.3
  suburbs: Fortress[];                   // R3.2
  shop: InstanceId[];                    // per-player face-up row (R1.5, R3.5, R5.6)
  oldAgeCounter: number;                 // R10.7
  landlord: {
    pending: boolean;                    // R10.3 first half of two-part trigger
    roundsRemaining: number;             // counts down to landlord victory
  };
  declaredEngagementThisTurn: boolean;   // R10.7 Old Age reset condition
}

interface CardInstance {
  instanceId: string;                    // unique per-game id
  cardId: string;                        // FK into card database
  ownerId: PlayerId;                     // original owner; never changes (R3.8)
  zone: ZoneRef;                         // current location (battlefield, suburbs, equipped, hand, etc.)
  hp: number;                            // current HP for entities; current fortressHp for fortresses
  equippedItemIds: string[];             // entities only; max 3 (R2.7)
  consumed: boolean;                     // consumables that have been used
}

interface Fortress {
  ownerId: PlayerId;                     // changes on capture (R6.10)
  fortressInstanceId: string;            // FK into the fortress card instance
  occupantIds: string[];                 // entity instanceIds; max 3 (R2.7)
}

type Phase =
  | "card_play"      // R4.1 phase 1; R5.x actions
  | "combat"         // R4.1 phase 2; R6.x actions
  | "movement"       // R4.1 phase 3; R8.x actions
  | "card_draw"      // R4.1 phase 4; R9.x actions
  | "victory_check"; // R4.1 phase 5; R10.x checks

interface Engagement {
  kind: "battlefield" | "fortress_assault" | "fortress_barrage";
  attackerSide: PlayerId;
  defenderSide: PlayerId;
  attackerEntityIds: string[];
  defenderEntityIds: string[];
  targetFortressInstanceIds: string[];   // for fortress_assault and fortress_barrage
  initialVolleyResolved: boolean;        // R6.7: each fortress fires at most once
  round: number;                         // R6.3 alternating rounds; starts at 1
  sideToAct: "attacker" | "defender";
  actionsRemainingByEntity: Record<string, number>; // 1 per entity per round, +Extra Actions
  damageHistory: DamageEvent[];          // for Parry (R6.12) — last round's normal hits
}
```

### 3.3 Action surface (current Card Play subset)

Actions are discriminated unions. The reducer is the *only* function allowed to produce a changed `GameState` from an existing `GameState`.

The current engine implements only the Card Play subset below. Later sprints extend this union one phase at a time.

```ts
type Action =
  // Card Play phase (R5.1-R5.4)
  | { kind: "PLAY_CARD"; instanceId: string; placement: PlacementRef }
  | { kind: "DISCARD_CARD"; instanceId: string }
  | { kind: "END_PHASE" };

type PlacementRef =
  | { kind: "battlefield" }                         // entity -> battlefield (R5.2, R5.3)
  | { kind: "fortress"; fortressInstanceId: string } // entity -> own fortress (R5.2, R5.3)
  | { kind: "suburbs" }                             // fortress -> own suburbs (R5.2)
  | { kind: "equip"; entityInstanceId: string };     // item/consumable -> own entity (R5.2-R5.4)
```

Reducers receive an explicit context:

```ts
type ReducerContext = {
  cardDatabase: CardDatabase;
};
```

The context keeps `GameState` small while still making reducer calls deterministic: the card database is immutable input, not hidden process state.

`END_PHASE` advances `card_play -> combat` only when R5.1 is satisfied. R5.5-R5.7 shop purchases are deliberately out of scope until Sprint 13.

Each action's reducer case returns `Result<GameState>` — either a new state or an error explaining which requirement was violated. We never throw for illegal player choices across the engine boundary.

### 3.4 Logging contract

Every state-mutating operation produces one or more `LogEntry` records. Each entry cites the rule requirement that fired:

```ts
interface LogEntry {
  turn: number;
  phase: Phase;
  rule: string;        // e.g. "R6.5"
  actor: PlayerId | "system";
  message: string;     // human-readable narration ("BUTCHER WORM rolled 2 vs Attack 3 — HIT")
  data?: Record<string, unknown>; // structured payload for sim/replay
}
```

This is the substrate for the in-game log, simulator output, and rule-trace debugging.

## 4. Reducer lifecycle

```
setupGame()
   │  setup (R1.2-R1.5)
   ▼
[Active player turn]
   │
   ├──► card_play phase  (R5.1: play 3 if possible, otherwise play max legal + discard)
   │       PLAY_CARD* | DISCARD_CARD* | END_PHASE
   │
   ├──► combat phase  (R6.x: 0 or more engagements)
   │       DECLARE_ENGAGEMENT
   │           ├─► RESOLVE_INITIAL_VOLLEY (R6.7)
   │           ├─► loop: NORMAL_ATTACK | PASS_ACTION (M1) → END_ROUND
   │           └─► END_ENGAGEMENT (auto when one side empty)
   │       END_PHASE
   │
   ├──► movement phase  (R8.x)
   │       MOVE_ENTITY* | END_PHASE
   │
   ├──► card_draw phase  (R9.x)
   │       DRAW_CARDS | END_PHASE
   │
   └──► victory_check phase (R10.x triggers)
           if outcome resolved → game ends
           else → next player's turn
```

## 5. Invariants

These are checked in tests and reducer guards as those rule areas land. Violating any of them is a bug.

| ID | Invariant | Source |
|----|-----------|--------|
| I-1 | `state.players.length` ∈ [2, 4] for the entire game | setup contract |
| I-2 | Every `instanceId` referenced in any zone exists in exactly one zone | type integrity |
| I-3 | A player's `oldAgeCounter` ∈ [0, 3]; reaching 3 triggers and resets | R10.7 |
| I-4 | A fortress has ≤ 3 occupants | R2.7 |
| I-5 | An entity has ≤ 3 equipped items | R2.7 |
| I-6 | A player has ≤ 5 entities on battlefield | R2.7 |
| I-7 | An entity's HP die value stays in [0, 6] unless a card explicitly overrides it | R2.6, R7.2 |
| I-8 | Every `LogEntry` carries a non-empty `rule` field |
| I-9 | The reducer is pure: `reduce(state, action)` never mutates `state` |
| I-10 | The RNG state advances monotonically; no two actions ever consume the same dice |

## 6. Determinism contract

The engine MUST be deterministic. Concretely:

- All randomness flows through `SeededRng`. No `Math.random()` calls anywhere in `@gk/engine` or `@gk/ai`.
- The reducer takes `(state, action, ctx)` and returns `Result<GameState>` with logs embedded in `GameState.log` — no closures over time, no `Date.now()`.
- Card instance IDs are assigned monotonically during deterministic setup; they do not depend on object-map iteration order.
- Object key iteration is never assumed to have an order — sort explicitly when needed.

## 7. Error model

Three failure classes:

| Class | Example | Handling |
|-------|---------|----------|
| **Illegal action** | "PLAY_CARD entity into a full battlefield" | Reducer returns `{ ok: false, error }` with the requirement ID violated; state unchanged |
| **Programming error** | invariant violation, missing card definition | Throw with a stack trace; this is a bug in the engine |
| **Input error** | malformed CSV row at build time | `cards build` fails loudly; the run never produces a JSON output |

Apps and AI must handle illegal actions gracefully — show the user, ask AI to pick another. The engine's job is to *say no clearly*, not to crash.

## 8. Test discipline

Each rule from `SPEC-rules.md` gets a test of the form:

```ts
// covers R6.7 — Initial Volley fires once per fortress per engagement
test("R6.7 — Initial Volley", () => {
  const state = scenarioWithFortressOccupants();
  const after = reduce(state, { kind: "DECLARE_ENGAGEMENT", ... }, { cardDatabase });
  expect(after.value.engagement.initialVolleyResolved).toBe(true);
  expect(after.value.log.filter(e => e.rule === "R6.7")).toHaveLength(N);
});
```

Naming convention: test description starts with `R<id> — <short rule>`. This produces a self-documenting test report and makes it trivial to find which rules are covered.

For multi-rule scenarios, list all the requirements the test exercises:

```ts
// covers R6.3, R6.5, R7.1
test("alternating rounds resolve normal attacks correctly", ...)
```

The transcript harness (Sprint 18) is the integration-test layer above this.

## 9. Where ambiguity goes

If the rulebook is unclear (or the spec extractor flagged "Open questions"), it lives as a `// TODO(spec): R<id> — <question>` in the code and as an entry in `docs/SPEC-rules.md` open-questions section. **Do not guess in code.** Ambiguity must be visible.

## 10. M1 → M5 evolution

This document captures M1 (Classic Goosklerf, special card text silenced). Each subsequent milestone adds:

| Milestone | Adds to system | New types/actions |
|-----------|----------------|-------------------|
| M2 | Special card abilities | `AbilityRegistry`, `AbilityEffect`; per-card-id handlers |
| M3 | `play-gui` | UI components consume engine state; no engine changes |
| M4 | `sim-cli` | Headless runner; emits `actions.jsonl` per game; `replay` reconstructs from logs |
| M5 | `sim-gui` | Browser scrubber over `actions.jsonl` |

Each milestone gets a small amendment to this file plus its own design note in `docs/`.

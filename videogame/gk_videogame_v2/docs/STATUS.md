# Project status — pick up here

**Last updated:** 2026-05-06 (after Sprint 4).
**Active branch context:** `videogame/gk_videogame_v2/` is the active codebase. `videogame/archive/gk_videogame_v1/` is the archived previous attempt (and contains the canonical `card_data-003.csv`).

If you're starting a new session and want to continue work: this file is the entry point. Read top to bottom.

## What this project is

CLI-first digital implementation of **Classic Goosklerf II**, designed for high-fidelity rule playtesting. Goal: produce a videogame engine that satisfies every requirement in `docs/SPEC-rules.md` exactly. Eventual shells (only the first exists today): `play-cli`, `play-gui`, `sim-cli`, `sim-gui`.

Scope: Classic Goosklerf only. Out of scope: Chessklerf, Campaign Mode, Goosklerf I backwards-compat. The rule spec is intentionally narrowed to the videogame's domain.

## Where to start reading

Required reading order for any new session:

1. **`docs/STATUS.md`** (this file) — what is the current state of the world.
2. **`docs/SPEC-rules.md`** — 67 numbered requirements that the engine must satisfy. Source of truth.
3. **`docs/SPEC-system.md`** — type contracts, action surface, invariants, determinism contract.
4. **`AGENTS.md`** (at repo root) — working conventions: citation rule, comment style, anti-patterns.
5. **`docs/TUTORIAL.md`** — how to play Classic Goosklerf, with R-ID citations.
6. **`docs/CHANGELOG.md`** — sprint-by-sprint history.
7. **`/Users/jbs/.claude/plans/i-want-a-rebase-fuzzy-balloon.md`** — sprint plan (the to-do list).

## Current code state

```
videogame/gk_videogame_v2/
├── AGENTS.md                  ✓
├── README.md                  ✓
├── package.json               ✓ pnpm workspace root
├── pnpm-workspace.yaml        ✓
├── tsconfig.base.json         ✓ strict; ES2022; noUncheckedIndexedAccess
├── vitest.config.ts           ✓ workspace aliases for @gk/* in tests
├── docs/
│   ├── README.md              ✓ doc index
│   ├── STATUS.md              ✓ THIS FILE
│   ├── SPEC-rules.md          ✓ 67 R-IDs across 10 Parts (Classic only)
│   ├── SPEC-system.md         ✓ types, action surface, invariants
│   ├── TUTORIAL.md            ✓ player-facing walkthrough
│   └── CHANGELOG.md           ✓ sprint log
├── packages/
│   ├── cards/                 ✓ Sprint 1 complete
│   │   ├── src/types.ts       CardDefinition, CardType, Rarity, AutomationStatus
│   │   ├── src/schema.ts      Zod schema + validateCard()
│   │   ├── src/csv.ts         hand-rolled CSV reader
│   │   ├── src/import.ts      rowToCardDefinition()
│   │   ├── src/build.ts       `pnpm cards:build` → cards.generated.json
│   │   ├── src/loader.ts      loadCardDatabase() with Zod validation
│   │   ├── src/index.ts       public API
│   │   └── data/cards.generated.json   (gitignored; regenerate with build)
│   ├── engine/                ✓ Sprints 2–3 complete: types + RNG + helpers + setup
│   │   ├── src/rng.ts         SeededRng (deterministic; supports save/restore)
│   │   ├── src/state.ts       GameState, Player, CardInstance, Fortress, Engagement, ...
│   │   ├── src/result.ts      Result<T, E> for reducer returns
│   │   ├── src/helpers.ts     pure lookups (playerById, getZoneContents, cloneState, ...)
│   │   ├── src/setup.ts       setupGame() — deck construction, mulligan, shop, first player
│   │   └── src/index.ts       public API
│   └── ai/                    ⬜ later sprints
│       └── src/index.ts       (empty stub)
├── apps/
│   └── play-cli/              ✓ Sprint 4 complete: setup + initial render + readline
│       ├── src/args.ts        flag parser (--seed, --players, --deck-size, --no-shop, ...)
│       ├── src/glyphs.ts      🛡 ⚔ 🎒 🧪, dice faces, 🌀 for silenced text
│       ├── src/render.ts      pure renderHeader/Board/Hand/Shop/Log functions
│       ├── src/commands.ts    inspect/render/help/quit parser; ready for Sprint 5 verbs
│       ├── src/inspect.ts     card definition / instance inspector
│       └── src/main.ts        wires setupGame → renderAll → readline loop
└── tests/
    ├── cards/                 ✓ 26 tests (3 files)
    │   ├── schema.test.ts     (12) — R2.1, R2.2, R2.3, R2.4
    │   ├── import.test.ts     (10) — type normalization, automationStatus state machine
    │   └── build.test.ts      (4)  — end-to-end against the real CSV
    ├── engine/                ✓ 70 tests (3 files)
    │   ├── rng.test.ts        (22) — determinism, ranges, shuffle, weighted pick, save/restore
    │   ├── state.test.ts      (19) — helpers; invariants I-1; zone resolution
    │   └── setup.test.ts      (29) — R1.2 (regimes/minimums/3-copy), R1.3 (hand/mulligan),
    │                                  R1.4 (first player), R1.5 (shop), determinism, validation
    └── play-cli/              ✓ 22 tests (2 files)
        ├── args.test.ts       (12) — flag defaults, parsing, validation
        └── render.test.ts     (10) — section-by-section rendering + full snapshot
```

Total: **118 tests across 8 files.**

## What works right now

**Click-to-run launchers** at `videogame/`:
- macOS: `Play-Goosklerf.command`
- Linux: `play-goosklerf.sh`
- Windows: `Play-Goosklerf.bat` or `Play-Goosklerf.ps1`

Each handles install + card build on first run. See `videogame/HOW-TO-RUN.md`.

**From a terminal:**

```bash
cd videogame/gk_videogame_v2
pnpm install                      # idempotent
pnpm cards:build                  # one-time per CSV change
pnpm test                         # 118 tests pass
pnpm play                         # 4-player game, default seed, medium regime
pnpm play -- --seed alice --players 3 --deck-size large
pnpm play -- --help               # full flag list
```

Current in-game CLI commands: `i N` inspect hand card, `i s N` inspect shop card, `i b N` inspect battlefield entity, `i f N` inspect fortress, `i <card-id>` inspect any card definition, `r` redraw, `?` help, `q` quit.

**Direct engine use:**

```ts
import { setupGame } from "@gk/engine";
import { loadCardDatabase } from "@gk/cards";

const result = setupGame({
  seed: "demo",
  deckSize: "medium",
  cardDatabase: loadCardDatabase(),
  players: [
    { name: "Alice", kind: "human" },
    { name: "Bob",   kind: "ai", personality: "butcher" },
  ],
});
if (result.ok) console.log(result.value); // a fully-initialized GameState
```

Card database breakdown (current build):
- 127 cards loaded (1 duplicate id silently dropped from 128 CSV rows)
- 56 `fully_implemented` (vanilla — eligible for M1 decks)
- 60 `not_implemented` (have special text — excluded from M1 decks; return at M2)
- 11 `data_error` (entities missing baseAttack — always excluded)

## Sprints completed

| ID | What | Reqs covered |
|---|---|---|
| 0 | Archive + scaffold (workspace root, packages, app stub) | — |
| 0.5 | Documentation foundation (specs, AGENTS, tutorial, changelog) | — (sets up R-IDs for citation) |
| 1 | `@gk/cards` package — schema, importer, build, loader | R2.1, R2.2, R2.3, R2.4 |
| 1.5 | Folder relayout + classic-only spec regen + citation realignment | — |
| 2 | `@gk/engine` types + RNG + helpers | R1.4, R2.x, R3.x, R4.1, R6.x (type-level), R7.2, R10.3, R10.7 |
| 3 | `setupGame()` — deck construction, mulligan, shop, first player | R1.2, R1.3, R1.4, R1.5 |
| 4 | CLI shell — args, glyphs, render, main loop. **First user-visible milestone.** | none directly (presentation) |

## Standing scope adjustments

- **M1 deck pool admits `not_implemented` cards** with their special text deliberately silenced. Reason: zero fortresses are tagged `fully_implemented` in the canonical CSV. Printed numeric stats still drive the engine. See [`docs/decisions/0001-card-pool-includes-not-implemented-at-m1.md`](decisions/0001-card-pool-includes-not-implemented-at-m1.md). Reverts naturally at M2 when the ability registry lands.
- **`exactOptionalPropertyTypes` disabled** in `tsconfig.base.json`. Reason: clashes with Zod's `.optional()` inference. We still have `noUncheckedIndexedAccess` and full `strict` mode catching the common bugs.

## Sprint UP NEXT — Sprint 5: Engine Card Play phase

Goal: implement the first real action handler. Players can play and discard cards from their hand during the Card Play phase, with all R5.x constraints enforced. After this sprint the CLI gains real verbs: `play 3 to battlefield`, `discard 2`, etc.

**Reqs to cover:**
- R5.1 — must play exactly 3 cards if possible; otherwise play the maximum legal cards and discard until played + discarded = 3 (or fewer if starting hand has fewer than 3 cards).
- R5.2 — legal placement per card type (entity → battlefield/fortress, fortress → suburbs, item/consumable → equip).
- R5.3 — placement capacity respected (R2.7: ≤5 entities on battlefield, ≤3 occupants per fortress, ≤3 items per entity).
- R5.4 — consumables are equipped during Card Play; they resolve later through Combat's Use a Consumable action and then go to the graveyard.

**Out of scope this sprint:** R5.5–R5.7 (shop purchase). That comes Sprint 13 once core combat is in place. Special card text (R3.9) stays silenced until M2.

**Files to add/modify:**
- `packages/engine/src/actions.ts` — discriminated-union `Action` type. Begin with the Card Play subset only (`PLAY_CARD`, `DISCARD_CARD`, `END_PHASE`); other actions land in their own sprints.
- `packages/engine/src/reducer.ts` — top-level `reduce(state, action) → Result<GameState>`. Dispatches by action.kind to handlers.
- `packages/engine/src/rules/cardPlay.ts` — Card Play handlers. Each function: `(state, action) → Result<GameState>` and emits a LogEntry citing the rule it satisfies.
- `packages/engine/src/log.ts` — helper for appending log entries with R-ID + structured payload (needed by every rule sprint).
- Update `apps/play-cli/src/commands.ts` and `apps/play-cli/src/main.ts` to parse simple commands (`p <n> bf` to play card N to battlefield, `d <n>` to discard, `e` to end phase) and dispatch through the reducer.

**Tests to add:**
- `tests/engine/cardPlay.test.ts`:
  - R5.1: forced-play / forced-discard transitions
  - R5.2: each card type goes to its legal zone; illegal targets rejected
  - R5.3: capacity enforced on battlefield, fortress occupancy, item slots
  - R5.4: consumable can be equipped to an entity and counts as a played card; actual use/consumption stays for Combat
  - illegal-action error messages cite the requirement ID violated
- A few `tests/play-cli/render.test.ts` updates if render needs to surface phase-end state.

**Self-test (gating):** `pnpm test` green. New cardPlay test file fully populated.

**Playtest:** play through a Card Play phase yourself: launch via launcher, type `p 1 bf` to play card #1 to battlefield, etc. Verify capacity errors fire when you over-fill. Equip a consumable to an entity and verify it remains equipped rather than resolving immediately. Watch the log entries cite the R-IDs.

**Stop condition:** Card Play phase plays out end-to-end against AI players that pass-through their phases (real AI Card Play behavior arrives Sprint 11–12 once a few more reducers exist). The phase advances to `combat` (still a no-op stub) when END_PHASE fires.

## How to resume

1. `cd videogame/gk_videogame_v2 && pnpm install && pnpm test` — should be 118/118 green.
2. Read `docs/SPEC-rules.md` Part 5 (R5.1, R5.2, R5.3, R5.4) carefully.
3. Read `docs/SPEC-system.md §3.3` for the action-surface contract — Sprint 5 implements only the Card Play subset of that surface.
4. Look at `apps/play-cli/src/main.ts` — currently it has a tiny readline loop with `q`/`r`/`h`. Sprint 5 expands the command parser.
5. Begin: write `packages/engine/src/actions.ts` first (it's just types), then `reducer.ts` skeleton, then `rules/cardPlay.ts` one rule at a time with tests.

## Standing decisions (don't re-litigate without user input)

- **Cards: vanilla-only at M1.** The 60 `not_implemented` special-text cards return at M2 via a per-card ability registry. Do not regex card text.
- **AI: personality-weighted heuristics.** 4 personalities (butcher, landlord, goblin, accountant) actually drive decisions. No MCTS / lookahead.
- **Shell: CLI-first.** Browser GUI is a later milestone.
- **Determinism mandatory.** No `Math.random()` or `Date.now()` in `engine` or `ai` packages. All randomness via `SeededRng`.
- **Spec-driven.** Code cites R-IDs in comments. Tests use the form `it("R<id> — <description>", ...)`.
- **No basic/advanced split.** All Classic rules (including Old Age, Parry, etc.) are implemented as one body in M1.

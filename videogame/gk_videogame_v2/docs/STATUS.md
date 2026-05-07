# Project status — pick up here

**Last updated:** 2026-05-06 (after Sprint 8 — Movement phase).

**TL;DR:** Click `videogame/Play-Goosklerf.command` (or your OS equivalent). You get Card Play, battlefield Combat, fortress assault/capture/destroy, and Movement. Type `p 1` to auto-play a hand card, `e` to end phases, `decl 1 p2` for battlefield combat, or `assault 1 p2 f1` to attack a fortress. In assaults, use `att a1 f1` to damage a fortress, `att a1 d1` to clear defenders, then `cap f1 a1`, `burn f1`, or `leave f1` to resolve a cleared fortress. During Movement, use `mv b1 f1` to move a battlefield entity into your fortress, `mv f1.1 bf` to move a fortress occupant out, or `mv f1.1 f2` to shift between fortresses. Item and fortress stat buffs affect runtime Attack/max HP, so cards like `GLOVE SOCKS` create real combat durability. AI players take deterministic baseline turns automatically and currently skip Movement. Card Draw and Victory Check are still stubs. **198 tests green**.

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
│   ├── engine/                ✓ Sprints 2–8 complete: setup + Card Play + Combat + Movement
│   │   ├── src/rng.ts         SeededRng (deterministic; supports save/restore)
│   │   ├── src/state.ts       GameState, Player, CardInstance, Fortress, Engagement, ...
│   │   ├── src/result.ts      Result<T, E> for reducer returns
│   │   ├── src/helpers.ts     pure lookups (playerById, getZoneContents, cloneState, ...)
│   │   ├── src/stats.ts       runtime entity stat helpers (item/fortress Attack + HP buffs)
│   │   ├── src/setup.ts       setupGame() — deck construction, mulligan, shop, first player
│   │   ├── src/actions.ts     Action + PlacementRef + EngagementSpec + MovementDestinationRef
│   │   ├── src/reducer.ts     reduce(state, action, { cardDatabase })
│   │   ├── src/log.ts         append-only R-ID log helper
│   │   ├── src/rules/cardPlay.ts   R5.1-R5.4 Card Play handlers
│   │   ├── src/rules/phase.ts      R4.1 phase rotation
│   │   ├── src/rules/combat.ts     R6.1-R6.11, R7.1, R7.3, R7.4 Combat basics + assault
│   │   ├── src/rules/movement.ts   R8.1-R8.2 Movement handlers
│   │   └── src/index.ts       public API
│   └── ai/                    ⬜ later sprints
│       └── src/index.ts       (empty stub)
├── apps/
│   └── play-cli/              ✓ Sprint 8 complete: setup + render + Card Play/Combat/Movement commands
│       ├── src/args.ts        flag parser (--seed, --players, --deck-size, --no-shop, ...)
│       ├── src/glyphs.ts      🛡 ⚔ 🎒 🧪, dice faces, 🌀 for silenced text
│       ├── src/render.ts      pure renderHeader/Board/Hand/Shop/Log functions
│       ├── src/commands.ts    inspect + Card Play + Combat + Movement command parser
│       ├── src/inspect.ts     card definition / instance inspector
│       ├── src/autoplay.ts    deterministic AI/autoplay; AI skips Movement for now
│       └── src/main.ts        wires setupGame → renderAll → reducer dispatch loop
└── tests/
    ├── cards/                 ✓ 26 tests (3 files)
    │   ├── schema.test.ts     (12) — R2.1, R2.2, R2.3, R2.4
    │   ├── import.test.ts     (10) — type normalization, automationStatus state machine
    │   └── build.test.ts      (4)  — end-to-end against the real CSV
    ├── engine/                ✓ 134 tests (7 files)
    │   ├── rng.test.ts        (22) — determinism, ranges, shuffle, weighted pick, save/restore
    │   ├── state.test.ts      (20) — helpers; invariants I-1; zone resolution
    │   ├── setup.test.ts      (29) — R1.2 (regimes/minimums/3-copy), R1.3 (hand/mulligan),
    │   │                              R1.4 (first player), R1.5 (shop), determinism, validation
    │   ├── cardPlay.test.ts   (14) — R5.1-R5.4 plus item/fortress HP-buff current-HP effects
    │   ├── phase.test.ts      (10) — R4.1 phase rotation and active-engagement guard
    │   ├── combat.test.ts     (31) — R6.1-R6.11, R7.1, R7.3, R7.4 combat basics and assault
    │   └── movement.test.ts   (8)  — R8.1-R8.2, R2.7, R3.8, R3.10 movement
    └── play-cli/              ✓ 38 tests (3 files)
        ├── args.test.ts       (12) — flag defaults, parsing, validation
        ├── commands.test.ts   (16) — Card Play + Combat/assault + Movement command parsing
        └── render.test.ts     (10) — section-by-section rendering + full snapshot
```

Total: **198 tests across 13 files.**

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
pnpm test                         # 198 tests pass
pnpm play                         # 4-player game, default seed, medium regime
pnpm play -- --seed alice --players 3 --deck-size large
pnpm play -- --help               # full flag list
```

Current in-game CLI commands: `p N` auto-play if placement is unambiguous, `p N bf` play card N to battlefield, `p N f M` play card N into fortress M, `p N s` play fortress N to suburbs, `p N e M` equip item/consumable N to entity M, `d N` discard, `e` end phase, `decl A pN` declare a battlefield engagement, `assault A pN fM[,fK]` declare a fortress assault, `att aN dM` / `att dM aN` normal attack entities, `att aN fM` attack a target fortress, `pass aN` / `pass dN` pass, `cap fN aM[,aK]` capture a cleared fortress, `burn fN` destroy a cleared fortress, `leave fN` leave a cleared fortress under current control, `mv bN fM` move a battlefield entity into your fortress, `mv fM.N bf` move a fortress occupant to battlefield, `mv fM.N fK` shift between your fortresses, `i N` inspect hand card, `i s N` inspect shop card, `i b N` inspect battlefield entity, `i f N` inspect fortress, `i <card-id>` inspect any card definition, `r` redraw, `?` help, `q` quit.

Stat display: the board and engagement panel show buffed stats when active. Example: `ATK:5 (+2)` means printed Attack plus live item/fortress buffs; `HP:⚃/5` means 4 current HP out of 5 modified max HP. Use `i b N` or `i f N` to inspect a live card and see current vs printed Attack/max HP.

**Direct engine use:**

```ts
import { entityStats, reduce, setupGame } from "@gk/engine";
import { loadCardDatabase } from "@gk/cards";

const cardDatabase = loadCardDatabase();
const result = setupGame({
  seed: "demo",
  deckSize: "medium",
  cardDatabase,
  players: [
    { name: "Alice", kind: "human" },
    { name: "Bob",   kind: "ai", personality: "butcher" },
  ],
});
if (result.ok) {
  const state = result.value;
  const active = state.players.find((p) => p.id === state.activePlayerId)!;
  const firstEntity = active.hand.find((id) => {
    const inst = state.cardsByInstanceId[id]!;
    return cardDatabase[inst.cardId]?.type === "entity";
  });
  if (firstEntity) {
    console.log(reduce(
      state,
      { kind: "PLAY_CARD", instanceId: firstEntity, placement: { kind: "battlefield" } },
      { cardDatabase },
    ));
    const inst = state.cardsByInstanceId[firstEntity]!;
    console.log(entityStats(state, inst, cardDatabase));
  }
}
```

Card database breakdown (current build):
- 127 cards loaded (1 duplicate id silently dropped from 128 CSV rows)
- 56 `fully_implemented` (vanilla or implemented text)
- 60 `not_implemented` (have special text; text is silenced at M1 but the cards remain deck-eligible)
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
| 5 | Engine Card Play phase + CLI play/discard/end verbs | R5.1, R5.2, R5.3, R5.4 |
| 5.5 | Loopable CLI: full phase rotation + deterministic AI Card Play/autoplay | R4.1 |
| 6 | Combat basics: battlefield declaration, staging, Initial Volley, alternating rounds, Normal Attack, defeat | R6.1, R6.2, R6.3, R6.4, R6.5, R6.6, R6.7, R7.1, R7.3, R3.10 |
| 6.5 | Stat-buff fidelity: item/fortress Attack and HP buffs share one runtime stat path | R2.4, R2.6, R3.10, R6.2, R6.5, R7.1 |
| 7 | Fortress assault: declare, target fortress/defenders, capture, destroy, cleanup | R6.8, R6.9, R6.10, R6.11, R7.4 |
| 8 | Movement phase: battlefield -> fortress, fortress -> battlefield, fortress -> fortress; items stay attached; fortress HP buffs update immediately | R8.1, R8.2, R2.7, R3.8, R3.10 |

## Standing scope adjustments

- **M1 deck pool admits `not_implemented` cards** with their special text deliberately silenced. Reason: zero fortresses are tagged `fully_implemented` in the canonical CSV. Printed numeric stats still drive the engine. See [`docs/decisions/0001-card-pool-includes-not-implemented-at-m1.md`](decisions/0001-card-pool-includes-not-implemented-at-m1.md). Reverts naturally at M2 when the ability registry lands.
- **`exactOptionalPropertyTypes` disabled** in `tsconfig.base.json`. Reason: clashes with Zod's `.optional()` inference. We still have `noUncheckedIndexedAccess` and full `strict` mode catching the common bugs.

## Sprint UP NEXT — Sprint 9: Card Draw phase

Goal: implement the Card Draw phase so a turn can replenish the active player's hand according to the classic draw rule instead of auto-skipping from Movement to Victory Check.

**Reqs to cover:**
- R9.1 — draw 2 random cards plus search for 1 card.
- R9.2 — empty deck / insufficient deck handling.
- R3.4 — hand/deck zone integrity.

**Out of scope this sprint:** Victory Check, shop purchases, Parry/Retreat/Supercharge/Reinforcements/Scavenge/Barrage, and special card text.

**Likely files to add/modify:**
- Add a draw action to `packages/engine/src/actions.ts`.
- Add `packages/engine/src/rules/cardDraw.ts`.
- Wire the reducer and CLI command parser/dispatcher.
- Decide the CLI interaction for the "search 1" choice: likely render eligible deck cards with stable indices, then accept a command like `draw N` or `search N`.
- Keep RNG deterministic for the 2 random draws via saved `rngState`.

**Tests to add:**
- `tests/engine/cardDraw.test.ts`:
  - draws 2 random cards from deck to hand.
  - searched card moves from deck to hand.
  - deck order / RNG call count is deterministic.
  - short deck draws only available cards and logs R9.2 behavior.

**Self-test (gating):** `pnpm test`, `pnpm typecheck`, and one CLI smoke through Movement into Card Draw once Card Draw commands exist.

**Playtest:** complete a full human turn through Card Play -> Combat -> Movement -> Card Draw, verify hand/deck counts, then let AI rotate back to the human.

## How to resume

1. `cd videogame/gk_videogame_v2 && pnpm install && pnpm test` — should be 198/198 green.
2. Read `docs/SPEC-rules.md` R9.1-R9.2 plus R3.4.
3. Read `packages/engine/src/rules/cardPlay.ts`, `packages/engine/src/rules/phase.ts`, and `packages/engine/src/rng.ts` for zone movement, phase ending, and deterministic random draw patterns.
4. Start with Card Draw tests, then action type and reducer changes, then CLI syntax.

## Standing decisions (don't re-litigate without user input)

- **Cards: text-silenced at M1.** `not_implemented` special-text cards are deck-eligible, but their text is ignored until M2 via a per-card ability registry. Do not regex card text.
- **AI: personality-weighted heuristics.** 4 personalities (butcher, landlord, goblin, accountant) actually drive decisions. No MCTS / lookahead.
- **Shell: CLI-first.** Browser GUI is a later milestone.
- **Determinism mandatory.** No `Math.random()` or `Date.now()` in `engine` or `ai` packages. All randomness via `SeededRng`.
- **Spec-driven.** Code cites R-IDs in comments. Tests use the form `it("R<id> — <description>", ...)`.
- **No basic/advanced split.** All Classic rules (including Old Age, Parry, etc.) are implemented as one body in M1.

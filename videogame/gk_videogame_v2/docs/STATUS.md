# Project status — pick up here

**Last updated:** 2026-05-06 (after Sprint 5.5 — game is now loopable end-to-end).

**TL;DR:** Click `videogame/Play-Goosklerf.command` (or your OS equivalent). You get a real Card Play turn — type `p 1` to auto-play your first hand card, `i 3` to inspect, `d 4` to discard (only when no legal play remains), `e` to end your phase. AI players take their full turns automatically. After human turn ends, all stub phases advance and the next human Card Play turn begins. **148 tests green**.
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
│   ├── engine/                ✓ Sprints 2–5 complete: setup + Card Play reducer
│   │   ├── src/rng.ts         SeededRng (deterministic; supports save/restore)
│   │   ├── src/state.ts       GameState, Player, CardInstance, Fortress, Engagement, ...
│   │   ├── src/result.ts      Result<T, E> for reducer returns
│   │   ├── src/helpers.ts     pure lookups (playerById, getZoneContents, cloneState, ...)
│   │   ├── src/setup.ts       setupGame() — deck construction, mulligan, shop, first player
│   │   ├── src/actions.ts     Action + PlacementRef (Sprint 5 subset)
│   │   ├── src/reducer.ts     reduce(state, action, { cardDatabase })
│   │   ├── src/log.ts         append-only R-ID log helper
│   │   ├── src/rules/cardPlay.ts   R5.1-R5.4 Card Play handlers
│   │   └── src/index.ts       public API
│   └── ai/                    ⬜ later sprints
│       └── src/index.ts       (empty stub)
├── apps/
│   └── play-cli/              ✓ Sprint 5 complete: setup + render + Card Play commands
│       ├── src/args.ts        flag parser (--seed, --players, --deck-size, --no-shop, ...)
│       ├── src/glyphs.ts      🛡 ⚔ 🎒 🧪, dice faces, 🌀 for silenced text
│       ├── src/render.ts      pure renderHeader/Board/Hand/Shop/Log functions
│       ├── src/commands.ts    inspect + Card Play command parser
│       ├── src/inspect.ts     card definition / instance inspector
│       └── src/main.ts        wires setupGame → renderAll → reducer dispatch loop
└── tests/
    ├── cards/                 ✓ 26 tests (3 files)
    │   ├── schema.test.ts     (12) — R2.1, R2.2, R2.3, R2.4
    │   ├── import.test.ts     (10) — type normalization, automationStatus state machine
    │   └── build.test.ts      (4)  — end-to-end against the real CSV
    ├── engine/                ✓ 83 tests (4 files)
    │   ├── rng.test.ts        (22) — determinism, ranges, shuffle, weighted pick, save/restore
    │   ├── state.test.ts      (20) — helpers; invariants I-1; zone resolution
    │   ├── setup.test.ts      (29) — R1.2 (regimes/minimums/3-copy), R1.3 (hand/mulligan),
    │   │                              R1.4 (first player), R1.5 (shop), determinism, validation
    │   └── cardPlay.test.ts   (12) — R5.1, R5.2, R5.3, R5.4 reducer behavior
    └── play-cli/              ✓ 27 tests (3 files)
        ├── args.test.ts       (12) — flag defaults, parsing, validation
        ├── commands.test.ts   (5)  — Card Play command parsing
        └── render.test.ts     (10) — section-by-section rendering + full snapshot
```

Total: **136 tests across 10 files.**

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
pnpm test                         # 136 tests pass
pnpm play                         # 4-player game, default seed, medium regime
pnpm play -- --seed alice --players 3 --deck-size large
pnpm play -- --help               # full flag list
```

Current in-game CLI commands: `p N bf` play card N to battlefield, `p N f M` play card N into fortress M, `p N s` play fortress N to suburbs, `p N e M` equip item/consumable N to entity M, `d N` discard, `e` end phase, `i N` inspect hand card, `i s N` inspect shop card, `i b N` inspect battlefield entity, `i f N` inspect fortress, `i <card-id>` inspect any card definition, `r` redraw, `?` help, `q` quit.

**Direct engine use:**

```ts
import { reduce, setupGame } from "@gk/engine";
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

## Standing scope adjustments

- **M1 deck pool admits `not_implemented` cards** with their special text deliberately silenced. Reason: zero fortresses are tagged `fully_implemented` in the canonical CSV. Printed numeric stats still drive the engine. See [`docs/decisions/0001-card-pool-includes-not-implemented-at-m1.md`](decisions/0001-card-pool-includes-not-implemented-at-m1.md). Reverts naturally at M2 when the ability registry lands.
- **`exactOptionalPropertyTypes` disabled** in `tsconfig.base.json`. Reason: clashes with Zod's `.optional()` inference. We still have `noUncheckedIndexedAccess` and full `strict` mode catching the common bugs.

## Sprint UP NEXT — Sprint 6: Engine Combat basics

Goal: implement the first Combat reducer path: engagement declaration, Initial Volley, alternating rounds, Normal Attack, pass/end-round flow, and engagement cleanup. This is the next major rules sprint after Card Play.

**Reqs to cover:**
- R6.1 — engagement declaration.
- R6.2 — combat staging.
- R6.3 — alternating combat rounds.
- R6.4 — combat action menu / one action per entity per round.
- R6.5 — Normal Attack.
- R6.6 — engagement end.
- R6.7 — Initial Volley fires once per eligible fortress.
- R7.1 — damage application.
- R7.3 — entity defeat and attached-item discard.
- R3.10 — fortress buffs to occupants.

**Out of scope this sprint:** fortress capture/destroy details from R6.8-R6.11, Parry/Retreat/Supercharge/Reinforcements/Scavenge/Barrage, Movement, Draw, and Victory Check. Those are later sprints.

**Likely files to add/modify:**
- Extend `packages/engine/src/actions.ts` with Combat actions.
- Extend `packages/engine/src/reducer.ts` dispatch.
- Add `packages/engine/src/rules/combat.ts` for declaration, volley, normal attack, round flow, and engagement cleanup.
- Add deterministic dice usage through `SeededRng` / `rngFromState`.
- Update CLI commands once the minimal Combat action path exists.

**Tests to add:**
- `tests/engine/combat.test.ts`:
  - R6.1/R6.2: legal declaration and staged attackers/defenders.
  - R6.3/R6.4: alternating rounds and action counts.
  - R6.5/R7.1: Normal Attack hit/miss and damage.
  - R6.6/R7.3: defeated entities and items go to graveyard; engagement ends when a side is empty.
  - R6.7: Initial Volley eligibility and fires-once behavior.
  - R3.10: fortress occupant HP buffs affect occupants during combat.

**Self-test (gating):** `pnpm test`, `pnpm typecheck`, and at least one CLI smoke through Card Play into Combat.

**Playtest:** create or seed a state with entities on both sides, run one engagement, verify the log cites R6/R7 IDs and HP persists after damage.

## How to resume

1. `cd videogame/gk_videogame_v2 && pnpm install && pnpm test` — should be 136/136 green.
2. Read `docs/SPEC-rules.md` Part 6 and Part 7, especially R6.1-R6.7 and R7.1/R7.3.
3. Read `docs/SPEC-system.md §4` for reducer lifecycle and the existing Engagement state shape.
4. Start with action types, then reducer dispatch, then focused `combat.test.ts` cases before broad CLI wiring.

## Standing decisions (don't re-litigate without user input)

- **Cards: text-silenced at M1.** `not_implemented` special-text cards are deck-eligible, but their text is ignored until M2 via a per-card ability registry. Do not regex card text.
- **AI: personality-weighted heuristics.** 4 personalities (butcher, landlord, goblin, accountant) actually drive decisions. No MCTS / lookahead.
- **Shell: CLI-first.** Browser GUI is a later milestone.
- **Determinism mandatory.** No `Math.random()` or `Date.now()` in `engine` or `ai` packages. All randomness via `SeededRng`.
- **Spec-driven.** Code cites R-IDs in comments. Tests use the form `it("R<id> — <description>", ...)`.
- **No basic/advanced split.** All Classic rules (including Old Age, Parry, etc.) are implemented as one body in M1.

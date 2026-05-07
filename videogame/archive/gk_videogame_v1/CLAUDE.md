# Goosklerf II Digital — Project Status

## Overview
Offline desktop card game (Goosklerf II Classic Mode). Electron + React renderer + shared TypeScript rules engine + headless AI simulator.

## Project Location
`videogame/goosklerf-digital/` — pnpm monorepo

## Quick Commands

```bash
cd videogame/goosklerf-digital

# Build card database from CSV (one-time after fresh clone, or whenever CSV changes)
pnpm build:cards

# Run the test suite
pnpm test

# Run a headless simulator batch
pnpm sim -- --games 50 --players 4 --seed my-seed --out apps/simulator/reports/run1

# Start the React dev server (browser at http://127.0.0.1:5173)
pnpm dev

# Build production desktop bundle (Vite static + Electron main)
cd apps/desktop && pnpm build
```

## Implementation Status

### Core gameplay — IMPLEMENTED
| Area | Status | Reference |
|------|--------|-----------|
| Monorepo scaffold (pnpm workspaces) | done | `pnpm-workspace.yaml` |
| Card import pipeline (CSV → JSON) | done | `apps/card-tools/src/buildCardDb.ts` |
| Card validation | done | `packages/cards/src/cardSchema.ts` |
| Deterministic seeded RNG | done | `packages/engine/src/rng/rng.ts` |
| GameState types | done | `packages/engine/src/state/gameState.ts` |
| Deck generation (Small/Medium/Large legal decks) | done | `packages/engine/src/rules/deckGeneration.ts` |
| Game initialization (hands/shops/decks) | done | `packages/engine/src/rules/gameSetup.ts` |
| Action reducer | done | `packages/engine/src/reducers/gameReducer.ts` |
| `PLAY_CARD` (entity, fortress, item, consumable) | done | `gameReducer.ts:97-159` |
| `DISCARD_CARD` | done | `gameReducer.ts:62-88` |
| `EQUIP_ITEM` | done | `gameReducer.ts:161-168` |
| `NORMAL_ATTACK` (1d6 vs Attack) | done | `gameReducer.ts:170-286` |
| `MOVE_ENTITY` (battlefield ↔ fortress) | done | `gameReducer.ts:288-319` |
| `DRAW_CARDS` | done | `gameReducer.ts:321-337` |
| `END_PHASE` (5-phase rotation) | done | `phaseReducers.ts:8-10` |
| Fortress capture (assault & clear-defenders) | done | `gameReducer.ts:226-249` |
| Victory: Last Man Standing | done | `runtime.ts:445-448` |
| Victory: Landlord (with survival round) | done | `runtime.ts:455-463`, `phaseReducers.ts:72-73` |
| Victory: Hamlet | done | `runtime.ts:449-452` |
| AI controller (turn-by-turn play / move / attack) | done | `packages/ai/src/aiController.ts` |
| Headless simulator CLI | done | `apps/simulator/src/cli.ts` |
| Sim-viewer GUI (read sim outputs) | done | `apps/sim-viewer/` |
| Electron/React shell (MainMenu, NewGameSetup, TableScreen) | done | `apps/desktop/src/screens/` |
| Vitest suite | 43 tests passing | `tests/` |

### Advanced rulebook features — STATUS PER SECTION

The rulebook (`/rulebook/goosklerf_ii_rulebook_v6_final.txt`) splits into Core (§1–12) and Advanced (§13–24). Advanced rules are layered over Core:

| Section | Rule | Status |
|---------|------|--------|
| §10 | Initial Volley | not yet implemented |
| §13 | Shop (buying from shop) | not yet implemented (shop zone exists for setup; purchase action absent) |
| §14 | Old Age | tracked field exists but never advances (`gameSetup.ts:127`) |
| §15 | Parry | not yet implemented |
| §16 | Retreat | not yet implemented |
| §17 | Item Swap | not yet implemented |
| §18 | Healing (combat-time roll-to-heal) | not yet implemented |
| §19 | Supercharged Attack | not yet implemented |
| §20 | Buy Extra Action | not yet implemented |
| §21 | Last Stand | not yet implemented |
| §22 | Reinforcements | not yet implemented |
| §23 | Scavenger | not yet implemented |
| §24 | Fortress Barrage | not yet implemented |
| — | `DECLARE_ENGAGEMENT` action | type defined (`actionTypes.ts:22-27`) but reducer case missing |

Most advanced rules require restructuring combat into explicit alternating rounds with attacker/defender turns. The current engine resolves combat as discrete `NORMAL_ATTACK` actions, which is sufficient for Basic Goosklerf (rulebook §982: *"In Basic Goosklerf, ignore [Advanced Rules]"*).

### GUI — STATUS

| Area | Status |
|------|--------|
| MainMenu screen | done |
| NewGameSetup (player count, seed) | done |
| TableScreen (board, controls, hand/shop/log tray, card inspector) | done |
| AI auto-play in TableScreen (350ms turn delay) | done |
| Card image rendering | done (images live in `apps/desktop/public/cards/`) |
| Electron main process (`electron/main.ts`) | written, **not built** — no `tsc` step compiles it to `.js` |
| Electron preload (`electron/preload.ts`) | placeholder (`gkApi.version` only) |
| Electron IPC for save/load | not yet implemented |
| Save/load | not yet implemented |
| Drag-and-drop | not yet implemented (interaction is click-select-click) |
| Keyboard shortcuts | not yet implemented |
| Toast/error UX | plain inline red text |

## Card Database Facts
- Source: `videogame/card_data-003.csv` (128 cards)
- Generated: `packages/cards/data/generated/cards.generated.json`
- Valid: 117 | Invalid: 11 | Special (`not_implemented`): 65
- Invalid cards = 11 entities missing `attack` in CSV. Excluded automatically from deck generation. Fill in `attack` and re-run `pnpm build:cards` to include them.

Missing-attack entities: `billy_is_stranded, just_a_happy_guy, jimmy_two_hats, lord_flumpuqat, snail_rider, sneefus, wormson_wormley, bionicus_brunkle, cybertoade, imposter_kite, jeremy_wormfield`.

## Simulator baseline
Most-recent recorded baseline: `apps/simulator/reports/fortress-fix-2/summary.json` — 50 games, 4 players, Medium deck:
- 39 winners (78%), 11 max-turn stops (22%), 0 errors
- Mean ~127 turns; fortress capture rate 36.9%
- Victory split: 38 Landlord, 1 Last Man Standing, 11 inconclusive

## Architecture
```
packages/
  shared/   — constants, errors, Result type, ID utils (browser + Node)
  cards/    — CardDefinition, schema validator, static JSON loader
  engine/   — SeededRng, GameState, deckGeneration, gameSetup, reducer, runtime
  ai/       — personality data, RandomLegalAiController

apps/
  card-tools/   — CSV import pipeline (`pnpm build:cards`)
  simulator/    — headless CLI (tsx + commander)
  sim-viewer/   — Vite browser app for inspecting sim run JSON/CSV
  desktop/      — Vite 5 + React 18 + Electron 30
```

## Tech Stack
- TypeScript 5, pnpm 9 workspaces, Node.js 22
- Vite 5 + React 18 + Electron 30 (desktop)
- Vitest 2 (tests)
- seedrandom (deterministic RNG)
- commander (simulator CLI)
- tsx (direct TS execution for CLI tools)

## Roadmap to Shippable
1. Build pipeline for Electron main/preload (currently broken — no `tsc` step)
2. Wire Electron IPC for save/load (`game:save`, `game:load`, `game:list-saves`)
3. Implement Advanced rules: DECLARE_ENGAGEMENT, Initial Volley, Shop, Old Age, Healing, Scavenger
4. Restructure combat into alternating rounds for Parry, Retreat, Supercharged Attack, Last Stand, Reinforcements, Fortress Barrage
5. Decompose `TableScreen.tsx` into per-section files; add keyboard shortcuts and toast notifications
6. Add drag-and-drop with dnd-kit (optional polish)
7. Final manual playthrough in packaged Electron app: full game start to victory, save mid-game, reload, resume identical

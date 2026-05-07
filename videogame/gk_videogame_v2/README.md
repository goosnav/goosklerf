# Goosklerf

CLI-first digital implementation of **Classic Goosklerf II**, designed for high-fidelity rule playtesting.

> If you're picking up this project mid-flight, start with [`docs/STATUS.md`](docs/STATUS.md). It tells you exactly where we are and what comes next.

## Layout

```
packages/
  cards/   card schema, CSV import, generated card database
  engine/  game state, reducers, rules, RNG  (in progress)
  ai/      personality-weighted AI controller (later)
apps/
  play-cli/  human + AI terminal client (M1 deliverable)
tests/
  cards/        per-rule fidelity tests for the card pipeline
  rules/        per-rule fidelity tests for the engine (later)
  transcripts/  scripted-game golden tests (later)
docs/
  SPEC-rules.md   formal classic-only requirements (67 R-IDs)
  SPEC-system.md  architecture, type contracts, invariants
  TUTORIAL.md     how to play
  CHANGELOG.md    sprint log
  STATUS.md       live project state — start here
```

The canonical card CSV lives outside this tree at `../archive/gk_videogame_v1/card_data-003.csv`.

## Quickstart

```bash
pnpm install
pnpm cards:build   # generate packages/cards/data/cards.generated.json from CSV
pnpm test          # run all rule-fidelity tests
pnpm play          # launch the render-only CLI; real game actions start in Sprint 5
```

## Project conventions

- **Rule fidelity is paramount.** Every piece of code cites the requirement IDs from `docs/SPEC-rules.md` it satisfies (e.g. `// covers R6.7: Initial Volley`).
- **Determinism required** in `@gk/engine` and `@gk/ai`. No `Math.random()` or `Date.now()` allowed.
- **Pure reducer.** Game state mutations happen only inside the engine reducer.
- **Tests cite R-IDs.** Test names take the form `R<id> — <description>`.

See [`AGENTS.md`](AGENTS.md) for the full set of working conventions, anti-patterns, and the open-question protocol.

## Status

In active development. See [`docs/CHANGELOG.md`](docs/CHANGELOG.md) for sprint-by-sprint progress and [`docs/STATUS.md`](docs/STATUS.md) for what's happening right now.

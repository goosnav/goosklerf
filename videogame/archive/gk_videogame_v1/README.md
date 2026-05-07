# Goosklerf II — Digital

Offline desktop card game and headless simulator for **Goosklerf II Classic Mode**.

## Quick start

| OS       | Play the game                         | Run the simulator                       |
|----------|---------------------------------------|-----------------------------------------|
| macOS    | Double-click `Run-Goosklerf.command`  | Double-click `Run-Simulator.command`    |
| Linux    | `./run-goosklerf.sh`                  | `./run-simulator.sh`                    |
| Windows  | Double-click `Run-Goosklerf.bat`      | Double-click `Run-Simulator.bat`        |

The first run installs dependencies (`pnpm install`) automatically. Node 20+ and `pnpm` (via `corepack enable`) are the only prerequisites.

## Repo layout

```
videogame/
├── README.md               ← you are here
├── CLAUDE.md               ← project status / contributor notes
├── card_data-003.csv       ← canonical card source (read by card-tools)
├── docs/                   ← TUTORIAL, simulator quickstart, specs, history
├── helpers/                ← OCR scripts used to digitize the original card art
├── ref/                    ← rulebook v6 final
├── goosklerf-digital/      ← pnpm monorepo with the actual code
└── Run-*                   ← double-click launchers (.command / .bat / .sh)
```

The monorepo workspaces:

```
goosklerf-digital/
├── apps/
│   ├── card-tools/         CSV → cards.generated.json pipeline
│   ├── desktop/            Vite + React + Electron — the playable game
│   ├── sim-viewer/         Vite browser app for inspecting simulator runs
│   └── simulator/          Headless tsx/commander CLI batch runner
└── packages/
    ├── ai/                 AI controller + personalities
    ├── cards/              CardDefinition types, schema validator, JSON loader
    ├── engine/             Game state, reducer, RNG, rules
    └── shared/             Constants, errors, Result type, ID utils
```

## Documentation

See [`docs/`](./docs):

- [TUTORIAL](./docs/TUTORIAL.md) — how to play, screen-by-screen
- [SIMULATOR_QUICKSTART](./docs/SIMULATOR_QUICKSTART.md) — running batch sims
- [PROJECT_REPORT](./docs/PROJECT_REPORT.md) — historical status snapshot
- [specs](./docs/specs.md) — the original videogame spec document

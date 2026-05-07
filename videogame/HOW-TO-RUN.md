# How to play Goosklerf — click-to-run

This folder ships four launchers. Use the one that matches your operating system.

| OS | Launcher | How to run |
|---|---|---|
| **macOS** | `Play-Goosklerf.command` | Double-click in Finder. Opens Terminal automatically. |
| **Linux** | `play-goosklerf.sh` | Right-click → "Run as a Program", or run `./play-goosklerf.sh` in a terminal. |
| **Windows (cmd)** | `Play-Goosklerf.bat` | Double-click in File Explorer. Opens Command Prompt. |
| **Windows (PowerShell)** | `Play-Goosklerf.ps1` | Right-click → "Run with PowerShell". |

The first time you run any of them, it will:

1. Check that **pnpm** is installed (see prerequisites below).
2. Install the project's npm dependencies (~30 seconds).
3. Build the card database from `archive/gk_videogame_v1/card_data-003.csv`.
4. Launch the CLI game.

Subsequent runs skip the install and build steps and go straight to the game.

When the game ends, the terminal stays open — press Enter to close.

## Prerequisites

You need **Node.js** (v20 or newer) and **pnpm** installed.

- **macOS:** `brew install node && npm install -g pnpm`
- **Linux:** install Node.js from your package manager, then `npm install -g pnpm`
- **Windows:** download the Node.js installer from <https://nodejs.org>, then in PowerShell or cmd: `npm install -g pnpm`

If pnpm isn't on your PATH when you run a launcher, the launcher will print install instructions and exit cleanly — no quiet failures.

## What the launchers do behind the scenes

Each launcher is a thin shell over the same three commands:

```
cd gk_videogame_v2
pnpm install               # only if node_modules doesn't exist yet
pnpm cards:build           # only if cards.generated.json doesn't exist yet
pnpm play                  # the game
```

You can run those commands by hand if you prefer; the launcher just makes it click-to-run for non-developers.

## Passing arguments

You can drop arguments into the launcher's command line. For example, on macOS / Linux:

```bash
./Play-Goosklerf.command --seed my-game --players 4
```

Currently the CLI accepts:

- `--seed <string>` — game seed (deterministic)
- `--players <2..4>` — number of players
- `--deck-size <small|medium|large>` — deck regime
- `--no-shop` — disable the shop rule
- `--script <file.json>` — placeholder script mode: render the initial state and exit (full transcript replay lands later)

Run `pnpm play -- --help` for the latest list.

## In-game commands

- `p N bf` — play hand card `N` to the battlefield.
- `p N f M` — play hand card `N` into your fortress `M`.
- `p N s` — play hand card `N` to your suburbs.
- `p N e M` — equip hand card `N` to your entity `M`.
- `d N` — discard hand card `N`.
- `e` — end the phase when the current phase's rule requirements are satisfied.
- `i N`, `i s N`, `i b N`, `i f N`, `i <id>` — inspect cards.
- `r`, `?`, `q` — redraw, help, quit.

## If something goes wrong

The launcher leaves the terminal open with the error message. Common issues:

- **"pnpm not found"** — install pnpm (see prerequisites above).
- **"Cannot find gk_videogame_v2/"** — the launcher must live next to the `gk_videogame_v2/` folder. If you moved files around, move the launcher back.
- **"pnpm install failed"** — usually a network issue. Try again, or run `pnpm install` from a terminal in the `gk_videogame_v2/` directory to see the full error.

For full development docs, see [`gk_videogame_v2/docs/STATUS.md`](gk_videogame_v2/docs/STATUS.md).

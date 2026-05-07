GOOSKLERF II HEADLESS SIMULATOR QUICKSTART

What it does
------------
The simulator runs Goosklerf games without the browser UI. It uses the same rules reducer and AI controller as the app. This is useful for Monte Carlo-style rule testing, crash detection, turn-count checks, and deck/data validation.

By default, headless report files are written inside:

  goosklerf-digital/apps/simulator/reports/

Double-click start
------------------
Mac:

  Run-Simulator.command

Windows:

  Run-Simulator.bat

Default double-click run:

  100 games, 2 players, seed quickstart, max 200 turns

Reports are written to:

  goosklerf-digital/apps/simulator/reports/quickstart

Terminal examples
-----------------
From this videogame folder:

  ./run-simulator.sh

Run 10 games:

  ./run-simulator.sh --games 10 --players 2 --seed smoke --out reports/smoke --max-turns 100

Run 1,000 games:

  ./run-simulator.sh --games 1000 --players 4 --seed monte-carlo-1 --out reports/monte-carlo-1 --max-turns 300

Manual command from goosklerf-digital:

  pnpm sim -- --games 100 --players 2 --seed quickstart --max-turns 200

That command uses the default output folder:

  apps/simulator/reports/headless-latest

Useful flags
------------
--games <n>
  Number of games to simulate.

--players <n>
  Players per game, 2 to 4.

--seed <text>
  Deterministic base seed. Same seed and settings should reproduce the same run.

--deck-size <small|medium|large>
  Deck size preset. Default is medium.

--max-turns <n>
  Stops any game that has not found a winner by this turn count.

--out <dir>
  Output directory for reports. Relative paths resolve inside apps/simulator because the package script runs there. Default: reports/headless-latest.

--allow-unimplemented-specials
  Allows all special cards into simulated decks. Without this, the simulator prefers implemented cards, while still allowing fortresses because all current fortress cards carry special text.

Report files
------------
summary.json:
  Full structured run summary.

games.csv:
  Spreadsheet-friendly rows with gameId, seed, winner, ending reason, turn count, action count, illegal action count, unimplemented special count, cards used, attacks, deaths, movement, fortress captures, capture opportunities, and fortress assault target mix.

report.txt:
  Human-readable report with outcome counts, victory types, fortress capture diagnostics, average/low/high values for turns, cards played/discarded, entities defeated, fortress captures/destructions, attacks, hits, misses, movement, and per-game summaries.

How to read results
-------------------
endedBy = winner:
  The game reached a winner.

endedBy = max_turns:
  The game did not finish before --max-turns. This may mean the rule loop or AI policy needs improvement. Check capture opportunities and repeated fortress captures.

endedBy = error:
  A crash or unrecoverable reducer error occurred.

illegalActionCount:
  AI tried an illegal action and the simulator recovered by ending phase. This should stay low and should be investigated if it grows.

fortressesCaptured:
  Counts each successful capture event. This can be higher than the number of fortress cards because contested fortresses can change controller more than once.

capturesAfterClearingDefenders:
  Counts captures where the attacker defeated the final entity inside the fortress, then moved into that fortress.

captureOpportunities:
  Counts attacks that could produce a capture if the roll succeeds: empty enemy fortress attacks plus attacks against the last low-HP defender inside a fortress.

GUI simulator
-------------
The GUI simulator is a separate app for watching one AI-only game:

  ./run-gui-simulator.sh

It opens at:

  http://127.0.0.1:5174

Use it when you want to inspect one game visually instead of running a batch.

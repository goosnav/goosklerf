GOOSKLERF II DIGITAL - TUTORIAL AND QUICKSTART

What this is
------------
This folder contains a local TypeScript version of Goosklerf II. It has a browser-playable desktop-style app, a shared rules engine, card data, card images, a simple AI bot, and a headless simulator for automated rule testing.

There are now three runnable surfaces:

1. The videogame: human player vs AI bots.
2. The headless simulator: batch Monte Carlo-style runs that write reports.
3. The GUI simulator: one visible AI-only game with step/auto/run controls.

Current playtest status
-----------------------
The game is playable for local playtesting. You can start a game, play entity and fortress cards, equip regular items, use simple consumables, move entities between fortresses and the battlefield, capture fortresses, pass phases, and play against AI bots. The app displays local JPG card art from apps/desktop/public/cards.

Important limitation: many unique special card effects are still not fully automated. Their text is visible when inspecting cards, and the simulator reports how many unimplemented special cards were included in a run.

The board separates each player's zones:

- Suburbs: fortresses.
- Battlefield: entities and their equipped items.
- Hand/Shop: cards available to assign during card_play.
- Graveyard: discarded or defeated cards.

Double-click start on Mac
-------------------------
1. Double-click Run-Goosklerf.command.
2. If macOS blocks it, right-click it, choose Open, then confirm.
3. The script starts the local app at:
   http://127.0.0.1:5173
4. Leave the terminal window open while playing. Closing it stops the app.

Double-click start on Windows
-----------------------------
1. Double-click Run-Goosklerf.bat.
2. The browser opens to:
   http://127.0.0.1:5173
3. Leave the command window open while playing.

Terminal start
--------------
From this videogame folder:

  ./run-goosklerf.sh

Or manually:

  cd goosklerf-digital
  pnpm --filter desktop run dev --host 127.0.0.1 --strictPort

Requirements
------------
- Node.js 20+ or 22+
- pnpm 9+

If pnpm is missing, try:

  corepack enable

How to play
-----------
1. Click New Game.
2. Choose 2 to 4 players. Player 1 is human; the rest are AI bots.
3. Click Start Game.
4. During card_play, select a card from Hand or Shop.
5. Read the Card Assignment panel before committing the card.
   - Fortresses can be played directly to the Suburbs.
   - Entities must be assigned to one of your fortresses.
   - Regular items require a friendly entity target. If you have no entity, the action stays disabled.
   - Consumables require a legal friendly or enemy target depending on the effect.
   - Special cards with no MVP automation are shown but cannot be wasted accidentally.
6. Click the final action button in the Card Assignment panel, or Discard if you want to clear a card you cannot use.
7. Click End Phase to move through the phase sequence.
8. During movement, move entities out of fortresses to the battlefield if you want them to attack.
9. During combat, choose one of your battlefield entities, choose an enemy entity or fortress, then click Attack.
10. Legal board targets are highlighted. You can use the dropdowns or click Target on a highlighted card.
11. If a battlefield entity hits an undefended enemy fortress, it captures that fortress and moves inside it.
12. If a battlefield entity defeats the last entity inside an enemy fortress and that fortress still has HP, the attacker captures that fortress and moves inside it.
13. Landlord victory is implemented: when one player controls every fortress in play and no unplayed fortress cards remain, that player must keep control through a survival round to win.
14. Click any card image or Inspect button to enlarge and read the card.
15. AI turns advance automatically.

GUI simulator
-------------
To watch a single AI-only simulated game:

Mac:

  Run-GUI-Simulator.command

Windows:

  Run-GUI-Simulator.bat

Terminal:

  ./run-gui-simulator.sh

The GUI simulator opens at:

  http://127.0.0.1:5174

It supports 2-4 AI players, seed/deck/max-turn controls, Step, Auto, Run End, and JSON/CSV report downloads for the visible game.

Troubleshooting
---------------
- Blank card art: confirm apps/desktop/public/cards contains 128 JPG files.
- Port already in use: stop the other dev server using port 5173, then rerun the launcher.
- Capture loops in simulator reports: use the GUI simulator to inspect whether AI players are repeatedly emptying contested fortresses.
- pnpm install fails: check your internet connection and Node installation.
- Mac permission denied: run chmod +x Run-Goosklerf.command run-goosklerf.sh.
- Windows SmartScreen: choose More info, then Run anyway if you trust this local folder.

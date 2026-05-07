GOOSKLERF II DIGITAL - PROJECT REPORT

Current project shape
---------------------
The project is a pnpm monorepo in goosklerf-digital:

- packages/cards: card schema, generated card database, and loaders.
- packages/engine: shared game state, setup, reducers, RNG, deck generation, and runtime helpers.
- packages/ai: simple AI controller used by the app and simulator.
- apps/desktop: Vite + React browser UI.
- apps/simulator: headless CLI simulator and report writer.
- apps/sim-viewer: separate Vite + React GUI simulator for one AI-only game.
- apps/card-tools: CSV import and card database build tools.

What was cleaned up
-------------------
- Added relative-path launchers for Mac, Windows, and shell terminal use.
- Added plain-text tutorial and simulator quickstart files.
- Copied the root JPEG card art into apps/desktop/public/cards.
- Verified every generated card image path resolves to a local JPG.
- Replaced the table placeholder with a playable MVP UI.
- Added reducer support for playing cards, equipping items, consumables, drawing, phase advancement, combat attacks, card defeat, and winner detection.
- Updated AI so bots can play cards, equip items, attack, and advance turns.
- Updated the simulator so it runs games to winner, max-turn stop, or error instead of only initializing games.
- Added a separate GUI simulator app for watching one 2-4 player AI-only game.
- Reworked the game GUI for small screens with stacked responsive layout, sticky controls, explicit Hand/Shop/Log tabs, and clearer Suburbs vs Battlefield zones.
- Replaced blind card play buttons with a card-assignment flow that requires legal targets before committing an item or consumable.
- Implemented fortress occupancy: entities enter fortresses, fortress attack/HP buffs apply while inside, items stay visibly attached to their equipped entity, and entities can move out to the battlefield during Movement.
- Implemented fortress capture: a battlefield entity captures an empty enemy fortress on hit, and also captures after defeating the final defender inside a still-standing fortress.
- Added Landlord victory detection with a survival-round countdown after fortress cards are exhausted.
- Updated AI movement and combat targeting so bots deploy battlefield attackers, defend controlled fortresses instead of immediately abandoning every capture, prioritize defenders/empty fortresses, and graphically equip items in both apps.
- Enforced the 3 card play/discard limit during card_play.
- Expanded headless reports with `report.txt`, richer CSV columns, and aggregate metrics for turns, cards, attacks, deaths, movement, fortress captures, capture opportunities, capture-after-defender-clear events, fortress assault target mix, and victory types.
- Added tests for MVP gameplay reducer behavior and card asset coverage.

Known limitations
-----------------
- This is still an MVP, not a complete digital implementation of every rulebook edge case.
- Many unique special card effects are displayed but not fully automated.
- Consumables automate simple numeric effects and a small roll/defeat pattern only.
- Save/load, packaged Electron builds, polished drag-and-drop, full engagement staging, reactions, advanced actions, and most special-card edge cases are not finished.
- AI policy is now usable for playtesting, but simulator reports still show some long capture tug-of-war games that need more balance passes.
- The old Electron files are still scaffold-level; the reliable launcher starts the Vite app in a browser.

Verification status
-------------------
As of this cleanup pass:

- Card images: 128 present, 0 missing, 0 unused against generated card data.
- Existing unit tests pass: 43 tests across 7 files.
- Desktop and GUI simulator production builds pass.
- Latest 50-game simulator run completed with 39 winners, 11 max-turn stops, and 0 errors at `apps/simulator/reports/fortress-fix-2`.
- Headless reports default to apps/simulator/reports/headless-latest when --out is omitted.

Recommended next work
---------------------
1. Finish special-card automation by adding explicit effect IDs to card data.
2. Continue balancing AI fortress policy so capture loops are less frequent in long games.
3. Add drag/drop as a convenience layer on top of the explicit assignment controls.
4. Expand victory conditions beyond Landlord/resource exhaustion/Hamlet, including special-card victories.
5. Add packaged Electron releases so nontechnical users do not need a dev server.
6. Run large simulator batches and inspect max-turn stops or illegal action trends.

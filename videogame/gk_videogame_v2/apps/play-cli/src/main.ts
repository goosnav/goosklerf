/**
 * Goosklerf CLI entry point.
 *
 * Sprint 4 scope: parse args, run setupGame, render the initial state, and
 * accept keystrokes. The only command that does anything is `q` (quit).
 * Real action handling — playing cards, declaring engagements, etc. —
 * arrives in Sprint 5+.
 *
 * This file is deliberately thin. Everything testable lives in args.ts /
 * render.ts; main.ts is the I/O glue.
 */

import readline from "node:readline";
import process from "node:process";
import { loadCardDatabase } from "@gk/cards";
import { setupGame, type PlayerSpec } from "@gk/engine";
import { parseArgs, helpText, ArgsError } from "./args.js";
import { commandHelpText, parseCommand } from "./commands.js";
import { resolveInspect } from "./inspect.js";
import { renderAll } from "./render.js";

const PERSONALITIES = ["butcher", "landlord", "goblin", "accountant"] as const;

/**
 * Build a default player roster: P1 is human, P2..PN are AI cycling through
 * the four personalities. Custom rosters are a Sprint 5+ feature.
 */
function defaultPlayers(n: number): PlayerSpec[] {
  const players: PlayerSpec[] = [{ name: "You", kind: "human" }];
  for (let i = 1; i < n; i++) {
    const personality = PERSONALITIES[(i - 1) % PERSONALITIES.length] as string;
    players.push({
      name: `${personality[0]!.toUpperCase()}${personality.slice(1)} bot`,
      kind: "ai",
      personality,
    });
  }
  return players;
}

async function main(): Promise<void> {
  // ---- Parse args -------------------------------------------------------
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof ArgsError) {
      console.error(`Argument error: ${e.message}\n`);
      console.error(helpText());
      process.exit(2);
    }
    throw e;
  }

  if (args.help) {
    console.log(helpText());
    return;
  }

  // ---- Load cards -------------------------------------------------------
  let cardDb;
  try {
    cardDb = loadCardDatabase();
  } catch (e) {
    console.error("Could not load card database. Run `pnpm cards:build` first.");
    console.error(String(e));
    process.exit(1);
  }

  // ---- Build initial state ---------------------------------------------
  const setupResult = setupGame({
    seed: args.seed,
    players: defaultPlayers(args.players),
    deckSize: args.deckSize,
    cardDatabase: cardDb,
    enableShop: args.shop,
  });
  if (!setupResult.ok) {
    console.error("Setup failed:", setupResult.error);
    process.exit(1);
  }
  const state = setupResult.value;

  // ---- Render once and prompt ------------------------------------------
  const useColor = args.color && process.stdout.isTTY === true;
  const renderOpts = { useColor, cardDb };

  // Clear screen with ANSI escape sequence; harmless on non-TTY.
  if (useColor) process.stdout.write("\x1b[2J\x1b[H");

  console.log(renderAll(state, renderOpts));

  // Script mode (Sprint 13 fills in real transcript handling): for now,
  // exit immediately after the initial render.
  if (args.scriptPath) {
    console.log(`\n[script mode: ${args.scriptPath} — full transcript handling lands in Sprint 13]`);
    process.exit(0);
  }

  // Interactive readline loop.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.setPrompt("> ");
  rl.prompt();
  for await (const line of rl) {
    const input = line.trim();
    const command = parseCommand(input);
    switch (command.kind) {
      case "quit":
        rl.close();
        console.log("Goodbye.");
        return;
      case "help":
        console.log(commandHelpText().join("\n"));
        break;
      case "render":
        if (useColor) process.stdout.write("\x1b[2J\x1b[H");
        console.log(renderAll(state, renderOpts));
        break;
      case "inspect": {
        const result = resolveInspect(command.target, state, cardDb, renderOpts);
        if (result.kind === "error") console.log(`inspect: ${result.message}`);
        else console.log(result.lines.join("\n"));
        break;
      }
      case "noop":
        break;
      case "unknown":
        console.log(command.message);
        break;
    }
    rl.prompt();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

/**
 * CLI argument parser.
 *
 * Hand-rolled to avoid pulling in `commander` or similar — the flag set is
 * small and stable. If we ever need richer parsing (subcommands, env-var
 * fallbacks), swap to a real lib in one place.
 *
 * Supported flags (Sprint 4):
 *   --seed <string>            game seed (deterministic). Default: random.
 *   --players <2..4>           number of players. Default: 4.
 *   --deck-size <s|m|l>        deck regime. Default: medium.
 *   --no-shop                  disable the shop rule.
 *   --script <path>            run an action transcript instead of accepting
 *                              keystrokes (used by tests and replay).
 *   --no-color                 disable ANSI color in the output.
 *   --help, -h                 print usage and exit.
 *
 * Future flags (later sprints): --players-spec, --fast (animation skip),
 * --save, --load.
 */

import type { DeckSize } from "@gk/engine";

export interface CliArgs {
  seed: string;
  players: number;
  deckSize: DeckSize;
  shop: boolean;
  scriptPath: string | null;
  color: boolean;
  help: boolean;
}

export class ArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgsError";
  }
}

const DEFAULTS: CliArgs = {
  seed: "",            // populated below if not provided
  players: 4,
  deckSize: "medium",
  shop: true,
  scriptPath: null,
  color: true,
  help: false,
};

/**
 * Parse argv into CliArgs. Throws ArgsError on malformed input.
 *
 * The first two argv entries (`process.argv[0..1]`) — node binary and script
 * path — are NOT included; pass `process.argv.slice(2)`.
 */
export function parseArgs(argv: readonly string[]): CliArgs {
  const out: CliArgs = { ...DEFAULTS };
  let seedSeen = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--help":
      case "-h":
        out.help = true;
        break;
      case "--seed": {
        const v = argv[++i];
        if (!v) throw new ArgsError("--seed requires a value");
        out.seed = v;
        seedSeen = true;
        break;
      }
      case "--players": {
        const v = argv[++i];
        if (!v) throw new ArgsError("--players requires a value");
        const n = Number(v);
        if (!Number.isInteger(n) || n < 2 || n > 4) {
          throw new ArgsError(`--players must be 2..4, got "${v}"`);
        }
        out.players = n;
        break;
      }
      case "--deck-size": {
        const v = argv[++i];
        if (!v) throw new ArgsError("--deck-size requires a value");
        if (v !== "small" && v !== "medium" && v !== "large") {
          throw new ArgsError(`--deck-size must be small|medium|large, got "${v}"`);
        }
        out.deckSize = v;
        break;
      }
      case "--no-shop":
        out.shop = false;
        break;
      case "--shop":
        out.shop = true;
        break;
      case "--script": {
        const v = argv[++i];
        if (!v) throw new ArgsError("--script requires a path");
        out.scriptPath = v;
        break;
      }
      case "--no-color":
        out.color = false;
        break;
      case "--":
        // pnpm's `pnpm play -- --foo` injects a literal `--` at the start.
        // Skip it.
        break;
      default:
        // Be tolerant of stray empty strings (some launchers add them).
        if (a === "") break;
        throw new ArgsError(`unknown argument: ${a}`);
    }
  }

  // Default seed: deterministic-but-uninteresting if user didn't provide one.
  // We use a fixed string so a "no flags" run is reproducible. Users who want
  // unique games pass --seed.
  if (!seedSeen) out.seed = "default";

  // Honor NO_COLOR env var (https://no-color.org).
  if (typeof process !== "undefined" && process.env && process.env["NO_COLOR"]) {
    out.color = false;
  }

  return out;
}

export function helpText(): string {
  return [
    "Usage: pnpm play [options]",
    "",
    "Options:",
    "  --seed <s>                game seed (deterministic). Default: 'default'.",
    "  --players <n>             number of players, 2..4. Default: 4.",
    "  --deck-size <s|m|l>       deck regime: small|medium|large. Default: medium.",
    "  --no-shop                 disable the shop rule.",
    "  --script <path>           run an action transcript instead of prompting.",
    "  --no-color                disable ANSI color output (also: NO_COLOR env).",
    "  --help, -h                print this help and exit.",
    "",
    "Examples:",
    "  pnpm play",
    "  pnpm play --seed alice --players 3",
    "  pnpm play --deck-size large --no-shop",
  ].join("\n");
}

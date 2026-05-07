/**
 * CLI command parser.
 *
 * Takes a single line of user input and returns a typed Command. The main
 * loop dispatches on `command.kind`. Keeping this in its own module means:
 *   - The parser is unit-testable without involving readline/state.
 *   - The same parser is reused by the `--script` transcript runner (Sprint 13).
 *   - When Sprint 5+ adds new actions, we add new variants here in one place.
 *
 * Command syntax — designed to be terse and one-handed:
 *   i N           inspect hand card N (1-indexed)
 *   i s N         inspect your shop card N
 *   i b N         inspect battlefield entity N
 *   i f N         inspect fortress N (your suburbs)
 *   i <card-id>   inspect a card by id (e.g. "i butcher_worm")
 *   r             re-render the board
 *   ? or h        show command list
 *   q             quit
 *   <empty>       no-op
 *
 * Sprint 5+ will add: p (play), d (discard), e (end phase), and so on. Each
 * new action lands as a new variant here.
 */

export type InspectTarget =
  | { kind: "hand"; index: number }                  // i N
  | { kind: "shop"; index: number }                  // i s N
  | { kind: "battlefield"; index: number }           // i b N
  | { kind: "fortress"; index: number }              // i f N
  | { kind: "card_id"; id: string };                 // i butcher_worm

export type Command =
  | { kind: "inspect"; target: InspectTarget }
  | { kind: "render" }
  | { kind: "help" }
  | { kind: "quit" }
  | { kind: "noop" }
  | { kind: "unknown"; message: string };

/** Parse one line of user input. Never throws — returns `unknown` on bad input. */
export function parseCommand(line: string): Command {
  const trimmed = line.trim();
  if (trimmed === "") return { kind: "noop" };

  const tokens = trimmed.split(/\s+/);
  const head = tokens[0]!.toLowerCase();

  switch (head) {
    case "q":
    case "quit":
    case "exit":
      return { kind: "quit" };

    case "r":
    case "render":
    case "redraw":
      return { kind: "render" };

    case "?":
    case "h":
    case "help":
      return { kind: "help" };

    case "i":
    case "inspect":
      return parseInspect(tokens.slice(1));

    default:
      return {
        kind: "unknown",
        message: `unknown command "${head}". Type ? for help.`,
      };
  }
}

function parseInspect(args: string[]): Command {
  if (args.length === 0) {
    return {
      kind: "unknown",
      message: 'inspect: which card? Try "i 3", "i s 1", "i b 2", "i f 1", or "i <card-id>".',
    };
  }

  // Two-word forms: "i s N" / "i b N" / "i f N"
  if (args.length === 2) {
    const sub = args[0]!.toLowerCase();
    const idx = parseIndex(args[1]!);
    if (idx === null) {
      return { kind: "unknown", message: `inspect: "${args[1]}" is not a valid index.` };
    }
    if (sub === "s" || sub === "shop") {
      return { kind: "inspect", target: { kind: "shop", index: idx } };
    }
    if (sub === "b" || sub === "battlefield" || sub === "field") {
      return { kind: "inspect", target: { kind: "battlefield", index: idx } };
    }
    if (sub === "f" || sub === "fortress") {
      return { kind: "inspect", target: { kind: "fortress", index: idx } };
    }
    // fall through — maybe a 2-token card id like `i super entity`? unlikely.
    return {
      kind: "unknown",
      message: `inspect: didn't understand "${args.join(" ")}". Try "i 3", "i s 1", "i b 2", "i f 1", or "i <card-id>".`,
    };
  }

  // One-word form: numeric → hand index, otherwise card id
  if (args.length === 1) {
    const arg = args[0]!;
    const idx = parseIndex(arg);
    if (idx !== null) {
      return { kind: "inspect", target: { kind: "hand", index: idx } };
    }
    // Treat as a card id (slug). We don't validate the id's existence here;
    // the renderer surfaces "no such card" if the lookup fails.
    return { kind: "inspect", target: { kind: "card_id", id: arg.toLowerCase() } };
  }

  // 3+ tokens — for now, reject. Future: accept multi-word card names ("i happy guy")
  // by joining args and slugifying. Add when we need it.
  return {
    kind: "unknown",
    message: `inspect: too many arguments. Try "i 3", "i s 1", "i b 2", "i f 1", or "i <card-id>".`,
  };
}

/**
 * Parse a 1-indexed positive integer. Returns null on anything else.
 *
 * We accept `1`, `[1]`, `1.` — be lenient about copy-paste from the rendered
 * board where indices appear in brackets.
 */
function parseIndex(s: string): number | null {
  const cleaned = s.replace(/[\[\].]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 10);
  if (n < 1) return null;
  return n;
}

// -----------------------------------------------------------------------------
// Help text
// -----------------------------------------------------------------------------

/** What to print when the user types `?` or `h`. */
export function commandHelpText(): string[] {
  return [
    "Commands:",
    "  i N           inspect hand card N",
    "  i s N         inspect your shop card N",
    "  i b N         inspect battlefield entity N",
    "  i f N         inspect fortress N",
    "  i <id>        inspect any card by its id (e.g. \"i butcher_worm\")",
    "  r             re-render the board",
    "  ?             this help",
    "  q             quit",
    "",
    "Sprint 4 build: only inspect/render/help/quit are wired. More actions arrive Sprint 5+.",
  ];
}

/** A short one-liner shown at the bottom of the board after every render. */
export function commandPaletteLine(): string {
  return "[i N] inspect hand   [i s/b/f N] shop/field/fortress   [r] redraw   [?] help   [q] quit";
}

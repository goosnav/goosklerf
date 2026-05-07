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
 *   p N bf        play hand card N to battlefield
 *   p N f M       play hand card N into your fortress M
 *   p N s         play hand card N to your suburbs
 *   p N e M       equip hand card N to your entity M
 *   d N           discard hand card N
 *   e             end the current phase
 *   r             re-render the board
 *   ? or h        show command list
 *   q             quit
 *   <empty>       no-op
 *
 * Later sprints add combat/movement/card-draw verbs in the same style.
 */

export type InspectTarget =
  | { kind: "hand"; index: number }                  // i N
  | { kind: "shop"; index: number }                  // i s N
  | { kind: "battlefield"; index: number }           // i b N
  | { kind: "fortress"; index: number }              // i f N
  | { kind: "card_id"; id: string };                 // i butcher_worm

export type PlayPlacementTarget =
  | { kind: "battlefield" }                          // p N bf
  | { kind: "fortress"; index: number }              // p N f M
  | { kind: "suburbs" }                              // p N s
  | { kind: "equip"; index: number }                 // p N e M
  | { kind: "auto" };                                 // p N    (auto-pick if unambiguous)

export type Command =
  | { kind: "inspect"; target: InspectTarget }
  | { kind: "play"; handIndex: number; placement: PlayPlacementTarget }
  | { kind: "discard"; handIndex: number }
  | { kind: "endPhase" }
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

    case "p":
    case "play":
      return parsePlay(tokens.slice(1));

    case "d":
    case "discard":
      return parseDiscard(tokens.slice(1));

    case "e":
    case "end":
    case "endphase":
      if (tokens.length !== 1) {
        return { kind: "unknown", message: 'end: no arguments expected. Try "e".' };
      }
      return { kind: "endPhase" };

    default:
      return {
        kind: "unknown",
        message: `unknown command "${head}". Type ? for help.`,
      };
  }
}

function parsePlay(args: string[]): Command {
  if (args.length === 0) {
    return {
      kind: "unknown",
      message: 'play: which card? Try "p 1" (auto-pick), "p 1 bf", "p 1 f 1", "p 1 s", or "p 1 e 1".',
    };
  }

  const handIndex = parseIndex(args[0]!);
  if (handIndex === null) {
    return { kind: "unknown", message: `play: "${args[0]}" is not a valid hand index.` };
  }

  // `p N` with no target → auto-pick the only legal placement (if unambiguous).
  // The decision happens in the app layer where we have GameState; the parser
  // just records the intent.
  if (args.length === 1) {
    return { kind: "play", handIndex, placement: { kind: "auto" } };
  }

  const dest = args[1]!.toLowerCase();
  if (args.length === 2 && (dest === "bf" || dest === "b" || dest === "battlefield" || dest === "field")) {
    return { kind: "play", handIndex, placement: { kind: "battlefield" } };
  }
  if (args.length === 2 && (dest === "s" || dest === "suburb" || dest === "suburbs")) {
    return { kind: "play", handIndex, placement: { kind: "suburbs" } };
  }
  if (args.length === 3 && (dest === "f" || dest === "fortress")) {
    const index = parseIndex(args[2]!);
    if (index === null) {
      return { kind: "unknown", message: `play: "${args[2]}" is not a valid fortress index.` };
    }
    return { kind: "play", handIndex, placement: { kind: "fortress", index } };
  }
  if (args.length === 3 && (dest === "e" || dest === "equip" || dest === "entity")) {
    const index = parseIndex(args[2]!);
    if (index === null) {
      return { kind: "unknown", message: `play: "${args[2]}" is not a valid entity index.` };
    }
    return { kind: "play", handIndex, placement: { kind: "equip", index } };
  }

  return {
    kind: "unknown",
    message: `play: didn't understand "${args.join(" ")}". Try "p 1 bf", "p 1 f 1", "p 1 s", or "p 1 e 1".`,
  };
}

function parseDiscard(args: string[]): Command {
  if (args.length !== 1) {
    return { kind: "unknown", message: 'discard: try "d 1".' };
  }
  const handIndex = parseIndex(args[0]!);
  if (handIndex === null) {
    return { kind: "unknown", message: `discard: "${args[0]}" is not a valid hand index.` };
  }
  return { kind: "discard", handIndex };
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
    "Commands during your Card Play phase (you must play 3 or discard down to ≤3):",
    "  p N           play hand card N — auto-pick destination if only one is legal",
    "  p N bf        play card N to the battlefield   (entities only)",
    "  p N s         play card N to your suburbs      (fortresses only)",
    "  p N f M       play card N into your fortress M (entities only)",
    "  p N e M       equip card N to your entity M    (items / consumables)",
    "  d N           discard hand card N (only allowed when no legal play remains)",
    "  e             end the Card Play phase (auto-advances through stub phases)",
    "",
    "Inspection (works at any time):",
    "  i N           your hand card N",
    "  i s N         your shop card N",
    "  i b N         a battlefield entity",
    "  i f N         a fortress in your suburbs",
    "  i <card-id>   any card by its id (e.g. \"i butcher_worm\")",
    "",
    "  r             re-render the board",
    "  ?             this help",
    "  q             quit",
  ];
}

/** A short one-liner shown at the bottom of the board after every render. */
export function commandPaletteLine(): string {
  return "[p N] play (auto)   [d N] discard   [e] end   [i N] inspect   [?] help   [q] quit";
}

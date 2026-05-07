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
 *   assault A pN fM[,fK] declare fortress assault
 *   mv bN fM      move battlefield entity N into your fortress M
 *   mv fM.N bf    move occupant N from your fortress M to battlefield
 *   e             end the current phase
 *   r             re-render the board
 *   ? or h        show command list
 *   q             quit
 *   <empty>       no-op
 *
 * Later sprints add card-draw verbs in the same style.
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

export type EngagementEntityRef =
  | { side: "attacker"; index: number }               // aN
  | { side: "defender"; index: number };              // dN

export type EngagementTargetRef =
  | EngagementEntityRef
  | { side: "fortress"; index: number };              // fN

export type MovementSourceRef =
  | { kind: "battlefield"; index: number }             // bN
  | { kind: "fortress"; fortressIndex: number; occupantIndex: number }; // fM.N

export type MovementDestinationRef =
  | { kind: "battlefield" }                            // bf
  | { kind: "fortress"; fortressIndex: number };       // fN

export type Command =
  | { kind: "inspect"; target: InspectTarget }
  | { kind: "play"; handIndex: number; placement: PlayPlacementTarget }
  | { kind: "discard"; handIndex: number }
  | { kind: "endPhase" }
  // ---- Combat (R6.x) ----
  | { kind: "declareEngagement"; attackerBattlefieldIndices: number[]; defenderPlayerIndex: number }
  | {
      kind: "declareFortressAssault";
      attackerBattlefieldIndices: number[];
      defenderPlayerIndex: number;
      defenderFortressIndices: number[];
    }
  | { kind: "attack"; source: EngagementEntityRef; target: EngagementTargetRef }
  | { kind: "pass"; entity: EngagementEntityRef }
  // ---- Movement (R8.x) ----
  | { kind: "move"; source: MovementSourceRef; destination: MovementDestinationRef }
  | {
      kind: "resolveAssault";
      choice: "capture" | "destroy" | "leave";
      fortressIndex: number;
      garrisonAttackerIndices: number[];
    }
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

    case "decl":
    case "declare":
      return parseDeclare(tokens.slice(1));

    case "assault":
      return parseAssault(tokens.slice(1));

    case "att":
    case "attack":
      return parseAttack(tokens.slice(1));

    case "pass":
      return parsePass(tokens.slice(1));

    case "mv":
    case "move":
      return parseMove(tokens.slice(1));

    case "cap":
    case "capture":
      return parseResolveAssault("capture", tokens.slice(1));

    case "burn":
    case "destroy":
      return parseResolveAssault("destroy", tokens.slice(1));

    case "leave":
      return parseResolveAssault("leave", tokens.slice(1));

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

/**
 * `decl <a1,a2,...> p<N>` — declare a battlefield engagement.
 *   `a1,a2,...` are 1-indexed positions in the active player's battlefield list.
 *   `p<N>` (e.g. `p2`, `p3`) names the defender player.
 *
 * Examples:
 *   decl 1 p2          → attack player 2 with my first battlefield entity
 *   decl 1,2 p3        → attack player 3 with my entities 1 and 2
 */
function parseDeclare(args: string[]): Command {
  if (args.length !== 2) {
    return {
      kind: "unknown",
      message: 'declare: try "decl <a1,a2,...> p<N>" — e.g. "decl 1 p2" or "decl 1,2 p3".',
    };
  }
  const attackerSpec = args[0]!;
  const defenderSpec = args[1]!;
  const indices: number[] = [];
  for (const token of attackerSpec.split(",")) {
    const idx = parseIndex(token);
    if (idx === null) {
      return {
        kind: "unknown",
        message: `declare: "${token}" is not a valid battlefield index.`,
      };
    }
    indices.push(idx);
  }
  if (indices.length === 0) {
    return { kind: "unknown", message: "declare: at least one attacker required." };
  }
  // Defender: p1, p2, p3, p4 — 1-indexed.
  const defenderMatch = /^p(\d+)$/i.exec(defenderSpec);
  if (!defenderMatch) {
    return {
      kind: "unknown",
      message: `declare: "${defenderSpec}" is not a valid player ref. Try "p2".`,
    };
  }
  const defenderPlayerIndex = parseInt(defenderMatch[1]!, 10);
  if (!Number.isFinite(defenderPlayerIndex) || defenderPlayerIndex < 1) {
    return { kind: "unknown", message: `declare: "${defenderSpec}" is not a valid player.` };
  }
  return {
    kind: "declareEngagement",
    attackerBattlefieldIndices: indices,
    defenderPlayerIndex,
  };
}

/**
 * `assault <a1,a2,...> p<N> f<M[,K]>` — declare a fortress assault.
 *
 * Examples:
 *   assault 1 p2 f1       → attack player 2's first fortress
 *   assault 1,2 p3 f1,f2  → multi-fortress assault
 */
function parseAssault(args: string[]): Command {
  if (args.length !== 3) {
    return {
      kind: "unknown",
      message: 'assault: try "assault <a1,a2,...> p<N> f<M[,K]>" — e.g. "assault 1 p2 f1".',
    };
  }
  const attackerIndices = parseCommaIndices(args[0]!);
  if (attackerIndices === null || attackerIndices.length === 0) {
    return { kind: "unknown", message: `assault: "${args[0]}" is not a valid attacker list.` };
  }
  const defenderMatch = /^p(\d+)$/i.exec(args[1]!);
  if (!defenderMatch) {
    return { kind: "unknown", message: `assault: "${args[1]}" is not a valid player ref. Try "p2".` };
  }
  const defenderPlayerIndex = parseInt(defenderMatch[1]!, 10);
  const fortressIndices = parseFortressIndexList(args[2]!);
  if (fortressIndices === null || fortressIndices.length === 0) {
    return { kind: "unknown", message: `assault: "${args[2]}" is not a valid fortress list. Try "f1" or "f1,f2".` };
  }
  return {
    kind: "declareFortressAssault",
    attackerBattlefieldIndices: attackerIndices,
    defenderPlayerIndex,
    defenderFortressIndices: fortressIndices,
  };
}

/**
 * `att aN dN` / `att dN aN` / `att aN fN` — normal attack using engagement-local labels.
 * The rendered ENGAGEMENT panel shows `[aN]` attacker-side entities and `[dN]`
 * defender-side entities. Keeping the side label lets a human defender act
 * naturally when an AI declared the engagement.
 */
function parseAttack(args: string[]): Command {
  if (args.length !== 2) {
    return { kind: "unknown", message: 'attack: try "att a1 d1", "att d1 a1", or "att a1 f1".' };
  }
  const source = parseEngagementEntityRef(args[0]!);
  const target = parseEngagementTargetRef(args[1]!);
  if (source === null) {
    return { kind: "unknown", message: `attack: "${args[0]}" is not a valid engagement entity (try "a1" or "d1").` };
  }
  if (target === null) {
    return { kind: "unknown", message: `attack: "${args[1]}" is not a valid engagement target (try "a1", "d1", or "f1").` };
  }
  return {
    kind: "attack",
    source,
    target,
  };
}

function parseResolveAssault(
  choice: "capture" | "destroy" | "leave",
  args: string[],
): Command {
  if (choice === "capture") {
    if (args.length !== 2) {
      return { kind: "unknown", message: 'capture: try "cap f1 a1" or "cap f1 a1,a2".' };
    }
  } else if (args.length !== 1) {
    return { kind: "unknown", message: `${choice}: try "${choice === "destroy" ? "burn" : "leave"} f1".` };
  }

  const fortressRef = parseEngagementFortressRef(args[0]!);
  if (fortressRef === null) {
    return { kind: "unknown", message: `${choice}: "${args[0]}" is not a valid target fortress (try "f1").` };
  }

  const garrisonAttackerIndices = choice === "capture"
    ? parseAttackerRefList(args[1]!) ?? []
    : [];
  if (choice === "capture" && garrisonAttackerIndices.length === 0) {
    return { kind: "unknown", message: `capture: "${args[1]}" is not a valid attacker list (try "a1" or "a1,a2").` };
  }

  return {
    kind: "resolveAssault",
    choice,
    fortressIndex: fortressRef.index,
    garrisonAttackerIndices,
  };
}

/**
 * `pass aN` / `pass dN` — pass an entity's action this round.
 */
function parsePass(args: string[]): Command {
  if (args.length !== 1) {
    return { kind: "unknown", message: 'pass: try "pass a1" or "pass d1".' };
  }
  const entity = parseEngagementEntityRef(args[0]!);
  if (entity === null) {
    return { kind: "unknown", message: `pass: "${args[0]}" is not a valid engagement-local index (try "a1" or "d1").` };
  }
  return { kind: "pass", entity };
}

/**
 * `mv bN fM` / `mv fM.N bf` / `mv fM.N fK` — Movement phase repositioning.
 *
 * Examples:
 *   mv b1 f1      → move your first battlefield entity into your first fortress
 *   mv f1.1 bf    → move occupant 1 from your first fortress to battlefield
 *   mv f1.1 f2    → move occupant 1 from fortress 1 into fortress 2
 */
function parseMove(args: string[]): Command {
  if (args.length !== 2) {
    return {
      kind: "unknown",
      message: 'move: try "mv b1 f1", "mv f1.1 bf", or "mv f1.1 f2".',
    };
  }
  const source = parseMovementSourceRef(args[0]!);
  if (!source) {
    return {
      kind: "unknown",
      message: `move: "${args[0]}" is not a valid source. Try "b1" or "f1.1".`,
    };
  }
  const destination = parseMovementDestinationRef(args[1]!);
  if (!destination) {
    return {
      kind: "unknown",
      message: `move: "${args[1]}" is not a valid destination. Try "bf" or "f1".`,
    };
  }
  return { kind: "move", source, destination };
}

/** Parse "a1" / "d2" into an engagement-local entity reference. */
function parseEngagementEntityRef(s: string): EngagementEntityRef | null {
  const cleaned = s.toLowerCase().replace(/[\[\].]/g, "");
  const m = /^(a|d)(\d+)$/.exec(cleaned);
  if (!m) return null;
  const n = parseInt(m[2]!, 10);
  if (n < 1) return null;
  return { side: m[1] === "a" ? "attacker" : "defender", index: n };
}

function parseEngagementTargetRef(s: string): EngagementTargetRef | null {
  return parseEngagementEntityRef(s) ?? parseEngagementFortressRef(s);
}

function parseEngagementFortressRef(s: string): { side: "fortress"; index: number } | null {
  const cleaned = s.toLowerCase().replace(/[\[\].]/g, "");
  const m = /^f(\d+)$/.exec(cleaned);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  if (n < 1) return null;
  return { side: "fortress", index: n };
}

function parseMovementSourceRef(s: string): MovementSourceRef | null {
  const cleaned = s.toLowerCase().replace(/[\[\]]/g, "");
  const battlefieldMatch = /^b(?:f)?(\d+)$/.exec(cleaned);
  if (battlefieldMatch) {
    const index = parseInt(battlefieldMatch[1]!, 10);
    if (index < 1) return null;
    return { kind: "battlefield", index };
  }

  const fortressMatch = /^f(\d+)[.:](\d+)$/.exec(cleaned);
  if (!fortressMatch) return null;
  const fortressIndex = parseInt(fortressMatch[1]!, 10);
  const occupantIndex = parseInt(fortressMatch[2]!, 10);
  if (fortressIndex < 1 || occupantIndex < 1) return null;
  return { kind: "fortress", fortressIndex, occupantIndex };
}

function parseMovementDestinationRef(s: string): MovementDestinationRef | null {
  const cleaned = s.toLowerCase().replace(/[\[\].]/g, "");
  if (cleaned === "bf" || cleaned === "b" || cleaned === "battlefield" || cleaned === "field") {
    return { kind: "battlefield" };
  }
  const fortressMatch = /^f(\d+)$/.exec(cleaned);
  if (!fortressMatch) return null;
  const fortressIndex = parseInt(fortressMatch[1]!, 10);
  if (fortressIndex < 1) return null;
  return { kind: "fortress", fortressIndex };
}

function parseCommaIndices(spec: string): number[] | null {
  const indices: number[] = [];
  for (const token of spec.split(",")) {
    const idx = parseIndex(token);
    if (idx === null) return null;
    indices.push(idx);
  }
  return indices;
}

function parseFortressIndexList(spec: string): number[] | null {
  const cleaned = spec.toLowerCase().replace(/^f/, "");
  return parseCommaIndices(cleaned.replace(/,f/g, ","));
}

function parseAttackerRefList(spec: string): number[] | null {
  const indices: number[] = [];
  for (const token of spec.split(",")) {
    const ref = parseEngagementEntityRef(token);
    if (!ref || ref.side !== "attacker") return null;
    indices.push(ref.index);
  }
  return indices;
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
    "  e             end the current phase when legal",
    "",
    "Commands during Combat:",
    "  decl A pN      declare a battlefield engagement with attackers A against player pN",
    "                example: decl 1 p2, or decl 1,2 p3",
    "  assault A pN fM[,fK]  declare a fortress assault against player pN's fortress(es)",
    "                example: assault 1 p2 f1, or assault 1,2 p3 f1,f2",
    "  att aN dM      normal attack: attacker aN targets defender dM",
    "  att aN fM      assault attack: attacker aN targets fortress fM",
    "  pass aN/dN     pass the acting entity's combat action",
    "  cap fN aM[,aK] capture a cleared fortress with surviving attacker(s)",
    "  burn fN        destroy a cleared fortress instead of capturing it",
    "  leave fN       leave a cleared fortress under current control",
    "",
    "Commands during Movement:",
    "  mv bN fM       move your battlefield entity N into your fortress M",
    "  mv fM.N bf     move occupant N from your fortress M to the battlefield",
    "  mv fM.N fK     move occupant N from your fortress M into your fortress K",
    "  e             end Movement when you are done repositioning",
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

/** A short one-liner shown at the bottom of the board after every render.
 *
 * The palette adapts to whether an engagement is active so users always see
 * commands relevant to the current state. Render passes `inEngagement`
 * accordingly.
 */
export function commandPaletteLine(opts: {
  phase?: "card_play" | "combat" | "movement" | "card_draw" | "victory_check";
  inEngagement?: boolean;
  actingSide?: "attacker" | "defender";
  engagementKind?: "battlefield" | "fortress_assault" | "fortress_barrage";
  awaitingAssaultResolution?: boolean;
} = {}): string {
  if (opts.inEngagement) {
    if (opts.engagementKind === "fortress_assault" && opts.awaitingAssaultResolution) {
      return "[cap f1 a1] capture   [burn f1] destroy   [leave f1] skip   [i N] inspect   [?] help   [q] quit";
    }
    if (opts.engagementKind === "fortress_assault" && opts.actingSide === "attacker") {
      return "[att a1 f1] hit fort   [att a1 d1] hit defender   [pass a1] skip   [i N] inspect   [?] help   [q] quit";
    }
    const attackHint = opts.actingSide === "defender" ? "att d1 a1" : "att a1 d1";
    const passHint = opts.actingSide === "defender" ? "pass d1" : "pass a1";
    return `[${attackHint}] attack   [${passHint}] skip   [i N] inspect   [?] help   [q] quit`;
  }
  if (opts.phase === "movement") {
    return "[mv b1 f1] move in   [mv f1.1 bf] move out   [mv f1.1 f2] shift   [e] end   [i N] inspect   [?] help   [q] quit";
  }
  return "[p N] play   [d N] discard   [decl A pN] battle   [assault A pN fM] fort   [e] end   [i N] inspect   [?] help   [q] quit";
}

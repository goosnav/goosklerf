/**
 * Goosklerf CLI entry point.
 *
 * CLI I/O glue: parse args, run setupGame, render state, parse user commands,
 * and dispatch valid game actions through @gk/engine.
 *
 * This file is deliberately thin. Everything testable lives in args.ts /
 * render.ts; main.ts is the I/O glue.
 */

import readline from "node:readline";
import process from "node:process";
import { loadCardDatabase } from "@gk/cards";
import {
  cardById,
  reduce,
  setupGame,
  type Action,
  type GameState,
  type InstanceId,
  type MovementDestinationRef as EngineMovementDestinationRef,
  type PlacementRef,
  type PlayerSpec,
} from "@gk/engine";
import { parseArgs, helpText, ArgsError } from "./args.js";
import {
  commandHelpText,
  parseCommand,
  type EngagementEntityRef,
  type EngagementTargetRef,
  type MovementDestinationRef,
  type MovementSourceRef,
  type PlayPlacementTarget,
} from "./commands.js";
import { resolveInspect } from "./inspect.js";
import { renderAll } from "./render.js";
import { runAutoplay } from "./autoplay.js";

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
  let state = setupResult.value;

  // ---- Render once and prompt ------------------------------------------
  const useColor = args.color && process.stdout.isTTY === true;
  const renderOpts = { useColor, cardDb };

  // If the first player is an AI (R1.4 picks randomly), run their turn before
  // we ever show the board to the human. This way the first thing the human
  // sees is *their* state to act on.
  state = applyAutoplay(state, cardDb);

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
        renderState(state, renderOpts, useColor);
        break;
      case "inspect": {
        const result = resolveInspect(command.target, state, cardDb, renderOpts);
        if (result.kind === "error") console.log(`inspect: ${result.message}`);
        else console.log(result.lines.join("\n"));
        break;
      }
      case "play": {
        const actionResult = playActionFromCommand(state, command.handIndex, command.placement, cardDb);
        if (actionResult.kind === "error") {
          console.log(actionResult.message);
          break;
        }
        const result = reduce(state, actionResult.action, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "discard": {
        const active = state.players.find((p) => p.id === state.activePlayerId);
        const instanceId = active?.hand[command.handIndex - 1];
        if (!active || !instanceId) {
          console.log(`discard: no card at hand position ${command.handIndex}.`);
          break;
        }
        const result = reduce(state, { kind: "DISCARD_CARD", instanceId }, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "endPhase": {
        const result = reduce(state, { kind: "END_PHASE" }, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "declareEngagement": {
        const actionResult = declareEngagementFromCommand(
          state,
          command.attackerBattlefieldIndices,
          command.defenderPlayerIndex,
        );
        if (actionResult.kind === "error") {
          console.log(actionResult.message);
          break;
        }
        const result = reduce(state, actionResult.action, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "declareFortressAssault": {
        const actionResult = declareFortressAssaultFromCommand(
          state,
          command.attackerBattlefieldIndices,
          command.defenderPlayerIndex,
          command.defenderFortressIndices,
        );
        if (actionResult.kind === "error") {
          console.log(actionResult.message);
          break;
        }
        const result = reduce(state, actionResult.action, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "attack": {
        const actionResult = attackFromCommand(
          state,
          command.source,
          command.target,
        );
        if (actionResult.kind === "error") {
          console.log(actionResult.message);
          break;
        }
        const result = reduce(state, actionResult.action, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "pass": {
        const actionResult = passFromCommand(state, command.entity);
        if (actionResult.kind === "error") {
          console.log(actionResult.message);
          break;
        }
        const result = reduce(state, actionResult.action, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "move": {
        const actionResult = moveFromCommand(state, command.source, command.destination);
        if (actionResult.kind === "error") {
          console.log(actionResult.message);
          break;
        }
        const result = reduce(state, actionResult.action, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
        break;
      }
      case "resolveAssault": {
        const actionResult = resolveAssaultFromCommand(
          state,
          command.choice,
          command.fortressIndex,
          command.garrisonAttackerIndices,
        );
        if (actionResult.kind === "error") {
          console.log(actionResult.message);
          break;
        }
        const result = reduce(state, actionResult.action, { cardDatabase: cardDb });
        if (!result.ok) console.log(result.error);
        else {
          state = applyAutoplay(result.value, cardDb);
          renderState(state, renderOpts, useColor);
        }
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

interface RenderOptions {
  useColor: boolean;
  cardDb: ReturnType<typeof loadCardDatabase>;
}

function renderState(state: GameState, renderOpts: RenderOptions, useColor: boolean): void {
  if (useColor) process.stdout.write("\x1b[2J\x1b[H");
  console.log(renderAll(state, renderOpts));
}

/**
 * Run autoplay until human input is required again. Prints a one-line
 * transcript of what the AI / stub-phases did so the human can see what
 * happened during their turn waiting.
 */
function applyAutoplay(
  state: GameState,
  cardDb: ReturnType<typeof loadCardDatabase>,
): GameState {
  const result = runAutoplay(state, { cardDb });
  if (result.events.length > 0) {
    console.log("");
    for (const e of result.events) console.log(`  ${e}`);
    console.log("");
  }
  if (result.error) {
    console.log(`autoplay error: ${result.error}`);
  }
  return result.state;
}

type ActionResult =
  | { kind: "action"; action: Action }
  | { kind: "error"; message: string };

function playActionFromCommand(
  state: GameState,
  handIndex: number,
  target: PlayPlacementTarget,
  cardDb: ReturnType<typeof loadCardDatabase>,
): ActionResult {
  const active = state.players.find((p) => p.id === state.activePlayerId);
  const instanceId = active?.hand[handIndex - 1];
  if (!active || !instanceId) {
    return { kind: "error", message: `play: no card at hand position ${handIndex}.` };
  }

  // For "auto" we need the card definition to know what placements are
  // even legal. Resolve it once and pass through.
  if (target.kind === "auto") {
    const inst = cardById(state, instanceId);
    const def = cardDb[inst.cardId];
    if (!def) return { kind: "error", message: `play: no card definition for "${inst.cardId}".` };
    const auto = autoPickPlacement(state, active.id, def);
    if (auto.kind === "error") return auto;
    return {
      kind: "action",
      action: { kind: "PLAY_CARD", instanceId, placement: auto.placement },
    };
  }

  const placementResult = placementFromTarget(state, active.id, target);
  if (placementResult.kind === "error") return placementResult;
  return {
    kind: "action",
    action: { kind: "PLAY_CARD", instanceId, placement: placementResult.placement },
  };
}

type PlacementResult =
  | { kind: "placement"; placement: PlacementRef }
  | { kind: "error"; message: string };

function placementFromTarget(
  state: GameState,
  activePlayerId: string,
  target: PlayPlacementTarget,
): PlacementResult {
  switch (target.kind) {
    case "battlefield":
      return { kind: "placement", placement: { kind: "battlefield" } };
    case "suburbs":
      return { kind: "placement", placement: { kind: "suburbs" } };
    case "fortress": {
      const active = state.players.find((p) => p.id === activePlayerId);
      const fort = active?.suburbs[target.index - 1];
      if (!active || !fort) {
        return { kind: "error", message: `play: no fortress at position ${target.index}.` };
      }
      return {
        kind: "placement",
        placement: { kind: "fortress", fortressInstanceId: fort.fortressInstanceId },
      };
    }
    case "equip": {
      const entityId = controlledEntityIdsInCliOrder(state, activePlayerId)[target.index - 1];
      if (!entityId) {
        return { kind: "error", message: `play: no owned entity at position ${target.index}.` };
      }
      return { kind: "placement", placement: { kind: "equip", entityInstanceId: entityId } };
    }
    case "auto":
      // Should not reach here — playActionFromCommand handles "auto" before
      // calling this helper. Guard defensively in case of future refactor.
      return { kind: "error", message: 'play: internal error — "auto" placement reached placementFromTarget.' };
  }
}

/**
 * Compute the legal placement options for a card and pick one if unambiguous.
 * Used by `p N` (no target) and to power friendlier error messages.
 *
 * Returns:
 *   - placement   if exactly one legal option exists, or if the card type
 *                 has only one possible placement category (e.g. items always
 *                 equip, and there's exactly one entity to equip to).
 *   - error       if zero or multiple legal options. The error message lists
 *                 the options so the user can disambiguate.
 */
function autoPickPlacement(
  state: GameState,
  activePlayerId: string,
  def: ReturnType<typeof loadCardDatabase> extends Record<string, infer C> ? C : never,
): PlacementResult {
  const opts = legalPlacementsForCard(state, activePlayerId, def);

  if (opts.length === 0) {
    return {
      kind: "error",
      message: `play: ${def.name} has no legal placement right now (capacity full or wrong board state). Try "d N" to discard.`,
    };
  }
  if (opts.length === 1) {
    return { kind: "placement", placement: opts[0]!.placement };
  }
  // Multiple options — surface them so the user can pick.
  const lines = opts.map((o) => `  ${o.hint}`);
  return {
    kind: "error",
    message: `play: ${def.name} has multiple legal placements. Pick one:\n${lines.join("\n")}`,
  };
}

interface PlacementOption {
  placement: PlacementRef;
  /** Human-readable command string the user can copy to disambiguate. */
  hint: string;
}

function legalPlacementsForCard(
  state: GameState,
  activePlayerId: string,
  def: ReturnType<typeof loadCardDatabase> extends Record<string, infer C> ? C : never,
): PlacementOption[] {
  const opts: PlacementOption[] = [];

  if (def.type === "entity") {
    const onField = state.battlefield
      .map((id) => cardById(state, id))
      .filter((c) => c.ownerId === activePlayerId).length;
    if (onField < 5) opts.push({ placement: { kind: "battlefield" }, hint: "p N bf  → battlefield" });

    const active = state.players.find((p) => p.id === activePlayerId);
    if (active) {
      active.suburbs.forEach((fort, idx) => {
        if (fort.occupantIds.length < 3) {
          const fortDef = active.suburbs[idx]!;
          opts.push({
            placement: { kind: "fortress", fortressInstanceId: fortDef.fortressInstanceId },
            hint: `p N f ${idx + 1}  → fortress ${idx + 1}`,
          });
        }
      });
    }
    return opts;
  }

  if (def.type === "fortress") {
    opts.push({ placement: { kind: "suburbs" }, hint: "p N s  → suburbs" });
    return opts;
  }

  // items: must equip
  const entities = controlledEntityIdsInCliOrder(state, activePlayerId);
  entities.forEach((id, idx) => {
    const inst = cardById(state, id);
    if (inst.equippedItemIds.length < 3) {
      opts.push({
        placement: { kind: "equip", entityInstanceId: id },
        hint: `p N e ${idx + 1}  → equip to entity ${idx + 1}`,
      });
    }
  });
  return opts;
}

function controlledEntityIdsInCliOrder(state: GameState, playerId: string): InstanceId[] {
  const ids: InstanceId[] = [];
  for (const id of state.battlefield) {
    if (cardById(state, id).ownerId === playerId) ids.push(id);
  }
  const active = state.players.find((p) => p.id === playerId);
  if (!active) return ids;
  for (const fort of active.suburbs) {
    for (const id of fort.occupantIds) ids.push(id);
  }
  return ids;
}

function activePlayer(state: GameState): NonNullable<GameState["players"][number]> | null {
  return state.players.find((p) => p.id === state.activePlayerId) ?? null;
}

/**
 * Resolve `decl 1,2 p2` → DECLARE_ENGAGEMENT action.
 *
 * Attacker battlefield indices are 1-based positions in the active player's
 * own battlefield list (only entities owned by them).
 * Defender player index is 1-based position in state.players[].
 */
function declareEngagementFromCommand(
  state: GameState,
  attackerBattlefieldIndices: number[],
  defenderPlayerIndex: number,
): ActionResult {
  const active = state.players.find((p) => p.id === state.activePlayerId);
  if (!active) return { kind: "error", message: "decl: no active player." };

  // Attacker resolution.
  const myBattlefield = state.battlefield.filter(
    (id) => cardById(state, id).ownerId === active.id,
  );
  const attackerIds: InstanceId[] = [];
  for (const idx of attackerBattlefieldIndices) {
    const id = myBattlefield[idx - 1];
    if (!id) {
      return {
        kind: "error",
        message: `decl: no battlefield entity at position ${idx} (you have ${myBattlefield.length}).`,
      };
    }
    attackerIds.push(id);
  }

  // Defender resolution.
  const defender = state.players[defenderPlayerIndex - 1];
  if (!defender) {
    return {
      kind: "error",
      message: `decl: no player p${defenderPlayerIndex} (game has ${state.players.length} players).`,
    };
  }
  if (defender.id === active.id) {
    return { kind: "error", message: "decl: cannot declare against yourself." };
  }
  return {
    kind: "action",
    action: {
      kind: "DECLARE_ENGAGEMENT",
      spec: { kind: "battlefield", defenderId: defender.id, attackerEntityIds: attackerIds },
    },
  };
}

function declareFortressAssaultFromCommand(
  state: GameState,
  attackerBattlefieldIndices: number[],
  defenderPlayerIndex: number,
  defenderFortressIndices: number[],
): ActionResult {
  const active = state.players.find((p) => p.id === state.activePlayerId);
  if (!active) return { kind: "error", message: "assault: no active player." };

  const myBattlefield = state.battlefield.filter(
    (id) => cardById(state, id).ownerId === active.id,
  );
  const attackerIds: InstanceId[] = [];
  for (const idx of attackerBattlefieldIndices) {
    const id = myBattlefield[idx - 1];
    if (!id) {
      return {
        kind: "error",
        message: `assault: no battlefield entity at position ${idx} (you have ${myBattlefield.length}).`,
      };
    }
    attackerIds.push(id);
  }

  const defender = state.players[defenderPlayerIndex - 1];
  if (!defender) {
    return {
      kind: "error",
      message: `assault: no player p${defenderPlayerIndex} (game has ${state.players.length} players).`,
    };
  }
  if (defender.id === active.id) {
    return { kind: "error", message: "assault: cannot declare against yourself." };
  }

  const targetFortressInstanceIds: InstanceId[] = [];
  for (const idx of defenderFortressIndices) {
    const fort = defender.suburbs[idx - 1];
    if (!fort) {
      return {
        kind: "error",
        message: `assault: player p${defenderPlayerIndex} has no fortress at position ${idx}.`,
      };
    }
    targetFortressInstanceIds.push(fort.fortressInstanceId);
  }

  return {
    kind: "action",
    action: {
      kind: "DECLARE_ENGAGEMENT",
      spec: {
        kind: "fortress_assault",
        defenderId: defender.id,
        attackerEntityIds: attackerIds,
        targetFortressInstanceIds,
      },
    },
  };
}

/**
 * Resolve `att aN dN` → NORMAL_ATTACK action by translating engagement-local
 * indices to the actual InstanceIds.
 */
function attackFromCommand(
  state: GameState,
  source: EngagementEntityRef,
  target: EngagementTargetRef,
): ActionResult {
  const eng = state.engagement;
  if (!eng) return { kind: "error", message: "att: no engagement is active." };

  const sourceId = engagementEntityId(eng, source);
  if (!sourceId) {
    return {
      kind: "error",
      message: `att: no ${source.side} at ${engagementRefLabel(source)}.`,
    };
  }
  const targetId = engagementTargetId(eng, target);
  if (!targetId) {
    return {
      kind: "error",
      message: `att: no ${target.side} at ${engagementRefLabel(target)}.`,
    };
  }
  return {
    kind: "action",
    action: {
      kind: "NORMAL_ATTACK",
      attackerInstanceId: sourceId,
      targetInstanceId: targetId,
    },
  };
}

function resolveAssaultFromCommand(
  state: GameState,
  choice: "capture" | "destroy" | "leave",
  fortressIndex: number,
  garrisonAttackerIndices: number[],
): ActionResult {
  const eng = state.engagement;
  if (!eng || eng.kind !== "fortress_assault") {
    return { kind: "error", message: "assault resolution: no fortress assault is active." };
  }
  const fortressInstanceId = eng.targetFortressInstanceIds[fortressIndex - 1];
  if (!fortressInstanceId) {
    return {
      kind: "error",
      message: `assault resolution: no target fortress at f${fortressIndex}.`,
    };
  }

  const garrisonEntityIds: InstanceId[] = [];
  for (const idx of garrisonAttackerIndices) {
    const id = eng.attackerEntityIds[idx - 1];
    if (!id) {
      return {
        kind: "error",
        message: `capture: no surviving attacker at a${idx}.`,
      };
    }
    garrisonEntityIds.push(id);
  }

  return {
    kind: "action",
    action: {
      kind: "RESOLVE_FORTRESS_ASSAULT",
      fortressInstanceId,
      choice,
      garrisonEntityIds,
    },
  };
}

/** Resolve `pass aN` / `pass dN` → PASS_ACTION. */
function passFromCommand(state: GameState, ref: EngagementEntityRef): ActionResult {
  const eng = state.engagement;
  if (!eng) return { kind: "error", message: "pass: no engagement is active." };
  const actingSide = ref.side === "attacker" ? "attacker" : "defender";
  if (actingSide !== eng.sideToAct) {
    return {
      kind: "error",
      message: `pass: it is ${eng.sideToAct}'s turn, not ${ref.side}'s.`,
    };
  }
  const id = engagementEntityId(eng, ref);
  if (!id) {
    return {
      kind: "error",
      message: `pass: no ${ref.side} at ${engagementRefLabel(ref)}.`,
    };
  }
  return { kind: "action", action: { kind: "PASS_ACTION", entityInstanceId: id } };
}

/**
 * Resolve Movement phase shorthand into MOVE_ENTITY.
 *
 * CLI labels are intentionally local to the active player:
 *   bN     = N-th active-player entity on the shared battlefield
 *   fM.N   = N-th occupant in active-player fortress M
 *   fK/bf  = active-player fortress K or battlefield destination
 */
function moveFromCommand(
  state: GameState,
  source: MovementSourceRef,
  destination: MovementDestinationRef,
): ActionResult {
  const active = activePlayer(state);
  if (!active) return { kind: "error", message: "move: no active player." };

  const entityInstanceId = movementSourceEntityId(state, active.id, source);
  if (!entityInstanceId) {
    if (source.kind === "battlefield") {
      const count = activeBattlefieldEntityIds(state, active.id).length;
      return {
        kind: "error",
        message: `move: no battlefield entity at b${source.index} (you have ${count}).`,
      };
    }
    const fort = active.suburbs[source.fortressIndex - 1];
    const count = fort?.occupantIds.length ?? 0;
    return {
      kind: "error",
      message: `move: no occupant at f${source.fortressIndex}.${source.occupantIndex} (that fortress has ${count}).`,
    };
  }

  const dest = movementDestination(state, active.id, destination);
  if (dest.kind === "error") return dest;
  return {
    kind: "action",
    action: {
      kind: "MOVE_ENTITY",
      entityInstanceId,
      destination: dest.destination,
    },
  };
}

function movementSourceEntityId(
  state: GameState,
  activePlayerId: string,
  source: MovementSourceRef,
): InstanceId | undefined {
  if (source.kind === "battlefield") {
    return activeBattlefieldEntityIds(state, activePlayerId)[source.index - 1];
  }
  const active = state.players.find((p) => p.id === activePlayerId);
  const fort = active?.suburbs[source.fortressIndex - 1];
  return fort?.occupantIds[source.occupantIndex - 1];
}

function activeBattlefieldEntityIds(state: GameState, activePlayerId: string): InstanceId[] {
  return state.battlefield.filter((id) => cardById(state, id).ownerId === activePlayerId);
}

type MovementDestinationResult =
  | { kind: "destination"; destination: EngineMovementDestinationRef }
  | { kind: "error"; message: string };

function movementDestination(
  state: GameState,
  activePlayerId: string,
  destination: MovementDestinationRef,
): MovementDestinationResult {
  if (destination.kind === "battlefield") {
    return { kind: "destination", destination: { kind: "battlefield" } };
  }
  const active = state.players.find((p) => p.id === activePlayerId);
  const fort = active?.suburbs[destination.fortressIndex - 1];
  if (!fort) {
    return {
      kind: "error",
      message: `move: no fortress at f${destination.fortressIndex}.`,
    };
  }
  return {
    kind: "destination",
    destination: { kind: "fortress", fortressInstanceId: fort.fortressInstanceId },
  };
}

function engagementEntityId(
  eng: NonNullable<GameState["engagement"]>,
  ref: EngagementEntityRef,
): InstanceId | undefined {
  const ids = ref.side === "attacker" ? eng.attackerEntityIds : eng.defenderEntityIds;
  return ids[ref.index - 1];
}

function engagementTargetId(
  eng: NonNullable<GameState["engagement"]>,
  ref: EngagementTargetRef,
): InstanceId | undefined {
  if (ref.side === "fortress") return eng.targetFortressInstanceIds[ref.index - 1];
  return engagementEntityId(eng, ref);
}

function engagementRefLabel(ref: EngagementTargetRef): string {
  if (ref.side === "fortress") return `f${ref.index}`;
  return `${ref.side === "attacker" ? "a" : "d"}${ref.index}`;
}

/**
 * Pure render functions over GameState. No I/O, no readline, no chalk.
 *
 * Each function returns an array of strings (one per row). The driver in
 * main.ts joins them with newlines and prints. This keeps everything
 * snapshot-testable: a test can call renderBoard(state) and expect a stable
 * string array regardless of terminal width or color setting.
 *
 * Color is applied via the `colorize` helper, which is a no-op when
 * `useColor=false`. Snapshots run with `useColor=false` for stability.
 */

import pc from "picocolors";
import type { CardDatabase } from "@gk/cards";
import type { GameState, Player, CardInstance } from "@gk/engine";
import { findPlayer, cardById, totalFortressesOnBoard, entityStats } from "@gk/engine";
import { TYPE_ICON, PHASE_LABEL, dieFace, TEXT_INACTIVE } from "./glyphs.js";
import { commandPaletteLine } from "./commands.js";

// -----------------------------------------------------------------------------
// Color helpers
// -----------------------------------------------------------------------------

interface RenderOptions {
  useColor: boolean;
  /** Card database for stat/name lookup. */
  cardDb: CardDatabase;
}

/** Apply a picocolors style only if useColor is true. */
function tint(useColor: boolean, fn: (s: string) => string, s: string): string {
  return useColor ? fn(s) : s;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

// -----------------------------------------------------------------------------
// Public renderers
// -----------------------------------------------------------------------------

/** Single banner row at the top of the screen. */
export function renderHeader(state: GameState, opts: RenderOptions): string[] {
  const active = findPlayer(state, state.activePlayerId);
  const phase = PHASE_LABEL[state.phase] ?? state.phase;
  const title = `Goosklerf — turn ${state.turnNumber} — ${active?.name ?? "?"}'s ${phase} phase`;
  const meta = `seed: ${state.seed}   regime: ${state.deckSize}   fortresses on board: ${totalFortressesOnBoard(state)}`;
  return [
    tint(opts.useColor, pc.bold, title),
    tint(opts.useColor, pc.dim, meta),
    tint(opts.useColor, pc.dim, "─".repeat(Math.max(title.length, meta.length))),
  ];
}

/**
 * The board: per-player suburbs (with fortress + occupants) and the shared
 * battlefield. Sprint 4 prints this for all players at once; later sprints
 * may abbreviate non-active players for screen-space reasons.
 */
export function renderBoard(state: GameState, opts: RenderOptions): string[] {
  const lines: string[] = [];
  lines.push(tint(opts.useColor, pc.bold, "BATTLEFIELD"));
  if (state.battlefield.length === 0) {
    lines.push("  (empty)");
  } else {
    for (const id of state.battlefield) {
      const inst = cardById(state, id);
      lines.push("  " + describeEntity(state, inst, opts));
    }
  }
  lines.push("");
  lines.push(tint(opts.useColor, pc.bold, "SUBURBS"));
  for (const player of state.players) {
    lines.push(...renderPlayerSuburb(player, state, opts));
  }
  return lines;
}

function renderPlayerSuburb(
  player: Player,
  state: GameState,
  opts: RenderOptions,
): string[] {
  const lines: string[] = [];
  const active = state.activePlayerId === player.id;
  const indicator = active ? "▶ " : "  ";
  const handCount = player.hand.length;
  const deckCount = player.deck.length;
  const shopCount = player.shop.length;
  const oa = player.oldAgeCounter > 0 ? `   oldAge:${player.oldAgeCounter}/3` : "";
  const ll = player.landlord.pending ? `   ⚠landlord:${player.landlord.roundsRemaining}` : "";
  const header = `${indicator}${player.name}  (${player.kind}${player.personality ? "/" + player.personality : ""})   hand:${handCount}  deck:${deckCount}  shop:${shopCount}${oa}${ll}`;
  lines.push(tint(opts.useColor, active ? pc.cyan : pc.white, header));

  if (player.suburbs.length === 0) {
    lines.push("    (no fortresses placed)");
  } else {
    for (const fort of player.suburbs) {
      const fInst = cardById(state, fort.fortressInstanceId);
      const fDef = opts.cardDb[fInst.cardId];
      const fName = fDef?.name ?? fInst.cardId;
      const occN = fort.occupantIds.length;
      lines.push(`    ${TYPE_ICON.fortress} ${fName}   HP:${dieFace(fInst.hp)}   occupants:${occN}/3`);
      for (const occId of fort.occupantIds) {
        const occ = cardById(state, occId);
        lines.push("        " + describeEntity(state, occ, opts));
      }
    }
  }
  return lines;
}

function describeEntity(state: GameState, inst: CardInstance, opts: RenderOptions): string {
  const def = opts.cardDb[inst.cardId];
  const name = def?.name ?? inst.cardId;
  const stats = entityStats(state, inst, opts.cardDb);
  const items = inst.equippedItemIds.length;
  const inactive = def?.hasSpecial ? ` ${TEXT_INACTIVE}` : "";
  return `${TYPE_ICON.entity} ${name}   ATK:${attackDisplay(stats.printedAttack, stats.modifiedAttack)}  HP:${hpDisplay(inst.hp, stats.modifiedMaxHp)}  items:${items}/3${inactive}`;
}

/** The active player's hand. */
export function renderHand(state: GameState, opts: RenderOptions): string[] {
  const player = findPlayer(state, state.activePlayerId);
  if (!player) return [];
  const lines: string[] = [tint(opts.useColor, pc.bold, `HAND (${player.name})`)];
  if (player.hand.length === 0) {
    lines.push("  (empty)");
    return lines;
  }
  player.hand.forEach((id, idx) => {
    const inst = cardById(state, id);
    const def = opts.cardDb[inst.cardId];
    const name = def?.name ?? inst.cardId;
    const icon = def ? TYPE_ICON[def.type] : "?";
    const stat = def?.type === "entity"
      ? `ATK:${def.baseAttack ?? "?"} HP:${def.baseHp ?? "?"}`
      : def?.type === "fortress"
      ? `HP:${def.fortressHp ?? "?"}${def.hpBuff ? ` ${signed(def.hpBuff)} HP buff` : ""}`
      : def?.type === "item_regular"
      ? `${def.attackBuff ? `${signed(def.attackBuff)} ATK ` : ""}${def.hpBuff ? `${signed(def.hpBuff)} HP` : ""}`.trim() || "no buffs"
      : def?.type === "item_consumable"
      ? "consumable"
      : "?";
    const inactive = def?.hasSpecial ? ` ${TEXT_INACTIVE}` : "";
    lines.push(`  [${idx + 1}] ${icon} ${name}   ${stat}${inactive}`);
  });
  return lines;
}

/** The active player's shop row. */
export function renderShop(state: GameState, opts: RenderOptions): string[] {
  const player = findPlayer(state, state.activePlayerId);
  if (!player) return [];
  if (player.shop.length === 0) return [];
  const lines: string[] = [tint(opts.useColor, pc.bold, "SHOP (yours)")];
  player.shop.forEach((id, idx) => {
    const inst = cardById(state, id);
    const def = opts.cardDb[inst.cardId];
    const name = def?.name ?? inst.cardId;
    const icon = def ? TYPE_ICON[def.type] : "?";
    const rarity = def?.rarity === "rare" ? " (rare)" : "";
    const inactive = def?.hasSpecial ? ` ${TEXT_INACTIVE}` : "";
    lines.push(`  [${idx + 1}] ${icon} ${name}${rarity}${inactive}`);
  });
  return lines;
}

/** Recent log entries. By default the last `lastN` (default 8). */
export function renderLog(state: GameState, opts: RenderOptions, lastN = 8): string[] {
  if (state.log.length === 0) return [];
  const start = Math.max(0, state.log.length - lastN);
  const lines: string[] = [tint(opts.useColor, pc.bold, "LOG")];
  for (let i = start; i < state.log.length; i++) {
    const e = state.log[i]!;
    const ruleTag = tint(opts.useColor, pc.dim, `[${e.rule}]`);
    lines.push(`  ${ruleTag} ${e.message}`);
  }
  return lines;
}

/**
 * Active engagement panel. Shown only when `state.engagement !== null`.
 *
 * Indices:
 *   [aN] — N-th attacker entity in engagement.attackerEntityIds
 *   [dN] — N-th defender entity in engagement.defenderEntityIds
 *   [fN] — N-th target fortress in engagement.targetFortressInstanceIds
 * Users type these directly: `att a1 d1`, `att a1 f1`, `pass a1`, etc.
 */
export function renderEngagement(state: GameState, opts: RenderOptions): string[] {
  const eng = state.engagement;
  if (!eng) return [];

  const lines: string[] = [];
  const attacker = findPlayer(state, eng.attackerSide);
  const defender = findPlayer(state, eng.defenderSide);
  const sideLabel = eng.sideToAct === "attacker" ? "ATTACKER's turn" : "DEFENDER's turn";
  lines.push(
    tint(
      opts.useColor,
      pc.bold,
      `ENGAGEMENT — round ${eng.round}, ${sideLabel}   (${eng.kind})`,
    ),
  );

  // Attacker side
  lines.push(
    tint(opts.useColor, pc.cyan, `  ATTACKERS — ${attacker?.name ?? eng.attackerSide}`),
  );
  if (eng.attackerEntityIds.length === 0) {
    lines.push("    (none — engagement is ending)");
  } else {
    eng.attackerEntityIds.forEach((id, idx) => {
      lines.push("    " + describeEngagementEntity(state, opts, id, `a${idx + 1}`, eng.actionsRemainingByEntity[id] ?? 0));
    });
  }
  // Defender side
  lines.push(
    tint(opts.useColor, pc.yellow, `  DEFENDERS — ${defender?.name ?? eng.defenderSide}`),
  );
  if (eng.defenderEntityIds.length === 0) {
    lines.push("    (none — engagement is ending)");
  } else {
    eng.defenderEntityIds.forEach((id, idx) => {
      lines.push("    " + describeEngagementEntity(state, opts, id, `d${idx + 1}`, eng.actionsRemainingByEntity[id] ?? 0));
    });
  }

  if (eng.kind === "fortress_assault") {
    lines.push(tint(opts.useColor, pc.magenta, "  TARGET FORTRESSES"));
    if (eng.targetFortressInstanceIds.length === 0) {
      lines.push("    (all resolved)");
    } else {
      eng.targetFortressInstanceIds.forEach((id, idx) => {
        lines.push("    " + describeEngagementFortress(state, opts, id, `f${idx + 1}`));
      });
    }
  }
  return lines;
}

function describeEngagementEntity(
  state: GameState,
  opts: RenderOptions,
  instanceId: string,
  label: string,
  actionsRemaining: number,
): string {
  const inst = cardById(state, instanceId);
  const def = opts.cardDb[inst.cardId];
  const name = def?.name ?? inst.cardId;
  const stats = entityStats(state, inst, opts.cardDb);
  const items = inst.equippedItemIds.length;
  const inactive = def?.hasSpecial ? ` ${TEXT_INACTIVE}` : "";
  const status = actionsRemaining > 0 ? "ready" : "acted";
  const statusTint = actionsRemaining > 0
    ? tint(opts.useColor, pc.green, status)
    : tint(opts.useColor, pc.dim, status);
  return `[${label}] ${TYPE_ICON.entity} ${name}   ATK:${attackDisplay(stats.printedAttack, stats.modifiedAttack)}  HP:${hpDisplay(inst.hp, stats.modifiedMaxHp)}  items:${items}/3  ${statusTint}${inactive}`;
}

function describeEngagementFortress(
  state: GameState,
  opts: RenderOptions,
  instanceId: string,
  label: string,
): string {
  const inst = cardById(state, instanceId);
  const def = opts.cardDb[inst.cardId];
  const name = def?.name ?? inst.cardId;
  const occupantCount = state.players
    .flatMap((p) => p.suburbs)
    .find((f) => f.fortressInstanceId === instanceId)?.occupantIds.length ?? 0;
  return `[${label}] ${TYPE_ICON.fortress} ${name}   HP:${dieFace(inst.hp)}  occupants:${occupantCount}/3`;
}

function attackDisplay(printed: number, modified: number): string {
  return printed === modified ? `${printed}` : `${modified} (${signed(modified - printed)})`;
}

function hpDisplay(current: number, max: number): string {
  return current === max ? dieFace(current) : `${dieFace(current)}/${max}`;
}

/** Bottom prompt — what the user can type. Adapts to whether an engagement is active. */
export function renderPrompt(state: GameState, opts: RenderOptions): string[] {
  const inEngagement = state.engagement !== null;
  const awaitingAssaultResolution =
    state.engagement?.kind === "fortress_assault" &&
    state.engagement.defenderEntityIds.length === 0 &&
    state.engagement.targetFortressInstanceIds.length > 0;
  return [
    "",
    tint(opts.useColor, pc.dim, `── ${commandPaletteLine({
      phase: state.phase,
      inEngagement,
      actingSide: state.engagement?.sideToAct,
      engagementKind: state.engagement?.kind,
      awaitingAssaultResolution,
    })} ──`),
  ];
}

/** Full screen render. Caller usually clears the terminal first. */
export function renderAll(state: GameState, opts: RenderOptions): string {
  const blocks: string[][] = [
    renderHeader(state, opts),
    [""],
    renderBoard(state, opts),
    [""],
  ];
  if (state.engagement) {
    blocks.push(renderEngagement(state, opts), [""]);
  } else {
    blocks.push(renderHand(state, opts), [""]);
    blocks.push(renderShop(state, opts), [""]);
  }
  blocks.push(renderLog(state, opts));
  blocks.push(renderPrompt(state, opts));
  return blocks.flat().join("\n");
}

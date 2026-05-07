/**
 * Card-inspection rendering.
 *
 * Two flavors:
 *   formatCardDefinition  — prints what's printed on the card. Used when the
 *                           user types `i <card-id>` or when no instance
 *                           context exists.
 *   formatCardInstance    — adds runtime fields (current HP, current zone,
 *                           equipped items, owner). Used for cards already in
 *                           play.
 *
 * Resolution helpers convert "i 3" / "i s 1" / etc. to the correct lookup
 * against GameState. They return `Result`-like outcomes so the caller can
 * surface friendly errors ("no card at hand position 3").
 */

import pc from "picocolors";
import type { CardDatabase, CardDefinition, CardType, Rarity } from "@gk/cards";
import type { CardInstance, GameState } from "@gk/engine";
import { findPlayer, cardById, entityStats } from "@gk/engine";
import { TYPE_ICON, dieFace, TEXT_INACTIVE } from "./glyphs.js";
import type { InspectTarget } from "./commands.js";

interface FormatOptions {
  useColor: boolean;
}

const TYPE_LABEL: Record<CardType, string> = {
  entity: "entity",
  fortress: "fortress",
  item_regular: "item (equipped)",
  item_consumable: "item (consumable)",
};

const RARITY_LABEL: Record<Rarity, string> = {
  normal: "normal",
  rare: "rare",
};

function tint(useColor: boolean, fn: (s: string) => string, s: string): string {
  return useColor ? fn(s) : s;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

// -----------------------------------------------------------------------------
// Public formatters
// -----------------------------------------------------------------------------

/** Just-the-card-sheet view. No runtime state. */
export function formatCardDefinition(def: CardDefinition, opts: FormatOptions): string[] {
  const lines: string[] = [];
  const icon = TYPE_ICON[def.type];
  const inactive = def.hasSpecial ? `  ${TEXT_INACTIVE} text silenced at M1` : "";

  lines.push(tint(opts.useColor, pc.bold, `─── ${icon}  ${def.name} ───`));
  lines.push(`  type:    ${TYPE_LABEL[def.type]} (${RARITY_LABEL[def.rarity]})`);
  lines.push(`  id:      ${def.id}`);

  if (def.type === "entity") {
    const atk = def.baseAttack ?? "?";
    const hp = def.baseHp ?? "?";
    lines.push(`  attack:  ${atk}   (hit on 1d6 ≤ ${atk}; R6.5)`);
    lines.push(`  hp:      ${hp}   (max 6 per die; R2.6)`);
  } else if (def.type === "fortress") {
    const fhp = def.fortressHp ?? "?";
    lines.push(`  hp:      ${fhp}   (R2.3)`);
    if (def.hpBuff) {
      lines.push(`  buff:    ${signed(def.hpBuff)} HP to occupants (R3.10)`);
    }
  } else {
    if (def.attackBuff) lines.push(`  buff:    ${signed(def.attackBuff)} attack`);
    if (def.hpBuff) lines.push(`  buff:    ${signed(def.hpBuff)} HP`);
    if (!def.attackBuff && !def.hpBuff) {
      lines.push(`  buff:    none (text-driven if any)`);
    }
  }

  if (def.rulesText && def.rulesText.trim() !== "") {
    lines.push("");
    lines.push(tint(opts.useColor, pc.dim, "  text:"));
    for (const para of wrapText(def.rulesText, 70)) {
      lines.push(`    ${para}`);
    }
  }

  if (inactive) {
    lines.push(tint(opts.useColor, pc.yellow, `  status:${inactive}`));
  }

  return lines;
}

/** Card sheet PLUS runtime state (current HP, items equipped, current zone). */
export function formatCardInstance(
  inst: CardInstance,
  state: GameState,
  cardDb: CardDatabase,
  opts: FormatOptions,
): string[] {
  const def = cardDb[inst.cardId];
  if (!def) {
    return [tint(opts.useColor, pc.red, `(no card definition for id "${inst.cardId}")`)];
  }
  const lines = formatCardDefinition(def, opts);

  // Append runtime block.
  lines.push("");
  lines.push(tint(opts.useColor, pc.dim, "  runtime:"));
  const owner = findPlayer(state, inst.ownerId);
  lines.push(`    owner:    ${owner?.name ?? inst.ownerId}`);
  lines.push(`    zone:     ${describeZone(inst.zone)}`);

  if (def.type === "entity" || def.type === "fortress") {
    lines.push(`    hp now:   ${dieFace(inst.hp)} (${inst.hp})`);
  }
  if (def.type === "entity") {
    const stats = entityStats(state, inst, cardDb);
    lines.push(`    attack:   ${stats.modifiedAttack} current (${stats.printedAttack} printed)`);
    lines.push(`    max hp:   ${stats.modifiedMaxHp} current (${stats.printedMaxHp} printed)`);
    lines.push(`    items:    ${inst.equippedItemIds.length} / 3`);
    if (inst.equippedItemIds.length > 0) {
      const itemNames = inst.equippedItemIds
        .map((id) => {
          const itemInst = state.cardsByInstanceId[id];
          if (!itemInst) return id;
          return cardDb[itemInst.cardId]?.name ?? itemInst.cardId;
        })
        .join(", ");
      lines.push(`    equipped: ${itemNames}`);
    }
  }
  if (def.type === "item_consumable" && inst.consumed) {
    lines.push(tint(opts.useColor, pc.dim, "    consumed: yes (en route to graveyard)"));
  }

  return lines;
}

// -----------------------------------------------------------------------------
// Target resolution
// -----------------------------------------------------------------------------

export type InspectResult =
  | { kind: "definition"; lines: string[] }
  | { kind: "instance"; lines: string[] }
  | { kind: "error"; message: string };

/**
 * Resolve an InspectTarget against the current state and produce printable
 * lines. The active player is the implicit subject for index-based targets
 * (hand, shop) — that's the player we're rendering for.
 */
export function resolveInspect(
  target: InspectTarget,
  state: GameState,
  cardDb: CardDatabase,
  opts: FormatOptions,
): InspectResult {
  const active = findPlayer(state, state.activePlayerId);
  if (!active) return { kind: "error", message: "no active player" };

  switch (target.kind) {
    case "hand": {
      const idArr = active.hand;
      const id = idArr[target.index - 1];
      if (!id) {
        return { kind: "error", message: `no card at hand position ${target.index} (you have ${idArr.length} cards in hand).` };
      }
      const inst = cardById(state, id);
      return { kind: "instance", lines: formatCardInstance(inst, state, cardDb, opts) };
    }
    case "shop": {
      const idArr = active.shop;
      const id = idArr[target.index - 1];
      if (!id) {
        return { kind: "error", message: `no card at shop position ${target.index} (your shop has ${idArr.length} cards).` };
      }
      const inst = cardById(state, id);
      return { kind: "instance", lines: formatCardInstance(inst, state, cardDb, opts) };
    }
    case "battlefield": {
      // The battlefield is shared. We index by render order (state.battlefield array order).
      const id = state.battlefield[target.index - 1];
      if (!id) {
        return { kind: "error", message: `no entity at battlefield position ${target.index} (battlefield has ${state.battlefield.length} entities).` };
      }
      const inst = cardById(state, id);
      return { kind: "instance", lines: formatCardInstance(inst, state, cardDb, opts) };
    }
    case "fortress": {
      // Index into the active player's suburbs.
      const fort = active.suburbs[target.index - 1];
      if (!fort) {
        return { kind: "error", message: `no fortress at position ${target.index} (you have ${active.suburbs.length} fortresses).` };
      }
      const inst = cardById(state, fort.fortressInstanceId);
      return { kind: "instance", lines: formatCardInstance(inst, state, cardDb, opts) };
    }
    case "card_id": {
      const def = cardDb[target.id];
      if (!def) {
        return { kind: "error", message: `no card with id "${target.id}". (Try the lower-snake-case slug, e.g., "butcher_worm".)` };
      }
      return { kind: "definition", lines: formatCardDefinition(def, opts) };
    }
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function describeZone(z: CardInstance["zone"]): string {
  switch (z.zone) {
    case "battlefield": return `battlefield (owner: ${z.ownerId})`;
    case "fortress":    return `fortress ${z.fortressInstanceId} (owner: ${z.ownerId})`;
    case "suburbs":     return `suburbs (owner: ${z.ownerId})`;
    case "equipped":    return `equipped to ${z.entityInstanceId} (owner: ${z.ownerId})`;
    case "hand":        return `hand (owner: ${z.ownerId})`;
    case "deck":        return `deck (owner: ${z.ownerId})`;
    case "graveyard":   return `graveyard (owner: ${z.ownerId})`;
    case "shop":        return `shop (owner: ${z.ownerId})`;
  }
}

/** Word-wrap a paragraph to a max line width. Naive; no fancy locale handling. */
function wrapText(text: string, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if (line.length === 0) {
      line = w;
    } else if (line.length + 1 + w.length <= width) {
      line += " " + w;
    } else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

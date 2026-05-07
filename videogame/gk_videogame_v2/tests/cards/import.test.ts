/**
 * CSV row → CardDefinition conversion tests.
 *
 * Covers:
 *   R2.1  card type normalization
 *   R2.2  entities tagged data_error if missing baseAttack/baseHp
 *   automationStatus state machine
 */

import { describe, expect, it } from "vitest";
import { rowToCardDefinition, generateCardId } from "@gk/cards";

describe("generateCardId", () => {
  it("produces stable lowercase slugs", () => {
    expect(generateCardId("BUTCHER WORM")).toBe("butcher_worm");
  });

  it("collapses non-alphanumerics", () => {
    expect(generateCardId("Lord Flumpuqat-3!")).toBe("lord_flumpuqat_3");
  });

  it("trims trailing underscores", () => {
    expect(generateCardId(" leading and trailing  ")).toBe("leading_and_trailing");
  });
});

describe("rowToCardDefinition — automation status state machine", () => {
  it("vanilla entity → fully_implemented", () => {
    const card = rowToCardDefinition({
      filename: "wormson.jpg",
      card_name: "WORMSON",
      card_type: "entity",
      hp: "3",
      attack: "3",
      has_special: "",
      description: "A worm.",
    } as Record<string, string>);
    expect(card.automationStatus).toBe("fully_implemented");
    expect(card.baseAttack).toBe(3);
    expect(card.baseHp).toBe(3);
  });

  it("entity with has_special=Y → not_implemented (M1 excludes from decks)", () => {
    const card = rowToCardDefinition({
      filename: "magic.jpg",
      card_name: "MAGIC WORM",
      card_type: "entity",
      hp: "3",
      attack: "3",
      has_special: "Y",
      description: "Does magic.",
    } as Record<string, string>);
    expect(card.automationStatus).toBe("not_implemented");
    expect(card.hasSpecial).toBe(true);
  });

  it("entity missing baseAttack → data_error (R2.2)", () => {
    const card = rowToCardDefinition({
      filename: "broken.jpg",
      card_name: "BROKEN",
      card_type: "entity",
      hp: "3",
      attack: "",
      has_special: "",
    } as Record<string, string>);
    expect(card.automationStatus).toBe("data_error");
  });

  it("data_error wins over not_implemented when both apply", () => {
    const card = rowToCardDefinition({
      filename: "doubly_broken.jpg",
      card_name: "DOUBLY BROKEN",
      card_type: "entity",
      hp: "",
      attack: "",
      has_special: "Y",
    } as Record<string, string>);
    expect(card.automationStatus).toBe("data_error");
  });

  it("fortress with fortressHp → fully_implemented", () => {
    const card = rowToCardDefinition({
      filename: "farmhouse.jpg",
      card_name: "FARMHOUSE",
      card_type: "fortress",
      fortress_hp: "4",
      has_special: "",
    } as Record<string, string>);
    expect(card.automationStatus).toBe("fully_implemented");
    expect(card.fortressHp).toBe(4);
  });

  it("plain item → fully_implemented even without buffs (R2.4)", () => {
    const card = rowToCardDefinition({
      filename: "rock.jpg",
      card_name: "ROCK",
      card_type: "item_regular",
      has_special: "",
    } as Record<string, string>);
    expect(card.automationStatus).toBe("fully_implemented");
  });
});

describe("rowToCardDefinition — type normalization (R2.1)", () => {
  it("accepts both 'item_regular' and 'item regular' spellings", () => {
    const a = rowToCardDefinition({ card_name: "A", card_type: "item_regular" } as Record<string, string>);
    const b = rowToCardDefinition({ card_name: "B", card_type: "item regular" } as Record<string, string>);
    expect(a.type).toBe("item_regular");
    expect(b.type).toBe("item_regular");
  });
});

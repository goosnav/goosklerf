/**
 * Schema-level validation tests.
 *
 * Covers requirements:
 *   R2.1  card types overview (entity, fortress, item_regular, item_consumable)
 *   R2.2  entities must declare baseAttack and baseHp
 *   R2.3  fortresses must declare fortressHp
 *   R2.4  items have no additional required stats
 */

import { describe, expect, it } from "vitest";
import { CardDefinitionSchema, validateCard } from "@gk/cards";

describe("R2.1 — card type enumeration", () => {
  it("accepts the four documented card types", () => {
    for (const type of ["entity", "fortress", "item_regular", "item_consumable"] as const) {
      const result = CardDefinitionSchema.safeParse({
        id: "x",
        name: "X",
        filename: "x.png",
        type,
        rarity: "normal",
        rulesText: "",
        hasSpecial: false,
        automationStatus: "fully_implemented",
      });
      expect(result.success, `type ${type} should be accepted`).toBe(true);
    }
  });

  it("rejects unknown card types", () => {
    const result = CardDefinitionSchema.safeParse({
      id: "x",
      name: "X",
      filename: "x.png",
      type: "spell",
      rarity: "normal",
      rulesText: "",
      hasSpecial: false,
      automationStatus: "fully_implemented",
    });
    expect(result.success).toBe(false);
  });

  it("accepts both rarities", () => {
    for (const rarity of ["normal", "rare"] as const) {
      const result = CardDefinitionSchema.safeParse({
        id: "x",
        name: "X",
        filename: "x.png",
        type: "entity",
        rarity,
        baseAttack: 3,
        baseHp: 3,
        rulesText: "",
        hasSpecial: false,
        automationStatus: "fully_implemented",
      });
      expect(result.success, `rarity ${rarity} should be accepted`).toBe(true);
    }
  });
});

describe("R2.2 — entity required fields", () => {
  it("flags entities missing baseAttack", () => {
    const errors = validateCard({
      id: "no_attack",
      name: "NO ATTACK",
      type: "entity",
      baseHp: 3,
    });
    expect(errors.some((e) => e.includes("baseAttack"))).toBe(true);
  });

  it("flags entities missing baseHp", () => {
    const errors = validateCard({
      id: "no_hp",
      name: "NO HP",
      type: "entity",
      baseAttack: 3,
    });
    expect(errors.some((e) => e.includes("baseHp"))).toBe(true);
  });

  it("accepts entities with both baseAttack and baseHp", () => {
    const errors = validateCard({
      id: "good_entity",
      name: "GOOD",
      type: "entity",
      baseAttack: 3,
      baseHp: 3,
    });
    expect(errors).toEqual([]);
  });
});

describe("R2.3 — fortress required fields", () => {
  it("flags fortresses missing fortressHp", () => {
    const errors = validateCard({
      id: "no_fhp",
      name: "NO FHP",
      type: "fortress",
    });
    expect(errors.some((e) => e.includes("fortressHp"))).toBe(true);
  });

  it("accepts fortresses with fortressHp", () => {
    const errors = validateCard({
      id: "good_fortress",
      name: "GOOD F",
      type: "fortress",
      fortressHp: 4,
    });
    expect(errors).toEqual([]);
  });
});

describe("R2.4 — items have no stat requirements", () => {
  it("accepts buffless items of either subtype", () => {
    for (const type of ["item_regular", "item_consumable"] as const) {
      const errors = validateCard({
        id: "plain_item",
        name: "PLAIN",
        type,
      });
      expect(errors).toEqual([]);
    }
  });

  it("accepts items with attack/hp buffs", () => {
    const errors = validateCard({
      id: "hammer",
      name: "HAMMER",
      type: "item_regular",
      attackBuff: 1,
      hpBuff: 1,
    });
    expect(errors).toEqual([]);
  });
});

describe("structural validation", () => {
  it("flags missing id and name", () => {
    const errors = validateCard({ type: "entity", baseAttack: 3, baseHp: 3 });
    expect(errors.some((e) => e.includes("missing id"))).toBe(true);
    expect(errors.some((e) => e.includes("missing name"))).toBe(true);
  });

  it("flags missing type", () => {
    const errors = validateCard({ id: "x", name: "X" });
    expect(errors.some((e) => e.includes("missing type"))).toBe(true);
  });
});

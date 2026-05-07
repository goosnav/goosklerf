/**
 * CLI argument parser tests.
 *
 * Covers the contract in apps/play-cli/src/args.ts: defaults, flag parsing,
 * validation, and error reporting.
 */

import { describe, expect, it } from "vitest";
import { parseArgs, ArgsError } from "../../apps/play-cli/src/args.js";

describe("parseArgs — defaults", () => {
  it("returns sensible defaults when no flags are given", () => {
    const previousNoColor = process.env["NO_COLOR"];
    delete process.env["NO_COLOR"];
    try {
      const args = parseArgs([]);
      expect(args.seed).toBe("default");
      expect(args.players).toBe(4);
      expect(args.deckSize).toBe("medium");
      expect(args.shop).toBe(true);
      expect(args.scriptPath).toBeNull();
      expect(args.color).toBe(true);
      expect(args.help).toBe(false);
    } finally {
      if (previousNoColor === undefined) delete process.env["NO_COLOR"];
      else process.env["NO_COLOR"] = previousNoColor;
    }
  });
});

describe("parseArgs — flag handling", () => {
  it("--seed sets the seed", () => {
    expect(parseArgs(["--seed", "abc"]).seed).toBe("abc");
  });

  it("--players sets and validates", () => {
    expect(parseArgs(["--players", "3"]).players).toBe(3);
    expect(() => parseArgs(["--players", "1"])).toThrow(ArgsError);
    expect(() => parseArgs(["--players", "5"])).toThrow(ArgsError);
    expect(() => parseArgs(["--players", "abc"])).toThrow(ArgsError);
  });

  it("--deck-size accepts small|medium|large only", () => {
    expect(parseArgs(["--deck-size", "small"]).deckSize).toBe("small");
    expect(parseArgs(["--deck-size", "large"]).deckSize).toBe("large");
    expect(() => parseArgs(["--deck-size", "huge"])).toThrow(ArgsError);
  });

  it("--no-shop disables shop; --shop re-enables", () => {
    expect(parseArgs(["--no-shop"]).shop).toBe(false);
    expect(parseArgs(["--no-shop", "--shop"]).shop).toBe(true);
  });

  it("--script captures the path", () => {
    expect(parseArgs(["--script", "/tmp/t.json"]).scriptPath).toBe("/tmp/t.json");
    expect(() => parseArgs(["--script"])).toThrow(ArgsError);
  });

  it("--no-color disables color", () => {
    expect(parseArgs(["--no-color"]).color).toBe(false);
  });

  it("--help / -h sets help flag", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("ignores leading -- (pnpm injects it)", () => {
    const args = parseArgs(["--", "--seed", "x"]);
    expect(args.seed).toBe("x");
  });

  it("ignores empty-string args (some launchers add them)", () => {
    const args = parseArgs(["", "--seed", "x", ""]);
    expect(args.seed).toBe("x");
  });

  it("rejects unknown flags", () => {
    expect(() => parseArgs(["--bananas"])).toThrow(ArgsError);
  });
});

describe("parseArgs — combinations", () => {
  it("multiple flags compose", () => {
    const args = parseArgs([
      "--seed", "abc",
      "--players", "2",
      "--deck-size", "large",
      "--no-shop",
      "--no-color",
    ]);
    expect(args).toMatchObject({
      seed: "abc",
      players: 2,
      deckSize: "large",
      shop: false,
      color: false,
    });
  });
});

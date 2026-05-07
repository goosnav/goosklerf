/**
 * CLI command parser tests.
 *
 * Covers Sprint 5 Card Play verbs plus the existing inspect/render/help shell.
 */

import { describe, expect, it } from "vitest";
import { parseCommand, commandHelpText } from "../../apps/play-cli/src/commands.js";

describe("parseCommand — Card Play verbs", () => {
  it("R5.2 — parses battlefield play", () => {
    expect(parseCommand("p 2 bf")).toEqual({
      kind: "play",
      handIndex: 2,
      placement: { kind: "battlefield" },
    });
  });

  it("R5.2 — parses fortress and suburbs play", () => {
    expect(parseCommand("p 1 f 3")).toEqual({
      kind: "play",
      handIndex: 1,
      placement: { kind: "fortress", index: 3 },
    });
    expect(parseCommand("play [2] suburbs")).toEqual({
      kind: "play",
      handIndex: 2,
      placement: { kind: "suburbs" },
    });
  });

  it("R5.2 / R5.4 — parses equip play", () => {
    expect(parseCommand("p 4 e 1")).toEqual({
      kind: "play",
      handIndex: 4,
      placement: { kind: "equip", index: 1 },
    });
  });

  it("R5.1 — parses discard and end phase", () => {
    expect(parseCommand("d 3")).toEqual({ kind: "discard", handIndex: 3 });
    expect(parseCommand("e")).toEqual({ kind: "endPhase" });
  });

  it("returns unknown for malformed Card Play commands", () => {
    expect(parseCommand("p nope bf").kind).toBe("unknown");
    expect(parseCommand("d").kind).toBe("unknown");
    expect(parseCommand("e now").kind).toBe("unknown");
  });

  it("`p N` (no target) parses as auto-pick", () => {
    expect(parseCommand("p 3")).toEqual({
      kind: "play",
      handIndex: 3,
      placement: { kind: "auto" },
    });
    // Bracketed index (copy/paste from the rendered hand) also works.
    expect(parseCommand("p [2]")).toEqual({
      kind: "play",
      handIndex: 2,
      placement: { kind: "auto" },
    });
  });

  it("`p` alone is unknown (still requires a hand index)", () => {
    expect(parseCommand("p").kind).toBe("unknown");
  });
});

describe("parseCommand — autoplay-related sanity", () => {
  it("the help text mentions both `p N` (auto) and `p N <target>` forms", () => {
    // We don't snapshot the entire help, but assert the two key forms appear.
    // This guards against doc drift if the parser changes but help is forgotten.
    const helpJoined = commandHelpText().join("\n");
    expect(helpJoined).toContain("p N");
    expect(helpJoined).toContain("p N bf");
    expect(helpJoined).toContain("p N e M");
  });
});

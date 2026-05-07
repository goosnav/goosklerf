/**
 * CLI command parser tests.
 *
 * Covers Card Play, Combat, Movement, and the inspect/render/help shell.
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

describe("parseCommand — Combat verbs", () => {
  it("R6.1 — parses battlefield engagement declaration", () => {
    expect(parseCommand("decl 1,2 p3")).toEqual({
      kind: "declareEngagement",
      attackerBattlefieldIndices: [1, 2],
      defenderPlayerIndex: 3,
    });
  });

  it("R6.8 — parses fortress assault declaration", () => {
    expect(parseCommand("assault 1,2 p3 f1,f2")).toEqual({
      kind: "declareFortressAssault",
      attackerBattlefieldIndices: [1, 2],
      defenderPlayerIndex: 3,
      defenderFortressIndices: [1, 2],
    });
  });

  it("R6.5 — parses attacks from either engagement side", () => {
    expect(parseCommand("att a1 d2")).toEqual({
      kind: "attack",
      source: { side: "attacker", index: 1 },
      target: { side: "defender", index: 2 },
    });
    expect(parseCommand("att d1 a1")).toEqual({
      kind: "attack",
      source: { side: "defender", index: 1 },
      target: { side: "attacker", index: 1 },
    });
    expect(parseCommand("att a1 f1")).toEqual({
      kind: "attack",
      source: { side: "attacker", index: 1 },
      target: { side: "fortress", index: 1 },
    });
  });

  it("R6.4 — parses pass for either engagement side", () => {
    expect(parseCommand("pass a2")).toEqual({
      kind: "pass",
      entity: { side: "attacker", index: 2 },
    });
    expect(parseCommand("pass d1")).toEqual({
      kind: "pass",
      entity: { side: "defender", index: 1 },
    });
  });

  it("R6.10 / R6.11 — parses fortress assault resolution choices", () => {
    expect(parseCommand("cap f1 a1,a2")).toEqual({
      kind: "resolveAssault",
      choice: "capture",
      fortressIndex: 1,
      garrisonAttackerIndices: [1, 2],
    });
    expect(parseCommand("burn f2")).toEqual({
      kind: "resolveAssault",
      choice: "destroy",
      fortressIndex: 2,
      garrisonAttackerIndices: [],
    });
    expect(parseCommand("leave f1")).toEqual({
      kind: "resolveAssault",
      choice: "leave",
      fortressIndex: 1,
      garrisonAttackerIndices: [],
    });
  });

  it("rejects malformed Combat commands", () => {
    expect(parseCommand("att 1 1").kind).toBe("unknown");
    expect(parseCommand("pass 1").kind).toBe("unknown");
    expect(parseCommand("decl one p2").kind).toBe("unknown");
    expect(parseCommand("assault 1 p2").kind).toBe("unknown");
    expect(parseCommand("cap f1").kind).toBe("unknown");
  });
});

describe("parseCommand — Movement verbs", () => {
  it("R8.1 — parses movement into and out of fortresses", () => {
    expect(parseCommand("mv b1 f2")).toEqual({
      kind: "move",
      source: { kind: "battlefield", index: 1 },
      destination: { kind: "fortress", fortressIndex: 2 },
    });
    expect(parseCommand("move f2.3 bf")).toEqual({
      kind: "move",
      source: { kind: "fortress", fortressIndex: 2, occupantIndex: 3 },
      destination: { kind: "battlefield" },
    });
    expect(parseCommand("mv f1:1 f2")).toEqual({
      kind: "move",
      source: { kind: "fortress", fortressIndex: 1, occupantIndex: 1 },
      destination: { kind: "fortress", fortressIndex: 2 },
    });
  });

  it("rejects malformed Movement commands", () => {
    expect(parseCommand("mv").kind).toBe("unknown");
    expect(parseCommand("mv 1 f1").kind).toBe("unknown");
    expect(parseCommand("mv b1 1").kind).toBe("unknown");
  });
});

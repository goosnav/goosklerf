/**
 * SeededRng tests.
 *
 * Determinism is the load-bearing property here. If any of these tests fail,
 * the simulator and save/load both break — fix immediately, don't paper over.
 */

import { describe, expect, it } from "vitest";
import { SeededRng, rngFromState } from "@gk/engine";

describe("SeededRng — determinism", () => {
  it("same seed produces same sequence", () => {
    const a = new SeededRng("alpha");
    const b = new SeededRng("alpha");
    const seqA = Array.from({ length: 50 }, () => a.nextFloat());
    const seqB = Array.from({ length: 50 }, () => b.nextFloat());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = new SeededRng("alpha");
    const b = new SeededRng("beta");
    const seqA = Array.from({ length: 50 }, () => a.nextFloat());
    const seqB = Array.from({ length: 50 }, () => b.nextFloat());
    expect(seqA).not.toEqual(seqB);
  });
});

describe("SeededRng — nextInt", () => {
  it("returns integer in [min, max) — exclusive on max", () => {
    const rng = new SeededRng("range");
    for (let i = 0; i < 1000; i++) {
      const n = rng.nextInt(1, 7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThan(7);
    }
  });

  it("rollD6 returns 1..6 inclusive", () => {
    const rng = new SeededRng("d6");
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.rollD6());
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("throws on non-integer bounds", () => {
    const rng = new SeededRng("err");
    expect(() => rng.nextInt(0.5, 5)).toThrow();
    expect(() => rng.nextInt(0, 5.5)).toThrow();
  });

  it("throws on max <= min", () => {
    const rng = new SeededRng("err");
    expect(() => rng.nextInt(5, 5)).toThrow();
    expect(() => rng.nextInt(5, 4)).toThrow();
  });
});

describe("SeededRng — rollNd6", () => {
  it("rolls N dice in order", () => {
    const a = new SeededRng("nd6");
    const b = new SeededRng("nd6");
    expect(a.rollNd6(3)).toEqual([b.rollD6(), b.rollD6(), b.rollD6()]);
  });

  it("returns empty array for n=0", () => {
    expect(new SeededRng("z").rollNd6(0)).toEqual([]);
  });

  it("throws on negative n", () => {
    expect(() => new SeededRng("z").rollNd6(-1)).toThrow();
  });
});

describe("SeededRng — shuffle", () => {
  it("produces same permutation for same seed", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = new SeededRng("shuf").shuffle(arr);
    const b = new SeededRng("shuf").shuffle(arr);
    expect(a).toEqual(b);
  });

  it("does not mutate the input", () => {
    const arr = [1, 2, 3, 4, 5];
    const before = [...arr];
    new SeededRng("nm").shuffle(arr);
    expect(arr).toEqual(before);
  });

  it("preserves elements (permutation, not random subset)", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = new SeededRng("perm").shuffle(arr);
    expect([...out].sort((a, b) => a - b)).toEqual(arr);
  });
});

describe("SeededRng — pick / pickWeighted", () => {
  it("pick returns undefined for empty array", () => {
    expect(new SeededRng("e").pick([])).toBeUndefined();
  });

  it("pick returns the only element for a singleton", () => {
    expect(new SeededRng("s").pick(["only"])).toBe("only");
  });

  it("pickWeighted returns undefined for empty input", () => {
    expect(new SeededRng("e").pickWeighted([], [])).toBeUndefined();
  });

  it("pickWeighted returns undefined when all weights are 0", () => {
    expect(new SeededRng("z").pickWeighted(["a", "b"], [0, 0])).toBeUndefined();
  });

  it("pickWeighted always returns the only nonzero option", () => {
    const rng = new SeededRng("only");
    for (let i = 0; i < 50; i++) {
      expect(rng.pickWeighted(["a", "b", "c"], [0, 1, 0])).toBe("b");
    }
  });

  it("pickWeighted distribution roughly tracks weights", () => {
    const rng = new SeededRng("dist");
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10000; i++) {
      const pick = rng.pickWeighted(["a", "b"], [3, 1]);
      if (pick === "a") counts.a++;
      else if (pick === "b") counts.b++;
    }
    // 75 / 25 split, allow 5pp slack.
    expect(counts.a / 10000).toBeGreaterThan(0.7);
    expect(counts.a / 10000).toBeLessThan(0.8);
  });

  it("pickWeighted throws on length mismatch or bad weights", () => {
    const rng = new SeededRng("er");
    expect(() => rng.pickWeighted(["a"], [1, 2])).toThrow();
    expect(() => rng.pickWeighted(["a", "b"], [1, -1])).toThrow();
    expect(() => rng.pickWeighted(["a", "b"], [1, NaN])).toThrow();
  });
});

describe("SeededRng — getState / restoreState", () => {
  it("snapshot/restore reproduces the subsequent sequence", () => {
    const rng = new SeededRng("state");
    rng.nextFloat();
    rng.nextFloat();
    rng.rollD6();
    const snap = rng.getState();
    const future = Array.from({ length: 10 }, () => rng.nextFloat());

    const fresh = new SeededRng("state");
    fresh.restoreState(snap);
    const reproduced = Array.from({ length: 10 }, () => fresh.nextFloat());

    expect(reproduced).toEqual(future);
  });

  it("rngFromState constructs a ready-to-use generator", () => {
    const rng = new SeededRng("from-state");
    rng.nextFloat();
    rng.nextFloat();
    const snap = rng.getState();
    const future = [rng.nextFloat(), rng.nextFloat()];

    const rebuilt = rngFromState(snap);
    const reproduced = [rebuilt.nextFloat(), rebuilt.nextFloat()];
    expect(reproduced).toEqual(future);
  });

  it("restoreState rejects a state from a different seed", () => {
    const a = new SeededRng("seed-a");
    const snap = a.getState();
    const b = new SeededRng("seed-b");
    expect(() => b.restoreState(snap)).toThrow();
  });
});

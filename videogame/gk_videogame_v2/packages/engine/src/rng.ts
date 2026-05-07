/**
 * Deterministic seeded RNG.
 *
 * Every random decision in the engine — dice rolls, deck shuffles, AI choices
 * over equally-weighted options — flows through this class. There must be NO
 * `Math.random()` calls anywhere in @gk/engine or @gk/ai. See AGENTS.md
 * "Determinism" section.
 *
 * Why this matters:
 *   - Reproducibility: a (seed, action sequence) pair fully determines outcome.
 *     Bug reports become "seed X, replay these actions" rather than "I think
 *     it happened around turn 15."
 *   - Simulation: the sim-cli (M4) replays games by re-deriving the RNG state
 *     from a seed and the action stream — no live randomness.
 *   - Save/load: `getState()` snapshots the current RNG position; `restoreState()`
 *     fast-forwards a fresh generator to that position. Together with the rest
 *     of the engine state, this gives byte-exact resume.
 *
 * Implementation notes:
 *   - We use `seedrandom` (the npm package) for the PRNG itself.
 *   - We do NOT use seedrandom's own state-export feature, because it produces
 *     opaque blobs and we want our save format to be inspectable JSON.
 *   - Instead, RngState = { seed, callCount }. Restoring re-creates a fresh
 *     generator from the seed and discards the first `callCount` outputs.
 *     This is O(callCount) on restore, but in practice game RNG call counts
 *     are in the thousands at most, so it's negligible.
 */

import seedrandom from "seedrandom";

/** Minimal serializable RNG state. JSON-friendly. */
export interface RngState {
  seed: string;
  callCount: number;
}

export class SeededRng {
  private readonly seed: string;
  private callCount: number;
  private rng: seedrandom.PRNG;

  constructor(seed: string) {
    this.seed = seed;
    this.callCount = 0;
    this.rng = seedrandom(seed);
  }

  /** [0, 1) uniform; advances state by one call. */
  nextFloat(): number {
    this.callCount++;
    return this.rng();
  }

  /**
   * Integer in [min, max) — i.e. min inclusive, max EXCLUSIVE. Matches the
   * convention of `Array.prototype.slice` and most JS RNG helpers.
   *
   *   nextInt(0, 6) → one of {0,1,2,3,4,5}
   *   nextInt(1, 7) → one of {1,2,3,4,5,6}  ← this is rollD6
   */
  nextInt(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error(`SeededRng.nextInt requires integer bounds; got [${min}, ${max})`);
    }
    if (max <= min) {
      throw new Error(`SeededRng.nextInt requires max > min; got [${min}, ${max})`);
    }
    return Math.floor(this.nextFloat() * (max - min)) + min;
  }

  /** R6.5 normal-attack die. Returns one of {1,2,3,4,5,6}. */
  rollD6(): number {
    return this.nextInt(1, 7);
  }

  /**
   * Roll N six-sided dice. Used directly by R6.16 Supercharged Attack (3d6).
   * Returns an array of length n; do NOT pre-sort — order matters for some
   * card abilities (M2).
   */
  rollNd6(n: number): number[] {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`rollNd6 requires non-negative integer count; got ${n}`);
    }
    const rolls: number[] = [];
    for (let i = 0; i < n; i++) rolls.push(this.rollD6());
    return rolls;
  }

  /**
   * Fisher-Yates shuffle. Returns a NEW array; the input is not mutated.
   * Used by deck shuffling at setup and any time we need a uniform random
   * permutation.
   */
  shuffle<T>(array: readonly T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      // The non-null assertions are safe — i and j are valid indices we just bounded above.
      const tmp = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Pick one item uniformly. Returns undefined if the array is empty (caller
   * must handle, since with `noUncheckedIndexedAccess` we can't pretend
   * non-empty arrays exist).
   */
  pick<T>(array: readonly T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.nextInt(0, array.length)];
  }

  /**
   * Pick one item by weighted probability. Each weight must be ≥ 0; the
   * weights need NOT sum to 1 — they are normalized internally.
   * Returns undefined if the array is empty or all weights are 0.
   *
   * Used by the personality-weighted AI controller in Sprint 12.
   */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T | undefined {
    if (items.length !== weights.length) {
      throw new Error(`pickWeighted: items.length=${items.length} != weights.length=${weights.length}`);
    }
    if (items.length === 0) return undefined;
    let total = 0;
    for (const w of weights) {
      if (w < 0 || !Number.isFinite(w)) throw new Error(`pickWeighted: bad weight ${w}`);
      total += w;
    }
    if (total === 0) return undefined;
    let target = this.nextFloat() * total;
    for (let i = 0; i < items.length; i++) {
      target -= weights[i] as number;
      if (target < 0) return items[i];
    }
    // Fallback for floating-point edge cases — return last item with non-zero weight.
    for (let i = items.length - 1; i >= 0; i--) {
      if ((weights[i] as number) > 0) return items[i];
    }
    return undefined;
  }

  /** Snapshot the RNG position. Pair this with any other state save. */
  getState(): RngState {
    return { seed: this.seed, callCount: this.callCount };
  }

  /**
   * Re-create an RNG sitting at a previously snapshotted position. This
   * replaces the generator and the call counter; subsequent calls continue
   * from where the snapshot left off.
   */
  restoreState(state: RngState): void {
    if (state.seed !== this.seed) {
      throw new Error(
        `SeededRng.restoreState: seed mismatch (instance="${this.seed}", state="${state.seed}")`,
      );
    }
    this.rng = seedrandom(state.seed);
    for (let i = 0; i < state.callCount; i++) this.rng();
    this.callCount = state.callCount;
  }
}

/**
 * Convenience factory: rebuild a SeededRng directly from a serialized state.
 * Equivalent to `new SeededRng(state.seed)` followed by `restoreState(state)`,
 * but does it in one call.
 */
export function rngFromState(state: RngState): SeededRng {
  const rng = new SeededRng(state.seed);
  rng.restoreState(state);
  return rng;
}

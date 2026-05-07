/**
 * Result<T, E> — explicit success/failure return type for the reducer.
 *
 * Why a Result type rather than throwing?
 *   - "Illegal action" is a normal, expected outcome (the user clicked the
 *     wrong card). It's not a programming error and it shouldn't unwind the
 *     stack. The CLI shows the error message; the AI tries another action;
 *     the engine's state is unchanged.
 *   - Throwing is reserved for *programming errors* (invariant violations,
 *     missing card definitions). Those are bugs; they should crash loudly.
 *
 * Convention: when an action is illegal, the error string starts with the
 * R-ID that was violated, e.g. "R5.3: cannot place entity in full battlefield".
 * The CLI surfaces this verbatim so the player knows which rule blocked them.
 */

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Convenience: map over the success branch of a Result. */
export function mapResult<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

/**
 * Convenience: chain a Result-returning function. If `r` is an error, returns
 * the error directly; otherwise applies `f` to the value.
 */
export function flatMapResult<T, U, E>(
  r: Result<T, E>,
  f: (v: T) => Result<U, E>,
): Result<U, E> {
  return r.ok ? f(r.value) : r;
}

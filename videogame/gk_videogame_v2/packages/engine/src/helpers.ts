/**
 * Pure utility functions over GameState.
 *
 * No game logic lives here — these are read-only lookups and a structural
 * deep-clone. Reducer rules import from this module to read state; they
 * don't mutate. If you find yourself adding "and then update X" code here,
 * it belongs in a reducer rule file instead.
 */

import type {
  GameState,
  Player,
  PlayerId,
  CardInstance,
  InstanceId,
  Fortress,
  ZoneRef,
} from "./state.js";

/**
 * Find a player by id. Throws if missing — every PlayerId in a valid state
 * MUST resolve to a player (invariant I-2 sibling). Callers that aren't sure
 * should use `findPlayer` instead.
 */
export function playerById(state: GameState, id: PlayerId): Player {
  const p = state.players.find((p) => p.id === id);
  if (!p) throw new Error(`playerById: no player with id "${id}"`);
  return p;
}

/** Non-throwing variant; returns undefined if not found. */
export function findPlayer(state: GameState, id: PlayerId): Player | undefined {
  return state.players.find((p) => p.id === id);
}

/**
 * Look up a card instance by id. Throws if missing — same reasoning as
 * `playerById`. Use `findCard` for tentative lookups.
 */
export function cardById(state: GameState, id: InstanceId): CardInstance {
  const c = state.cardsByInstanceId[id];
  if (!c) throw new Error(`cardById: no card instance "${id}"`);
  return c;
}

export function findCard(state: GameState, id: InstanceId): CardInstance | undefined {
  return state.cardsByInstanceId[id];
}

/**
 * Resolve a ZoneRef to the list of instance IDs currently in that zone.
 * Returns a NEW array (never the live state array) so callers can't mutate
 * accidentally.
 *
 * Throws on inconsistent state (e.g. a fortress ZoneRef pointing at a
 * non-existent fortress). That's an invariant violation, not user error.
 */
export function getZoneContents(state: GameState, ref: ZoneRef): InstanceId[] {
  switch (ref.zone) {
    case "battlefield":
      // R3.1: battlefield is shared, but a battlefield ZoneRef is owned by a
      // specific player so callers can ask "show me P1's battlefield entities."
      return state.battlefield.filter((id) => {
        const c = cardById(state, id);
        return c.ownerId === ref.ownerId;
      });
    case "hand":
      return [...playerById(state, ref.ownerId).hand];
    case "deck":
      return [...playerById(state, ref.ownerId).deck];
    case "graveyard":
      return [...playerById(state, ref.ownerId).graveyard];
    case "shop":
      // R3.5 / R5.6: shop is per-player.
      return [...playerById(state, ref.ownerId).shop];
    case "fortress": {
      const fort = findFortress(state, ref.ownerId, ref.fortressInstanceId);
      if (!fort) {
        throw new Error(
          `getZoneContents: no fortress "${ref.fortressInstanceId}" owned by "${ref.ownerId}"`,
        );
      }
      return [...fort.occupantIds];
    }
  }
}

/** Find a fortress slot by owner + instance id. Undefined if not found. */
export function findFortress(
  state: GameState,
  ownerId: PlayerId,
  fortressInstanceId: InstanceId,
): Fortress | undefined {
  const player = findPlayer(state, ownerId);
  if (!player) return undefined;
  return player.suburbs.find((f) => f.fortressInstanceId === fortressInstanceId);
}

/**
 * Total fortress count across all players. Used by R10.3 Landlord — a player
 * is Landlord-eligible when their suburbs contain ALL fortresses on the board.
 */
export function totalFortressesOnBoard(state: GameState): number {
  let n = 0;
  for (const p of state.players) n += p.suburbs.length;
  return n;
}

/**
 * Structural deep clone of GameState. Used by the reducer to produce new
 * state without mutating the input.
 *
 * Implementation note: GameState is plain JSON-serializable data (strings,
 * numbers, booleans, arrays, plain objects). No class instances, no
 * functions, no Date objects, no Maps, no Sets. So `JSON.parse(JSON.stringify(...))`
 * is correct and fast enough for the sizes we operate on (a few KB per state).
 *
 * If we ever introduce non-JSON values into GameState, this function becomes
 * the single place to update — reducers don't reach into it.
 */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/**
 * Number of cards a player has in a given zone. Convenience for capacity
 * checks (R2.7) and end-of-game predicates (R10.4 Hamlet — "no entities
 * playable from any hand").
 */
export function zoneSize(state: GameState, ref: ZoneRef): number {
  return getZoneContents(state, ref).length;
}

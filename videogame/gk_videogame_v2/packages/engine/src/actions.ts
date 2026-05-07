/**
 * Reducer action surface.
 *
 * Sprint 5 implements only the Card Play subset. Later sprints extend this
 * union one phase at a time so callers cannot dispatch phantom behavior.
 */

import type { InstanceId } from "./state.js";

/** R5.2-R5.4: legal Card Play destinations are type-specific. */
export type PlacementRef =
  | { kind: "battlefield" }
  | { kind: "fortress"; fortressInstanceId: InstanceId }
  | { kind: "suburbs" }
  | { kind: "equip"; entityInstanceId: InstanceId };

export type Action =
  | { kind: "PLAY_CARD"; instanceId: InstanceId; placement: PlacementRef }
  | { kind: "DISCARD_CARD"; instanceId: InstanceId }
  | { kind: "END_PHASE" };

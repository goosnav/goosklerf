/**
 * Reducer action surface.
 *
 * Each sprint extends this union one phase at a time so callers cannot
 * dispatch phantom behavior. Current coverage:
 *   Sprint 5    Card Play (PLAY_CARD, DISCARD_CARD, END_PHASE)
 *   Sprint 6    Combat (DECLARE_ENGAGEMENT, NORMAL_ATTACK, PASS_ACTION)
 *   Sprint 7    Fortress assault resolution (RESOLVE_FORTRESS_ASSAULT)
 *   Sprint 8    Movement (MOVE_ENTITY)
 *   Sprint 9+   card draw, victory, advanced combat actions, etc.
 */

import type { InstanceId, PlayerId } from "./state.js";

/** R5.2-R5.4: legal Card Play destinations are type-specific. */
export type PlacementRef =
  | { kind: "battlefield" }
  | { kind: "fortress"; fortressInstanceId: InstanceId }
  | { kind: "suburbs" }
  | { kind: "equip"; entityInstanceId: InstanceId };

/** R6.1 / R6.8: Combat declaration. */
export type EngagementSpec =
  | {
      kind: "battlefield";
      /** Player whose battlefield is being attacked (R6.1). */
      defenderId: PlayerId;
      /** Active player's entities committing to the engagement. R6.2 — at least one. */
      attackerEntityIds: InstanceId[];
    }
  | {
      kind: "fortress_assault";
      /** Player whose controlled fortress(es) are being assaulted (R6.8). */
      defenderId: PlayerId;
      /** Active player's battlefield entities committing to the assault. */
      attackerEntityIds: InstanceId[];
      /** One or more defender-controlled fortresses being assaulted (R6.8). */
      targetFortressInstanceIds: InstanceId[];
    };
  // fortress_barrage lands in Sprint 16.

/** R6.10: attacker choice after a fortress's defenders are cleared. */
export type FortressAssaultChoice = "capture" | "destroy" | "leave";

/** R8.1: legal Movement destinations for an owned entity already in play. */
export type MovementDestinationRef =
  | { kind: "battlefield" }
  | { kind: "fortress"; fortressInstanceId: InstanceId };

export type Action =
  | { kind: "PLAY_CARD"; instanceId: InstanceId; placement: PlacementRef }
  | { kind: "DISCARD_CARD"; instanceId: InstanceId }
  | { kind: "END_PHASE" }
  // ---- Combat (R6.x) ----
  | { kind: "DECLARE_ENGAGEMENT"; spec: EngagementSpec }
  | { kind: "NORMAL_ATTACK"; attackerInstanceId: InstanceId; targetInstanceId: InstanceId }
  | { kind: "PASS_ACTION"; entityInstanceId: InstanceId }
  | {
      kind: "RESOLVE_FORTRESS_ASSAULT";
      fortressInstanceId: InstanceId;
      choice: FortressAssaultChoice;
      /** Required for capture; ignored for destroy/leave. */
      garrisonEntityIds?: InstanceId[];
    }
  // ---- Movement (R8.x) ----
  | { kind: "MOVE_ENTITY"; entityInstanceId: InstanceId; destination: MovementDestinationRef };

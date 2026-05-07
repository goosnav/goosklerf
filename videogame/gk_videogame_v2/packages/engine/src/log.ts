/**
 * Append-only reducer logging.
 *
 * Every state mutation cites the rule requirement that fired. The helper
 * mutates the reducer-owned cloned state only; it is not used on caller input.
 */

import type { GameState, LogEntry, PlayerId } from "./state.js";

export interface LogInput {
  rule: string;
  actor: PlayerId | "system";
  message: string;
  data?: Record<string, unknown>;
}

export function appendLog(state: GameState, input: LogInput): void {
  if (input.rule.trim() === "") {
    throw new Error("appendLog: rule citation is required");
  }

  const entry: LogEntry = {
    turn: state.turnNumber,
    phase: state.phase,
    rule: input.rule,
    actor: input.actor,
    message: input.message,
  };
  if (input.data !== undefined) entry.data = input.data;
  state.log.push(entry);
}

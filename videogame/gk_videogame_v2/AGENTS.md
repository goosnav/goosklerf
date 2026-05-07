# AGENTS.md — working conventions for Goosklerf

Read this before touching any code. It's short on purpose.

## North star

This is a high-fidelity rule-implementation project, not a feature project. The rulebook is the spec; the spec is the test. We are deliberately re-engineering the previous (sloppy) implementation. Treat any ambiguity as a bug.

## Required reading order

For every coding task:

1. `docs/SPEC-rules.md` — the rule(s) you're implementing. Find the `R*` IDs that apply.
2. `docs/SPEC-system.md` — the architecture you're working inside.
3. `/Users/jbs/.claude/plans/i-want-a-rebase-fuzzy-balloon.md` — current sprint plan.
4. The relevant code files (only after the above).

If the requirement is unclear, surface the question. **Do not guess in code.**

## Citation rule

Every non-trivial piece of code or test cites the requirement(s) it satisfies. Examples:

```ts
// covers R6.7: Initial Volley fires at most once per fortress per engagement
function resolveInitialVolley(...) { ... }
```

```ts
test("R10.3 — Landlord requires controlling all fortresses for one full round", () => { ... })
```

When you change rule behavior, update the citation. When you add a new requirement, add it to `SPEC-rules.md` first.

## Folder discipline

```
packages/cards/    no game logic, only data
packages/engine/   pure rules; no I/O, no Math.random, no Date.now
packages/ai/       reads engine, returns actions; never mutates
apps/play-cli/     I/O lives here only
tests/rules/       one file per rule section; tests cite R IDs
tests/transcripts/ scripted full-game golden tests
docs/              specs, tutorial, design notes
```

Dependency arrows point one way: cards ← engine ← ai ← apps. The engine MUST compile and pass tests with no AI or app code present.

## Determinism

- `Math.random()` is forbidden in `@gk/engine` and `@gk/ai`. Use `SeededRng` only.
- `Date.now()` and similar non-deterministic sources are forbidden in the engine.
- The reducer must be pure: `reduce(state, action)` returns a new state, never mutates.
- If you need ordering, sort explicitly. Never rely on `Object.keys` order.

## Sprint discipline

Sprints are defined in the plan file. Each sprint:
1. Starts by listing the `R*` requirements it satisfies.
2. Adds rule-fidelity tests **before** or alongside the implementation (never after).
3. Updates `SPEC-system.md` if it changes the type contract or action surface.
4. Ends with `pnpm test` green and a one-line addition to `docs/CHANGELOG.md`.
5. Has an explicit playtest the user can perform; tell them what to test in the closing message.

## Comment style

- Comments explain **why a piece of code exists in rule terms**, not what it does mechanically.
- Cite the `R*` ID. If the rule is non-obvious, paraphrase one sentence.
- Don't write comments that restate the code ("loop over players").
- Don't write comments tied to one task ("added in Sprint 6"). Citations are timeless; tasks are not.

Good:
```ts
// R6.3: combat is alternating-round; attacker side acts before defender each round.
if (engagement.sideToAct === "attacker") { ... }
```

Bad:
```ts
// switch sides
if (engagement.sideToAct === "attacker") { ... }
```

## Memory

The project memory at `/Users/jbs/.claude/projects/.../memory/` carries durable context across sessions. Read `MEMORY.md` first; update it when the user gives feedback or makes a non-obvious decision. See [`feedback_engineering_discipline.md`](../../memory/feedback_engineering_discipline.md) for the standing directive.

## What lives where

| Question | Answer |
|---|---|
| What does rule X say? | `docs/SPEC-rules.md` (R-ID search) |
| How is the engine architected? | `docs/SPEC-system.md` |
| How do I play? | `docs/TUTORIAL.md` |
| What's the current sprint? | `/Users/jbs/.claude/plans/i-want-a-rebase-fuzzy-balloon.md` |
| What changed recently? | `docs/CHANGELOG.md` |
| What conventions do I follow? | This file |

## Open-question protocol

When the rulebook is genuinely ambiguous:

1. Add an entry to the **Open questions** section of the relevant requirement in `SPEC-rules.md`.
2. Add a `TODO(spec): R<id> — <one-line question>` comment at the related code site.
3. Surface the question in the next message to the user.
4. Do not implement a guess.

## Anti-patterns to avoid

These are mistakes the previous codebase made. Do not repeat them.

- ❌ Defining an action type and never reducing it (`DECLARE_ENGAGEMENT` was a stub for months)
- ❌ Pattern-matching card text with regex
- ❌ Hardcoding dice rolls (the old code had `roll = 3` baked in)
- ❌ Letting one component own all UI state and dispatch (`TableScreen.tsx` was 719 LOC)
- ❌ Writing comments that explain the *change* instead of the *rule*
- ❌ Implementing rules from memory instead of opening the spec

## When in doubt

Re-read the requirement. Quote it in your commit message. The rulebook is more often right than your intuition about it.

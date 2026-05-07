# Goosklerf II — Documentation Index

This directory holds the project's specifications, tutorial, and design notes. The rulebook in `/Volumes/PRO-G40/.../rulebook/goosklerf_ii_rulebook_v6_final.txt` is the source of truth; the documents here are derivative but normative for the codebase.

## What's where

| Document | Audience | Purpose |
|---|---|---|
| [`SPEC-rules.md`](SPEC-rules.md) | engineers, AI agents | **Formal requirements.** 67 numbered, testable Classic-only rules extracted from the rulebook v6. Every R-ID is a contract the engine must satisfy. |
| [`SPEC-system.md`](SPEC-system.md) | engineers, AI agents | **System architecture.** Module map, type contracts, action surface, invariants, determinism contract, error model. |
| [`TUTORIAL.md`](TUTORIAL.md) | players, new contributors | How to play Classic Goosklerf — board layout, card types, turn structure, worked example. |
| [`CHANGELOG.md`](CHANGELOG.md) | everyone | One line per sprint completed; what changed and which rules it covers. |
| [`../AGENTS.md`](../AGENTS.md) | AI agents, contributors | Working conventions: citation rule, folder discipline, determinism, anti-patterns. |

## How the documents relate

```
                       rulebook v6 (canonical)
                              │
                  extract     ▼
                        SPEC-rules.md ────► tests/rules/*  (cite R-IDs)
                              │
                  shape       ▼
                        SPEC-system.md ────► packages/*    (cite R-IDs)
                              │
                  retell      ▼
                          TUTORIAL.md
```

`SPEC-rules.md` is the *what*. `SPEC-system.md` is the *how*. `TUTORIAL.md` is the *why and how-to-play*. Code cites `SPEC-rules.md` directly.

## Editing rules

- **Never** edit `SPEC-rules.md` to make code easier to write. The rulebook is the source. If the rulebook is wrong, that's a rulebook conversation with the user.
- **Always** edit `SPEC-system.md` *before* changing the type or action surface in code. The doc leads; the code follows.
- **Add** to `CHANGELOG.md` after each sprint completes — one line citing the R-IDs touched.

# DECISION-0001 — At M1, deck pool admits `not_implemented` cards (text ignored)

**Date:** 2026-05-06
**Status:** Accepted
**Sprint:** Sprint 3

## Context

The plan called for "vanilla-only" decks at M1 — i.e., only cards tagged `fully_implemented` would appear in legal decks; the `not_implemented` cards would return at M2 via an ability registry.

When implementing `setupGame()` we discovered that the canonical CSV (`card_data-003.csv`) has **zero fortresses tagged `fully_implemented`**. Every fortress card has `has_special: Y` in the source data, which the importer maps to `automationStatus: "not_implemented"`.

Every deck regime (R1.2) requires at least one fortress (Small ≥1, Medium ≥2, Large ≥3). Strict vanilla-only is therefore unbuildable.

## Options considered

1. **Edit the CSV** to flip a few fortresses to non-special. Out of scope for an engineering session — the user owns the CSV.
2. **Block M1 entirely** until the CSV is fixed. Unacceptable; we'd be stalled with no playable game.
3. **Broaden the M1 pool to admit `not_implemented` cards**, with their special text deliberately ignored. Their printed numeric stats (HP, attack, attackBuff, hpBuff) drive the engine; only the *text* effect is missing. ✅ Selected.

## Decision

`packages/engine/src/setup.ts:filterPool()` admits any card whose `automationStatus !== "data_error"`. This includes both `fully_implemented` (vanilla) and `not_implemented` (special text ignored at M1) cards.

`data_error` cards remain excluded — these are entities missing `baseAttack` etc., and putting them in decks would crash the engine at first use.

## Consequences

- **M1 decks contain cards whose printed text never fires.** A player reading the card's flavor text and expecting an effect will be disappointed. The CLI should display a marker (e.g., a 🌀 symbol or "[text inactive]" tag) on such cards so users know.
- **Sprint 19 (M2) ability registry must implement the deferred text** to fulfill the original spec. Until then, gameplay favors stat-based outcomes over special-effect surprises.
- **The current 96-test suite passes** with this filter. No spec requirement (R1.x — R10.x) is violated; we're just not yet implementing the "card text overrides rules" clause (R3.9) for these cards.

## Reversal trigger

If the user updates `card_data-003.csv` to mark enough fortresses as vanilla, we can re-tighten `filterPool` to `fully_implemented` only. The change is one line in `setup.ts`.

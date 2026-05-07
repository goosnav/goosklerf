# Goosklerf II — Tutorial

> Read this if you want to **play**. For the rules in formal-spec form, see `SPEC-rules.md`.
> This tutorial covers Classic Goosklerf — the full rule set the videogame implements.

## What is Goosklerf?

Goosklerf is a 2–4 player card game where you build entities, fortify suburbs, and outlast (or out-control) your opponents. You win by:

- **Last Man Standing** — every other player has zero entities (R10.2).
- **Landlord** — you control every fortress on the board, and you survive one full round of play with all of them still yours (R10.3).
- **Hamlet** — nobody has any entities and nobody can play any (R10.4). This is a loss for *everybody*.

A turn has five phases (R4.1):

1. **Card Play** — play 3 cards from your hand (or discard down to 3 if you can't).
2. **Combat** — declare engagements and fight, in alternating rounds.
3. **Movement** — move entities between battlefield and your fortresses.
4. **Card Draw** — draw 2 random cards plus 1 you choose.
5. **Victory Check** — the engine checks whether anyone won, advances Old Age counters, etc.

## What's on the table

```
                    BATTLEFIELD (shared)
       all entities not inside a fortress live here
       cap: 5 entities per player

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ P1 SUBURBS   │  │ P2 SUBURBS   │  │ P3 SUBURBS   │  │ P4 SUBURBS   │
  │  fortress    │  │  fortress    │  │  fortress    │  │  fortress    │
  │  fortress    │  │              │  │  fortress    │  │  fortress    │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

  HAND (private, per player)        DECK (private)        GRAVEYARD (private)
  SHOP (shared, optional)
```

- **Battlefield** — all your battlefield entities are exposed and can be attacked. (R3.1.)
- **Suburbs** — each player has fortresses here. A fortress can house up to 3 entities, who get the fortress's HP buff (R2.3, R2.7, R3.10).
- **Hand** — what you can play this turn (R3.4).
- **Deck** — face-down draw pile (R3.4).
- **Graveyard** — discards (R3.3).
- **Shop** — face-up cards you can buy in the Card Play phase (R3.5, R5.5–R5.7).

## Card types (R2.1)

| Type | What it does | Where it goes |
|---|---|---|
| **Entity** ⚔ | A creature with Attack and HP. Fights, occupies fortresses, equips items. (R2.2) | Battlefield or your fortress |
| **Fortress** 🛡 | A defensive structure. Houses up to 3 entities; gives them HP buffs. (R2.3) | Your suburb |
| **Item (regular)** 🎒 | Equipment. Buffs an entity's stats. (R2.4) | Equipped to one of your entities |
| **Item (consumable)** 🧪 | One-shot effect. (R2.4) | Equipped to an entity; used during Combat, then discarded |

Cards have an **Attack** value (printed range 1–5) which is the threshold to roll *under or equal to* on a 1d6 to hit, and an **HP** value (printed range 0–6) tracked with a die. (R2.5, R2.6.)

## Setup

You pick a deck size: **Small (24)**, **Medium (36, the standard)**, or **Large (54)**. Each regime has minimums for entity / fortress / item counts. No more than 3 copies of any single card. (R1.2.)

Each player draws 7 cards. If your starting hand has no entities AND no fortresses, you mulligan: shuffle back, redraw (R1.3). Turn order is determined randomly (R1.4).

The Shop (R1.5) is dealt 3/7/7 cards face-up at setup (Small / Medium / Large).

## A turn, in detail

### Phase 1 — Card Play (R5.x)

You must play exactly **3 cards** if that is legal. If you cannot legally play 3, play the maximum legal cards, then discard until `played + discarded = 3` (or fewer if you started the phase with fewer than 3 cards) (R5.1).

When you play a card (R5.2):

- **Entity** → choose a destination: battlefield (cap 5/player) or one of your fortresses (cap 3/fortress) (R5.3).
- **Fortress** → goes to your suburbs (R3.2). Empty until you put entities in it.
- **Item (regular)** → equipped to one of your entities. That entity must have room (≤ 3 items) (R2.7).
- **Consumable** → equipped to one of your entities like any other item. It may be used later during Combat, then goes to the graveyard (R5.4, R6.4).

You may also **buy** from the shop during this phase (R5.5–R5.7): pay 2 normal cards OR 1 rare card from your hand to take a face-up shop card. The bought card is played immediately and counts toward your 3-play limit.

If you can't legally play 3, you discard down to 3 instead (R5.1).

### Phase 2 — Combat (R6.x)

You may declare **zero or more engagements** this phase. Each engagement is a separate fight.

For each engagement:

1. **Declare an engagement** (R6.1). Pick one enemy player. Either pick their battlefield (a *battlefield engagement*) or one or more of their fortresses (a *fortress assault*, R6.8). Move your attacking entities into the engagement (this is **Combat Staging**, R6.2).
2. **Initial Volley** (R6.7): if this is a battlefield engagement, *each* of your enemy's eligible fortresses may fire one shot at one of your attackers — before round 1 starts. Eligibility: the fortress has at least one occupant, isn't itself under assault, isn't barraging.
3. **Round 1 begins** (R6.3). You (the attacker) act first: each of your participating entities takes one action. Then the defender's entities each take one action.
4. **End of round.** If one side is out of entities, the engagement ends (R6.6). Otherwise, round 2 starts. Repeat.

A **Normal Attack** (R6.5): pick a legal target, roll 1d6. If the result is ≤ your modified Attack value (base + items + fortress buffs), you hit and deal 1 HP. Otherwise you miss.

When an entity reaches 0 HP, it dies. Its items go to the graveyard with it (R7.3).

**Fortress assault** is special. You may attack the fortress directly (its HP comes down) OR pick off its defenders. If you reduce the fortress's HP to 0, it's destroyed along with its occupants (R6.11, R7.4). If you kill all its defenders while the fortress still has HP, you may **capture** it — it now belongs to you (R6.10).

### Phase 3 — Movement (R8.x)

Move your entities. Battlefield ↔ fortress, fortress ↔ fortress. Capacity rules apply (R2.7, R8.1). Items move with their entity (R3.8).

### Phase 4 — Card Draw (R9.x)

Draw 2 random cards from your deck, plus search your deck for any 1 card and add it to your hand (R9.1). If your deck is empty, this phase is a no-op (R9.2).

### Phase 5 — Victory Check (R10.x)

The engine ticks Old Age (R10.7) and checks for victory triggers:

- **Last Man Standing** (R10.2): are you the only one with entities? You win.
- **Landlord** (R10.3): if you own every fortress on the board, your `landlordPending` flag flips on. You must survive one full round of play (everyone else gets a turn) without losing any fortress. If you do, you win at the start of your next victory check.
- **Hamlet** (R10.4): are there zero entities anywhere AND zero entities playable from anyone's hand? Game ends with no winner.

## Combat actions in detail

The actions an entity can take during its turn in a combat round:

- **Normal Attack** (R6.5) — the default. Roll 1d6 against your modified Attack stat. Hit deals 1 HP.
- **Use Consumable** (R6.4) — spend a consumable item on the entity carrying it.
- **Use Special** (R6.4) — fires the entity's printed special ability (M2 milestone).
- **Parry** (R6.12) — forgo your action to roll Attack against one normal hit you took last round; on success, regain 1 HP from that hit.
- **Retreat** (R6.13) — declare retreat; you become targetable next round, then leave the engagement if you survive. Must have a legal destination.
- **Item Swap** (R6.14) — transfer up to 2 of your items to a friendly entity in the same engagement.
- **Heal** (R6.15) — roll Attack against a friendly entity in the engagement; on hit, discard 1 random card from your deck and heal them +1.
- **Supercharged Attack** (R6.16) — roll 3d6. All three ≤ Attack = 2 damage. Any miss = 1 self-damage.
- **Buy Extra Action** (R6.17) — discard 3 random cards from your deck to gain 1 additional action this round. Stacks until your deck is empty.
- **Last Stand** (R6.18) — when reduced to 0 HP, take one final action before being discarded. If that action raises HP to ≥1, you survive.

Two combat events that aren't actions per se:

- **Reinforcements** (R6.19) — at the end of your side's combat round, call up to 1 friendly entity from your suburbs into the engagement; the calling entity spends its next action.
- **Scavenger** (R6.20) — when a friendly entity dies in an engagement, allies in the same engagement may equip the dead ally's items (capacity permitting). Enemies' items never transfer.
- **Fortress Barrage** (R6.21) — a fortress with at least one occupant may engage an enemy fortress directly. No battlefield involvement, no capture (only destroy). If the target fortress is destroyed, all its occupants die with it.

## Some practical advice

- **Don't bunker.** The Old Age rule (R10.7) penalizes you for not declaring any engagement for 3 of your own turns — you lose a random entity. Initial Volley does NOT count as declaring an engagement.
- **Item placement matters.** Items move with the entity. If your Hammer-equipped Worm dies, the hammer goes to the graveyard with it (unless an ally Scavenges it, R6.20).
- **Fortress buffs are sticky** (R3.10). An entity inside a fortress gets the fortress's HP buff. Move it out and it loses the buff.
- **Capture vs destroy.** Capturing a fortress is much stronger (it's still standing and you control it), but you have to clear the defenders first without taking the fortress to 0 HP.

## A worked example

Let's run a tiny scenario.

> P1 has BUTCHER WORM (Attack 3, HP 3) on the battlefield. P2 has a FARMHOUSE FORTRESS (HP 4) holding HAPPY GUY (Attack 4, HP 2). It's P1's Combat phase.

P1 declares a fortress assault on P2's FARMHOUSE.

**Initial Volley** (R6.7). Is FARMHOUSE eligible? It has an occupant (HAPPY GUY) and it isn't barraging. But — wait — the fortress *is* the one being assaulted. Initial Volley is for fortresses that are NOT under assault, so FARMHOUSE doesn't get a volley. (HAPPY GUY will defend in round 1 instead.)

**Round 1, attacker** (R6.3, R6.5). BUTCHER WORM is the only attacker. P1 chooses to attack the fortress directly. Roll: 2. 2 ≤ 3, hit. FARMHOUSE drops from 4 → 3 HP.

**Round 1, defender** (R6.3, R6.5). HAPPY GUY's turn. Roll: 5. 5 > 4 (HAPPY GUY's Attack), miss.

**Round 2.** No side is empty. Repeat. P1 keeps drilling the fortress. Eventually: FARMHOUSE → 0 HP. It is destroyed (R6.11); HAPPY GUY (who was inside) is destroyed too (R7.4). P1 wins the engagement.

Alternatively, P1 could've targeted HAPPY GUY first, killed him, and then captured the empty FARMHOUSE (R6.10) — that's the difference between **destroy** and **capture**.

## Moving on

For details on every rule, see `SPEC-rules.md`. For how the engine implements all of this, see `SPEC-system.md`. For the day-to-day controls of the CLI client, run `pnpm play -- --help`.

# Goosklerf II — Classic Rules Specification

## Part 1: Setup & Components

### R1.1 — Required materials
**Source:** §1 "What You Need" (rulebook lines 233–253)
**Requirement:** Players MUST have a deck of Goosklerf cards, at least one six-sided die per player, and a flat playing surface large enough for the table layout.
**Detail:** Additional dice for tracking HP are recommended (1 per entity in play). A printed play mat is optional. All player decks must be of the same regime size (Small, Medium, or Large) as agreed before setup.
**State touched:** Game components, table state
**Edge cases:** none
**Open questions:** none

### R1.2 — Deck regimes and minimum composition
**Source:** §8 "Deck Regimes" (rulebook lines 557–594)
**Requirement:** All players MUST use the same deck regime size. Small decks (24 cards) require minimum 5 entities, 1 fortress, 10 items. Medium decks (36 cards) require minimum 10 entities, 2 fortresses, 15 items. Large decks (54 cards) require minimum 15 entities, 3 fortresses, 25 items.
**Detail:** Decks may contain more entities and fortresses than minimums at the cost of fewer items, provided all minimums are met and final deck size exactly matches the selected regime. A deck MAY include at most 3 copies of any card with the same name. Shop size is 3 cards for Small, 7 cards for Medium, 7 cards for Large (used if Shop rule is active).
**State touched:** Deck composition, shop setup
**Edge cases:** Remaining deck slots beyond minimums may be filled with any card type (entity, fortress, or item) respecting the constraints above
**Open questions:** none

### R1.3 — Starting hand and mulligan
**Source:** §8 "Starting Hand" and "Mulligan Rule" (rulebook lines 597–606)
**Requirement:** Each player draws 7 cards at random from their own deck at the start of the game. If a player's opening hand contains no entities or fortresses (no legal opening placement), that player may reshuffle their deck and draw a new random hand; other players keep their hands unchanged.
**Detail:** This is the only fully random draw in the game. All subsequent draws involve player choice via Card Draw phase. The mulligan provides a safety net to prevent unplayable opening hands.
**State touched:** Starting hand, deck
**Edge cases:** Only the player with an illegal hand (no entities or fortresses) may mulligan; this does not affect other players' hands
**Open questions:** none

### R1.4 — First player determination
**Source:** §8 "First Player" (rulebook lines 607–610)
**Requirement:** First player MUST be determined by die roll, thumb war, arm wrestling, a game of speed chess, a round of non-lethal combat sport, or agreement. Play proceeds clockwise.
**Detail:** A round ends when every surviving player has taken one turn. Method is entirely flexible for casual play.
**State touched:** Turn order
**Edge cases:** none
**Open questions:** none

### R1.5 — Shop setup at game start
**Source:** §13 "Shop" (rulebook lines 1000–1006); Classic Mode setup (rulebook lines 1377–1378)
**Requirement:** If the Shop rule is active, each player draws cards at random from their own deck and places them face-up in their own shop area. Number of shop cards drawn = 3 for Small deck, 7 for Medium, 7 for Large.
**Detail:** Shop cards are drawn during setup before the 7-card starting hand. Shop cards belong to the player who placed them; only that player may buy from their own shop. All shop cards are always visible to all players throughout the game.
**State touched:** Shop zone, deck
**Edge cases:** Shop cards are separate from the starting 7-card hand and are drawn before it
**Open questions:** none

---

## Part 2: Cards (Types, Anatomy, Rarity, Stat Limits)

### R2.1 — Card types overview
**Source:** §2 "Card Types" (rulebook lines 255–305)
**Requirement:** Goosklerf II has three card types: entities, fortresses, and items. Each type has a normal and rare variant, identified by border color.
**Detail:** Entities have red (normal) or purple (rare) borders. Fortresses have blue (normal) or orange (rare) borders. Items have green (normal) or yellow/gold (rare) borders. Each type is further specified in R2.2–R2.4.
**State touched:** Card definitions, card anatomy
**Edge cases:** none
**Open questions:** none

### R2.2 — Entity cards
**Source:** §2 "Entities" (rulebook lines 262–274)
**Requirement:** Entities are fighters that attack, equip items, occupy fortresses, and use special abilities. Only entities can equip and use items. Entities may attack enemy entities and enemy fortresses. An entity is defeated when its HP reaches 0. Card-special text always overrides standard rules.
**Detail:** A normal entity has one HP die. A Super Entity is a rare entity with two HP dice, marked clearly on the card. Some entities have special text on the card that always overrides general rules.
**State touched:** Entity definition, defeat condition
**Edge cases:** none
**Open questions:** none

### R2.3 — Fortress cards
**Source:** §2 "Fortresses" (rulebook lines 276–290)
**Requirement:** Fortresses are structures placed in the suburbs. They house entities, grant buffs or debuffs to entities inside, and sometimes have special effects. Fortresses can house up to 3 entities. Fortresses cannot hold or use items directly. A fortress is destroyed when its HP reaches 0. When a fortress is destroyed, all entities inside and their equipped items are destroyed.
**Detail:** A normal fortress has two HP dice. A Super Fortress is a rare fortress with three HP dice, marked clearly on the card.
**State touched:** Fortress definition, entity capacity, destroy condition
**Edge cases:** none
**Open questions:** none

### R2.4 — Item cards
**Source:** §2 "Items" (rulebook lines 292–304)
**Requirement:** Items are equipment carried by entities. There are two subtypes: equipped items (stay attached and provide continuous effect) and consumables (used for one-time effect, then discarded). An entity can carry up to 3 items at a time (equipped items and consumables combined).
**Detail:** Consumables must be equipped by an entity before they can be used. Items grant buffs, debuffs, or special abilities to the carrying entity.
**State touched:** Item definition, item capacity, consumable mechanics
**Edge cases:** Consumables that have already been activated cannot be transferred via Item Swap (R6.7)
**Open questions:** none

### R2.5 — Card anatomy and stat values
**Source:** §3 "Card Anatomy" and "How Stats Work" (rulebook lines 315–350)
**Requirement:** Every card has a name, a card-type icon, a border color, stat values, and a text box. Entities and fortresses have Attack and HP values. Items may have buffs or debuffs to those values. Card-special text overrides general rules if there is a conflict.
**Detail:** Attack is the target number a player must roll at or below to land a normal hit (on 1d6). HP is tracked physically with a die placed on the card showing current HP via rotation. Normal entities use 1 HP die; super entities use 2. Normal fortresses use 2 HP dice; super fortresses use 3. Damage is applied one HP at a time across the dice in any order the controlling player chooses.
**State touched:** Card stat representation, HP tracking
**Edge cases:** Special text overrides both card anatomy and general rules
**Open questions:** none

### R2.6 — Stat limits (Attack and HP per die)
**Source:** §12 "Stat Limits" (rulebook lines 953–973)
**Requirement:** Unless a card explicitly overrides them, Attack MUST be limited to the range 1–5, and HP per die MUST be limited to the range 0–6.
**Detail:** If a buff would push a stat above its maximum, it stops at the cap. If a debuff would push a stat below its minimum, it stops at the minimum (except HP, which can reach 0 and defeat the card).
**State touched:** Stat modification limits
**Edge cases:** none
**Open questions:** none

### R2.7 — Capacity limits (items, entities per fortress, battlefield entities)
**Source:** §12 "Stat Limits" (rulebook lines 953–973); §9 Phase 1 "Card Play" (rulebook lines 658–659)
**Requirement:** Unless a card explicitly overrides them, the following limits MUST apply: items per entity max 3, entities per fortress max 3, battlefield entities per player max 5.
**Detail:** If a change in capacity would leave an entity or fortress holding more than the new maximum, the controlling player immediately chooses which cards remain and discards the excess to their graveyard.
**State touched:** Capacity enforcement
**Edge cases:** none
**Open questions:** none

---

## Part 3: Zones & Core Concepts

### R3.1 — Battlefield zone
**Source:** §4 "The Table: Zones and Layout" (rulebook lines 353–390); Quickstart (rulebook lines 132–135)
**Requirement:** The battlefield is the shared center zone of the table where entities fight. All players use one battlefield. Players can hold up to 5 of their own entities on the battlefield at any time (per R2.7).
**Detail:** Entities on the battlefield can fight enemy battlefield entities and assault enemy fortresses. The battlefield is shared; all players place their entities in the same space.
**State touched:** Battlefield zone definition, capacity
**Edge cases:** none
**Open questions:** none

### R3.2 — Suburbs zone and fortress placement
**Source:** §4 "The Table: Zones and Layout" (rulebook lines 353–390); Quickstart (rulebook lines 132–141)
**Requirement:** The suburbs are each player's fortress zone along the edges of the table. Fortresses are placed only in the suburbs, not on the battlefield. Each player has their own suburbs.
**Detail:** Fortresses in the suburbs can house up to 3 entities (per R2.7). Entities inside fortresses can defend, fire Initial Volleys when legal, and use Fortress Barrage if active. They cannot capture enemy fortresses while inside a fortress.
**State touched:** Suburbs zone definition, fortress placement rules
**Edge cases:** none
**Open questions:** none

### R3.3 — Graveyard zone
**Source:** §4 "The Table: Zones and Layout" (rulebook lines 368–371)
**Requirement:** Each player has their own graveyard (discard pile). Destroyed, defeated, spent, and discarded cards go here unless a rule says otherwise.
**Detail:** Graveyards are owned by their players and are separate from other players' graveyards (per R3.8 Item Ownership).
**State touched:** Graveyard zone definition
**Edge cases:** none
**Open questions:** none

### R3.4 — Deck and Hand zones
**Source:** §4 "The Table: Zones and Layout" (rulebook lines 372–378)
**Requirement:** Each player has their own deck (face-down) and their own hand (private queue of cards). Cards in the deck must be transferred to the hand before they may be placed.
**Detail:** The deck is kept face-down nearby. The hand is a private collection of cards the player holds.
**State touched:** Deck and hand zone definitions
**Edge cases:** none
**Open questions:** none

### R3.5 — Shop zone (optional)
**Source:** §4 "The Table: Zones and Layout" (rulebook lines 379–381)
**Requirement:** If the Shop rule is active, a face-up row of cards from each player's deck is placed in the shop for potential purchase during Card Play. If Shop is not active, this zone does not exist.
**Detail:** Shop is detailed in R5.5–R5.7 below.
**State touched:** Shop zone definition
**Edge cases:** Shop is optional and depends on game mode
**Open questions:** none

### R3.6 — Control and occupation
**Source:** §5 "Core Concepts" (rulebook lines 404–409)
**Requirement:** A card is controlled by the player who owns it, unless a rule or special effect changes control (e.g., capturing a fortress). A player occupies a fortress if they have at least one surviving entity inside it. A player can control an empty fortress.
**Detail:** Control is distinct from occupation. A player may control a fortress but not occupy it (no entities inside). Conversely, once a player occupies a fortress, they may lose occupation if all entities inside die or leave, but they retain control unless an opponent captures the fortress.
**State touched:** Control state, occupation state
**Edge cases:** A player can control multiple fortresses simultaneously
**Open questions:** none

### R3.7 — Engagement definition and scope
**Source:** §5 "Core Concepts" (rulebook lines 411–413); §10.1 "Combat Staging/Movement" (rulebook lines 823–854)
**Requirement:** An engagement is a single declared combat, from the moment combat is declared until one side is destroyed, retreats, or the engagement ends by rule. Engagements are resolved one at a time.
**Detail:** Multiple engagements may be declared in a single Combat phase, but each is resolved completely before the next begins. Each of a player's entities may participate in only one engagement per turn unless a card says otherwise (per R4.2).
**State touched:** Engagement state, combat sequence
**Edge cases:** Special abilities may allow an entity to participate in more than one engagement per turn
**Open questions:** none

### R3.8 — Item ownership and control
**Source:** §11.4 "Item Ownership" (rulebook lines 944–949)
**Requirement:** Each player has exclusive control of their own cards. There is no transfer of cards between players. When a card is discarded, it returns to the graveyard of its original owner.
**Detail:** This prevents item-theft ambiguity. Even if an enemy takes control of a fortress with items inside, those items belong to the original owner's graveyard if the fortress is destroyed.
**State touched:** Item ownership state
**Edge cases:** Scavenger (R6.10) allows a player's own entities to pick up dead allies' items within the same engagement, not enemies' items
**Open questions:** none

### R3.9 — Card text overrides rules
**Source:** §5 "Core Concepts" (rulebook lines 415–417)
**Requirement:** If a card's special text contradicts a general rule, the card text wins. If two cards contradict each other, the card belonging to the acting player wins.
**Detail:** Card text is the final arbiter of any rule conflict.
**State touched:** Rule precedence
**Edge cases:** none
**Open questions:** none

### R3.10 — Fortress buffs and debuffs
**Source:** §5 "Core Concepts" (rulebook lines 419–428)
**Requirement:** Fortresses modify the stats of entities inside them the same way items modify entity stats. A fortress's buff or debuff (printed in its text box) applies to every entity occupying that fortress for as long as the entity remains inside. Buffs are lost immediately when the entity leaves the fortress during Combat Staging, Movement, Retreat, or any other movement. Fortress buffs apply during Initial Volley, Fortress Barrage, fortress assault defense, and all other combat actions taken while the entity is inside the fortress. Fortress buffs stack with item buffs, subject to stat limits (R2.6–R2.7).
**Detail:** Fortress buffs are applied as long as the entity is physically inside the fortress. Leaving the fortress removes all fortress buffs immediately. Buffs stack with items but are subject to Attack (1–5) and HP (0–6 per die) limits.
**State touched:** Stat modification, entity buff state
**Edge cases:** Buffs stack; stat limits are enforced after all buffs and debuffs are applied
**Open questions:** none

---

## Part 4: Turn Structure Overview

### R4.1 — Five-phase turn structure
**Source:** §9 "Turn Structure" (rulebook lines 621–632)
**Requirement:** A turn consists of exactly five phases taken in order: (1) Card Play, (2) Combat, (3) Movement, (4) Card Draw, (5) Victory Check. Each phase must be completed before moving to the next.
**Detail:** All active player actions within a phase must be resolved before proceeding. Phases are mandatory (though some may have no legal actions).
**State touched:** Turn state, phase sequence
**Edge cases:** If a player's hand is empty at the start of Card Play, that phase is skipped entirely (per R5.1)
**Open questions:** none

### R4.2 — Entity participation limit per engagement per turn
**Source:** §9 Phase 2 "Combat" (rulebook lines 662–666)
**Requirement:** Each of the active player's entities may participate in only one engagement per turn, unless a special ability says otherwise.
**Detail:** An entity committed to one engagement cannot switch to another during the same turn's combat phase.
**State touched:** Engagement participation state
**Edge cases:** Special card abilities may grant multiple engagements; card text overrides this limit
**Open questions:** none

---

## Part 5: Card Play Phase (Phase 1)

### R5.1 — Three-card rule and forced play/discard
**Source:** §9 Phase 1 "Card Play" (rulebook lines 634–655)
**Requirement:** The active player must play exactly 3 cards from their hand if possible. If it is impossible to play 3 cards, the maximum number of playable cards must be played. If the active player cannot play 3 legal cards, they must discard cards from their hand until played + discarded = 3.
**Detail:** If the player has fewer than 3 cards at the start of Card Play, they play as many as they legally can and discard the rest (totaling fewer than 3). If the hand is empty, skip Card Play entirely and proceed to Combat. Example: if only 2 cards can be played, 1 must be discarded (total 3).
**State touched:** Card Play phase, hand state, discard pile
**Edge cases:** Empty hand at start of Card Play = skip the phase; fewer than 3 playable cards = discard to total 3
**Open questions:** none

### R5.2 — Legal card plays
**Source:** §9 Phase 1 "Card Play" (rulebook lines 640–645)
**Requirement:** A card is played when it is (1) a fortress placed into the player's own suburbs, (2) an entity placed onto the battlefield, (3) an entity placed into one of the player's own fortresses, (4) an item equipped onto one of the player's entities, or (5) a shop purchase (if Shop rule is active).
**Detail:** These are the only five legal forms of play. A card not in one of these categories is not "played" for the three-card rule; it must be discarded.
**State touched:** Card Play definitions
**Edge cases:** none
**Open questions:** none

### R5.3 — Placement capacity during Card Play
**Source:** §9 Phase 1 "Card Play" (rulebook lines 658–659)
**Requirement:** Capacity limits still apply during Card Play: 3 items per entity, 3 entities per fortress, 5 entities on the battlefield per player (per R2.7).
**Detail:** A card may only be played if its placement does not violate these limits. If a player cannot legally place a card due to capacity, it must be discarded.
**State touched:** Capacity enforcement during play
**Edge cases:** none
**Open questions:** none

### R5.4 — Consumables play and use
**Source:** §6 "Entity Actions" (rulebook lines 447–449)
**Requirement:** Consumables are equipped to entities during Card Play like other items. They may be used as an action during Combat (Use a Consumable action). Once used, they are discarded unless the card says otherwise.
**Detail:** A consumable must be equipped to an entity before it can be used in combat. Playing a consumable (equipping it) counts as one of the 3 cards played.
**State touched:** Consumable equip and use
**Edge cases:** Already-activated consumables cannot be transferred via Item Swap (R6.7)
**Open questions:** none

### R5.5 — Shop purchase costs
**Source:** §13 "Shop" (rulebook lines 1012–1023)
**Requirement:** During the active player's Card Play phase, they may purchase one or more shop cards. To buy 1 shop card, the active player must discard either 2 normal cards from their hand OR 1 rare card from their hand (rare = purple entity, orange fortress, or yellow/gold item).
**Detail:** A purchased card must be played or equipped immediately using the normal placement rules. If it cannot be legally placed, it cannot be purchased. Each shop purchase counts as one of the active player's 3 played cards for the turn.
**State touched:** Shop state, hand, played cards count
**Edge cases:** A purchased card that cannot be placed cannot be bought; the shop does not refill automatically
**Open questions:** Can a player purchase the same shop card twice if it has multiple copies? (Unclear from rulebook; likely only one copy exists per slot.)

### R5.6 — Shop inventory rules
**Source:** §13 "Shop" (rulebook lines 1008–1010, 1025–1027)
**Requirement:** Shop cards belong to the player who placed them. Only that player may buy from their own shop. All shop cards are always visible to all players. The shop does not refill on its own. Once a shop card is bought, that slot is gone for the rest of the game unless a special rule refills it.
**Detail:** This creates a finite resource that becomes more depleted as the game progresses.
**State touched:** Shop zone, purchasing state
**Edge cases:** none
**Open questions:** none

### R5.7 — Multiple shop purchases in one Card Play phase
**Source:** §13 "Shop" (rulebook lines 1012–1023)
**Requirement:** A player may purchase one or more shop cards in a single Card Play phase. Each purchase counts toward the 3-card limit (R5.1).
**Detail:** A player playing 0 entities, 1 fortress, and buying 2 shop cards = 3 cards played (legal). A player cannot exceed the 3-card rule by purchasing multiple cards.
**State touched:** Card Play phase, shop purchases
**Edge cases:** none
**Open questions:** none

---

## Part 6: Combat Phase (Phase 2)

### R6.1 — Combat declaration and scope
**Source:** §10 "Combat" (rulebook lines 749–754); §9 Phase 2 "Combat" (rulebook lines 660–689)
**Requirement:** The active player may declare any number of combat engagements this turn. Each engagement is resolved fully before the next begins.
**Detail:** Declaring multiple engagements is legal and common (multi-engagement turns). Each engagement follows the combat round structure of R6.3–R6.6 below.
**State touched:** Combat phase, engagement sequence
**Edge cases:** none
**Open questions:** none

### R6.2 — Combat staging and entity movement into engagement
**Source:** §10.1 "Combat Staging/Movement" (rulebook lines 823–854)
**Requirement:** During Combat Staging, the active player declares one engagement at a time. For each engagement, the active player chooses which of their eligible entities are participating and moves them into the engagement area if required. Combat Staging is not general movement; it only moves entities into the engagement they are about to fight in. Entities moved during Combat Staging must immediately participate in that engagement.
**Detail:** An entity moved into an engagement during Combat Staging cannot be moved again until the engagement ends and the Movement phase (Phase 3) begins. Fortress entities may leave their fortress during Combat Staging to join a battlefield engagement (and are then treated as battlefield entities for that engagement).
**State touched:** Entity position during engagement
**Edge cases:** Entities inside fortresses must explicitly leave during Combat Staging if they want to join a battlefield engagement
**Open questions:** none

### R6.3 — Combat round structure
**Source:** §10 "Combat Rounds" (rulebook lines 798–821)
**Requirement:** Combat proceeds in alternating rounds. In each round: (1) the attacker's participating entities each take ONE action, (2) the defender's participating entities each take ONE action, (3) if one side is fully destroyed, the engagement ends; otherwise, begin the next round.
**Detail:** Each round is a full cycle of attacker actions, then defender actions. If both sides survive, another round begins immediately.
**State touched:** Combat round sequence, entity action turn
**Edge cases:** none
**Open questions:** none

### R6.4 — Actions available in combat
**Source:** §6 "Entity Actions" (rulebook lines 430–453)
**Requirement:** Every entity participating in combat may take one of the following actions on its turn: (A) Normal Attack, (B) Use a Consumable, or (C) Use a Special Ability.
**Detail:** In addition to those three baseline actions, an entity may take any of the response actions defined elsewhere in this Part (Parry R6.12, Retreat R6.13, Item Swap R6.14, Heal R6.15, Supercharged Attack R6.16, Buy Extra Action R6.17). Only one action per entity per round, unless an Extra Action (R6.17) is purchased.
**State touched:** Entity action pool
**Edge cases:** none
**Open questions:** none

### R6.5 — Normal attack resolution
**Source:** §10.2 "Normal Attack" (rulebook lines 854–867)
**Requirement:** To make a normal attack: (1) Declare a target (one legal enemy in this engagement: one entity, or the fortress if this is a fortress assault). (2) Roll 1d6. (3) If the result is equal to or below the acting entity's current modified Attack value, the attack hits. Otherwise it misses. (4) A normal hit deals 1 HP of damage unless a special rule or card text changes the amount.
**Detail:** Only the result of the die roll compared to Attack determines a hit. Bonuses and penalties from items and fortress buffs are applied to the Attack value before the roll.
**State touched:** Combat state, target entity/fortress HP
**Edge cases:** none
**Open questions:** none

### R6.6 — Engagement end conditions
**Source:** §10.3 "Fortress Assault" (rulebook lines 880–884); §10 "Combat Rounds" (rulebook lines 798–821)
**Requirement:** An engagement ends when: (A) all defending entities are killed or retreat, or (B) all attacking entities are killed or retreat, or (C) the fortress is destroyed (in fortress assault), or (D) the engagement ends by rule (e.g., no legal defenders remain).
**Detail:** Once an engagement ends, the active player may declare another engagement, or proceed to the Movement phase.
**State touched:** Engagement state
**Edge cases:** none
**Open questions:** none

### R6.7 — Initial Volley
**Source:** §10 "Initial Volley" (rulebook lines 774–796)
**Requirement:** When a battlefield engagement is declared, each eligible occupied fortress may fire one Initial Volley before the first combat round begins. A fortress may fire an Initial Volley only if: (1) it has at least one surviving occupant, (2) it is not currently under assault, (3) it is not participating in Fortress Barrage, and (4) the engagement is a battlefield engagement, not a fortress assault.
**Detail:** Each fortress may fire at most one Initial Volley per engagement, regardless of how many entities are inside it. The controlling player chooses which occupant fires. The volley is one normal attack against one enemy entity participating in the battlefield engagement. A battlefield engagement must include at least one attacking entity committed to the engagement; a player cannot declare an empty engagement just to trigger Initial Volley. Volleys cannot target fortresses.
**State touched:** Fortress state, engagement start
**Edge cases:** Fortresses under assault cannot fire Initial Volley into other engagements; fortresses in Fortress Barrage are excluded
**Open questions:** Can a single fortress fire volleys into multiple simultaneous battlefield engagements? (Likely no; one volley per engagement per fortress.)

### R6.8 — Fortress assault declaration and scope
**Source:** §10.3 "Fortress Assault" (rulebook lines 869–911)
**Requirement:** In a fortress assault, attacking battlefield entities may target either the fortress or any defending entity inside it. Defending entities inside the fortress may target attackers normally. Attackers may choose to target one or more enemy fortresses in the same engagement. Multi-fortress engagements are legal; there is no cap on the number of fortresses targeted in a single engagement.
**Detail:** A fortress assault is declared as an engagement targeting one or more enemy player's fortresses. Each targeted fortress resolves capture or destruction independently.
**State touched:** Engagement type, fortress state
**Edge cases:** none
**Open questions:** none

### R6.9 — Fortress assault end conditions
**Source:** §10.3 "Fortress Assault" (rulebook lines 880–912)
**Requirement:** A fortress assault ends when: (A) all defending entities are killed or retreat, OR (B) all attackers are killed or retreat, OR (C) the fortress is destroyed.
**Detail:** If (A) occurs and the fortress still has at least 1 HP, the surviving attackers may choose to capture or destroy the fortress. If (C) occurs, the fortress and all entities inside are destroyed.
**State touched:** Fortress state, defender state
**Edge cases:** none
**Open questions:** none

### R6.10 — Fortress capture mechanics
**Source:** §10.3 "Fortress Assault" (rulebook lines 885–900)
**Requirement:** If all defending entities of a fortress are killed or retreat and the fortress still has at least 1 HP, the surviving attackers may choose to capture or destroy the fortress. If CAPTURE is chosen: Control of the fortress transfers to the attacker. Up to the fortress's capacity in attackers may move inside it; any excess attackers stay on the battlefield. At least 1 entity must be garrisoned in the fortress upon first capture to keep the fortress. If no entities are moved into a newly captured fortress, the fortress remains under its previous owner's control. A victorious attacker may decide how to split surviving entities between the battlefield and/or the captured fortress. A victorious attacker does not need to capture a fortress and may leave it empty but still under enemy control.
**Detail:** Capture requires at least one entity to move in immediately to take effect. The attacker controls the split of entities post-assault. Captured entities inherit the fortress immediately upon entry (buffing begins if applicable).
**State touched:** Fortress control, entity position
**Edge cases:** An attacker may choose not to capture even if they can, leaving the fortress empty but still enemy-controlled
**Open questions:** Can an attacker capture one fortress and destroy another in the same engagement? (Likely yes, as each fortress resolves independently.)

### R6.11 — Fortress destruction mechanics
**Source:** §10.3 "Fortress Assault" (rulebook lines 905–911)
**Requirement:** If the fortress itself is reduced to 0 HP during the assault, it is destroyed. All entities inside it and their equipped items are immediately destroyed with it. If the Last Stand rule is active, defenders may take their final action before discarding. If defenders retreat before the fortress is destroyed, they can survive. If defenders did not choose to retreat before the fortress's HP reached 0, all defenders die.
**Detail:** Destruction is immediate upon HP reaching 0. Entities inside have no chance to escape unless they retreated before the destruction occurred.
**State touched:** Fortress state, defender state, item state
**Edge cases:** Last Stand (R6.12) allows a final action before destruction
**Open questions:** none

### R6.12 — Parry action
**Source:** §15 "Parry" (rulebook lines 1050–1068)
**Requirement:** Instead of taking a normal action during its turn in combat, an entity may declare a Parry. The parrying entity chooses one normal hit that was landed on it during the previous enemy round. Roll 1d6. If the roll is equal to or below the parrying entity's Attack stat, the parry succeeds: the entity regains 1 HP lost from that hit.
**Detail:** Parry only cancels 1 HP of damage from a single normal attack. It cannot cancel damage from specials, consumables, or extra damage bonuses. A parry attempt consumes the entity's action for that round, whether it succeeds or fails. An entity can only parry one hit at a time.
**State touched:** Entity HP, entity action
**Edge cases:** Parry affects only the previous round's hits; cannot parry current round damage or consumable/special damage
**Open questions:** Can parry be used in the first combat round? (Logically no, as there is no previous round.)

### R6.13 — Retreat action
**Source:** §16 "Retreat" (rulebook lines 1071–1090)
**Requirement:** Instead of attacking on its turn in combat, an entity may declare a retreat. The entity announces its intent to retreat and takes no action this round. During the next round, enemy entities in the engagement may target the retreating entity normally. If the retreating entity survives that round, it leaves the engagement at the end of the round.
**Detail:** A retreating entity must have a legal destination: battlefield entities may retreat into a friendly fortress with room; fortress entities under assault may retreat into the battlefield if room exists or into another friendly fortress if one has room. If no legal destination exists, the entity cannot retreat.
**State touched:** Entity position, engagement state
**Edge cases:** A retreating entity remains in combat for one more full round and must survive enemy attacks to leave
**Open questions:** Can a retreating entity that survives a retreat continue fighting in the next round, or has it left the engagement? (Left the engagement per the rule.)

### R6.14 — Item Swap action
**Source:** §17 "Item Swap" (rulebook lines 1094–1104)
**Requirement:** Instead of taking any other action in combat, an entity may transfer up to two of its equipped items to another friendly entity in the same engagement. The acting entity does not attack this round. The receiving entity must have room for the incoming items.
**Detail:** Items cannot be transferred to enemies. Consumables that have already been activated cannot be transferred.
**State touched:** Entity equipment state
**Edge cases:** Activated consumables are ineligible for transfer
**Open questions:** Can an entity receive more than 2 items if they are offered from multiple sources? (Per capacity limit R2.7, entities max 3 items.)

### R6.15 — Healing action
**Source:** §18 "Healing" (rulebook lines 1107–1119)
**Requirement:** Entities have the choice to heal themselves or another friendly entity in the same engagement. To heal, the acting entity rolls for an attack (1d6 against its modified Attack stat). On a hit, the healer randomly draws a card from their own deck and discards it. This heals any single friendly entity in the engagement by +1 HP. On a miss, the entity's action is consumed and no card is discarded.
**Detail:** Healing cannot raise an entity's HP above its printed maximum unless a card explicitly says so. The card drawn from the deck is determined randomly; the player does not choose which card is discarded.
**State touched:** Entity HP, deck, discard pile
**Edge cases:** A missed heal consumes the action but draws no card
**Open questions:** What happens if the deck is empty when Healing is used? (Likely no card is drawn, similar to Card Draw phase Q2.)

### R6.16 — Supercharged Attack action
**Source:** §19 "Supercharged Attack" (rulebook lines 1122–1134)
**Requirement:** Instead of a normal attack, an entity may declare a Supercharged Attack. Roll 3d6 instead of 1d6. If all three dice are equal to or below the entity's Attack value, the attack deals 2 damage instead of 1. If any one die misses, the attack fails and the attacking entity takes 1 self-damage.
**Detail:** A Supercharged Attack consumes the entity's action for the round. Self-damage from a failed Supercharged Attack can trigger Last Stand if it reduces the entity to 0 HP.
**State touched:** Entity HP, entity action
**Edge cases:** All three dice must hit to deal 2 damage; any miss triggers 1 self-damage
**Open questions:** Can self-damage from Supercharged Attack trigger Last Stand? (Yes, per Q12 in FAQ.)

### R6.17 — Buy Extra Action action
**Source:** §20 "Extra Actions" (rulebook lines 1137–1148)
**Requirement:** In combat, entities use only ONE action per round by default. An entity may "buy" one additional action by randomly drawing 3 cards from the entity's controlling player's deck and discarding them. This grants the entity one additional action this round, which may be any normal action.
**Detail:** The cost stacks: two extra actions = 6 discarded cards (3 per extra action). There is no cap other than deck depth.
**State touched:** Entity action pool, deck, discard pile
**Edge cases:** Extra actions are purchased per engagement and reset each round
**Open questions:** Can extra actions be purchased multiple times per round by the same entity? (Yes, per the rule stacking.)

### R6.18 — Last Stand action
**Source:** §21 "Last Stand" (rulebook lines 1156–1175)
**Requirement:** When an entity is reduced to 0 HP, it may take one final action before being discarded: a normal attack, a consumable, a special ability, or a Heal. Last Stand triggers from any source of 0 HP, including self-damage from Supercharged Attack.
**Detail:** After taking its final action, the entity is placed in its owner's graveyard along with its items. An entity killed by Last Stand is defeated normally. If the Last Stand action causes the entity's HP to increase to 1 or more (e.g., via a successful Heal), the entity remains alive and is not discarded. An entity may take only one Last Stand action each time it is reduced to 0 HP. If it survives because that action restored HP, it does not receive another Last Stand from the same damage event.
**State touched:** Entity defeat state, entity HP, graveyard
**Edge cases:** Last Stand is triggered at the moment of 0 HP; Heal can revive during Last Stand; self-damage from Supercharged triggers Last Stand
**Open questions:** none

### R6.19 — Reinforcements action
**Source:** §22 "Reinforcements" (rulebook lines 1179–1219)
**Requirement:** At the end of either side's combat round, that side may call ONE reinforcement into the engagement. To call a reinforcement, choose one friendly entity already in the engagement. That entity becomes the caller. The caller's NEXT action is spent calling the reinforcement instead of attacking, healing, retreating, or using another action. If the caller is defeated before its next action, the reinforcement still arrives, but the caller is defeated normally.
**Detail:** Only one reinforcement per side per round may be called, but there is no cap on total reinforcements over the course of the engagement. The reinforcing entity must come from a legal nearby zone: one of the calling player's own fortresses in the suburbs or the battlefield. A reinforcement enters the engagement immediately and can be targeted by enemies in the next round. It cannot act during the round it arrives. After the engagement ends, the reinforcement remains wherever it reinforced into: battlefield reinforcements stay on the battlefield, fortress reinforcements stay in that fortress.
**Detail (continued):** Defenders inside a fortress under assault are isolated: they cannot call or receive reinforcements during that engagement (their fortress is surrounded). A reinforcement may not be called into a location that is already at its cap: no reinforcement into a fortress that already holds 3 entities, no reinforcement onto a battlefield already holding 5 of that player's entities. Reinforcements may be called into Fortress Barrage engagements, but defenders inside a battlefield-assaulted fortress are still isolated.
**State touched:** Engagement participants, reinforcement state, entity position
**Edge cases:** Defenders in an assaulted fortress cannot call reinforcements; reinforcements cannot enter at-capacity locations
**Open questions:** Can a reinforcement be called from a fortress that has entities fighting in the engagement? (Likely yes; fortress entities can leave to fight elsewhere.)

### R6.20 — Scavenger action
**Source:** §23 "Scavenger" (rulebook lines 1222–1237)
**Requirement:** If a friendly entity is defeated during an engagement, allied entities (controlled by the SAME player) in that same engagement may immediately equip the dead entity's items if they have capacity. Any items that cannot be equipped are discarded normally.
**Detail:** Scavenger applies only to a player's OWN dead allies' items. A player may never pick up an enemy's items (per R3.8). Items that were already equipped by other entities cannot be transferred to a dead entity to "save" them for scavenging. This rule only applies at the moment of defeat.
**State touched:** Item state, entity equipment
**Edge cases:** Only items of dead allies may be scavenged; enemy items never transfer between players
**Open questions:** Can scavenged items immediately be used (e.g., consumables) or only equipped for future use? (Likely only equipped; consumption would be an action.)

### R6.21 — Fortress Barrage
**Source:** §24 "Fortress Barrage" (rulebook lines 1244–1270)
**Requirement:** Fortresses may engage an enemy fortress directly without moving through the battlefield. To declare a Fortress Barrage: the attacking fortress must have at least one entity inside. The target is a single enemy fortress. Entities inside the attacking fortress may target only the target fortress, not its occupants. Defending entities inside the target fortress may target attacking entities inside the attacking fortress normally (they fire back). Combat resolves in alternating rounds like a standard battlefield engagement.
**Detail:** A fortress cannot be captured through a Fortress Barrage. Only battlefield assaults can capture a fortress. If the Barrage kills all of the target fortress's occupants without destroying the fortress itself, the fortress stands empty under its previous controller's ownership. If the target fortress is destroyed, all its occupants and their items are destroyed with it. A fortress participating in Fortress Barrage cannot fire an Initial Volley into other engagements (per R6.7).
**State touched:** Engagement type, fortress state
**Edge cases:** Fortress entities do not leave the fortress to participate in Barrage; they attack across suburbs
**Open questions:** Can a fortress participate in both a Fortress Barrage and a normal assault in the same turn? (Likely no; it is one engagement at a time.)

---

## Part 7: Damage, Healing, Defeat, and Item Ownership

### R7.1 — Applying damage
**Source:** §11.1 "Applying Damage" (rulebook lines 918–923)
**Requirement:** When an entity or fortress takes damage, rotate its HP die down by the amount of damage taken. Healing works in reverse but can never raise an HP die above its printed maximum unless a card explicitly says so.
**Detail:** Damage is applied one HP at a time across multiple dice in any order the controlling player chooses (for Super Entities and Super Fortresses with multiple dice).
**State touched:** Entity/fortress HP state
**Edge cases:** Special cards may allow healing above the printed maximum
**Open questions:** none

### R7.2 — HP persistence between combats
**Source:** §11.2 "HP Does Not Reset" (rulebook lines 925–933)
**Requirement:** Damage persists between combats. An entity that survives one engagement with 2 HP remaining enters its next engagement still at 2 HP. The only way to heal is through an item, consumable, Healing action, or special ability that explicitly restores HP.
**Detail:** HP does not reset at the start of a new engagement or round. This rule may be disabled for casual play.
**State touched:** Entity HP state across engagements
**Edge cases:** none
**Open questions:** none

### R7.3 — Defeat of entities
**Source:** §11.3 "Defeat" (rulebook lines 935–942)
**Requirement:** An entity is defeated when its HP reaches 0. The entity and all of its equipped items are placed in its owner's graveyard.
**Detail:** Defeat is immediate upon HP = 0 unless Last Stand (R6.18) triggers.
**State touched:** Entity state, graveyard, item state
**Edge cases:** Last Stand allows one final action before defeat
**Open questions:** none

### R7.4 — Destruction of fortresses
**Source:** §11.3 "Defeat" (rulebook lines 935–942)
**Requirement:** A fortress is destroyed when its HP reaches 0. The fortress is placed in its owner's graveyard, along with every entity inside it and every item those entities were carrying.
**Detail:** Destruction is immediate upon HP = 0. All entities and items inside are discarded to the fortress owner's graveyard.
**State touched:** Fortress state, entity state, item state, graveyard
**Edge cases:** Last Stand may allow defenders one final action if that rule is active; however, they still die after
**Open questions:** none

---

## Part 8: Movement Phase (Phase 3)

### R8.1 — Movement rules and legal destinations
**Source:** §9 Phase 3 "Movement" (rulebook lines 691–724)
**Requirement:** The active player may freely reposition their own entities and transfer their own items during this phase, as long as all resulting positions are legal. Legal movement destinations are: battlefield to one of the player's fortresses (with space), player's fortress to the battlefield (if legal battlefield room exists), player's fortress to another of the player's fortresses (with space).
**Detail:** Movement is distinct from Combat Staging (R6.2). Only owned entities and items may be moved; enemy cards remain in place.
**State touched:** Entity position, item position
**Edge cases:** Movement must result in legal positions (capacity limits enforced)
**Open questions:** Can an entity move from the battlefield to a fortress, then back to the battlefield in one Movement phase? (Likely yes, per the "freely reposition" language.)

### R8.2 — End-of-Movement positioning and next-turn implications
**Source:** §9 Phase 3 "Movement" (rulebook lines 704–724)
**Requirement:** End-of-Movement positions decide what a player is ready to do on their next turn. Only battlefield entities can assault and capture enemy fortresses. Entities inside fortresses can defend, fire Initial Volleys when legal, and use Fortress Barrage if that rule is active, but they cannot capture enemy fortresses.
**Detail:** An undefended fortress has no entity defense. If it is assaulted by an enemy battlefield entity and survives the assault, the attacker may capture it immediately during Combat Resolution by moving at least one surviving attacker inside. Entities on the battlefield are exposed, but they threaten enemy fortresses. Entities inside fortresses are safer, but they give up capture pressure.
**State touched:** Entity position state, next-turn engagement options
**Edge cases:** none
**Open questions:** none

---

## Part 9: Card Draw Phase (Phase 4)

### R9.1 — Card draw mechanics
**Source:** §9 Phase 4 "Card Draw" (rulebook lines 725–735)
**Requirement:** The active player draws the top 2 cards of their deck at random, then searches their deck for 1 card of their choice. Add all 3 cards to hand. If fewer than 3 cards remain available, add as many as possible: draw random cards first, then search only if at least 1 card remains in the deck. After searching, reshuffle per Section 8 shuffling rules.
**Detail:** This is the only phase where cards are drawn from the deck (other than setup and mulligan). Card Draw always involves a search (choice) component, making it distinct from the random opening 7-card draw.
**State touched:** Deck, hand, graveyard (if deck exhaustion)
**Edge cases:** Deck may be partially exhausted; cards drawn first, then search if possible
**Open questions:** none

### R9.2 — Deck exhaustion during Card Draw
**Source:** FAQ Q2 (rulebook lines 1342–1347)
**Requirement:** If a player's deck runs out during the Card Draw phase: Draw as many cards as possible. If only 1 card remains, keep it. If 0 cards remain, skip the Card Draw phase for the rest of the game. Play continues with the current hand until it is empty.
**Detail:** Once a deck is fully exhausted, no more cards are drawn. The player continues play with whatever cards are in hand and on the table until hand and play are both depleted.
**State touched:** Deck state, Card Draw phase
**Edge cases:** A fully exhausted deck does not refill; Hamlet (R10.4) may trigger if no new entities can be played
**Open questions:** none

---

## Part 10: Victory Phase (Phase 5) & End-of-Turn Checks

### R10.1 — Victory conditions overview
**Source:** §7 "Victory Conditions" (rulebook lines 518–550)
**Requirement:** Goosklerf II uses four end conditions in multiplayer. The first one to trigger ends the game: Last Man Standing, Landlord, Hamlet, or Special. These are checked at the end of each player's turn during Victory Check.
**Detail:** Only one of these four will end the game; they are evaluated in order.
**State touched:** Game state, victory state
**Edge cases:** Special conditions (card-printed) override standard conditions
**Open questions:** none

### R10.2 — Last Man Standing victory condition
**Source:** §7 "Victory Conditions" (rulebook lines 524–525)
**Requirement:** Only one player (or team) has any surviving entities in play. That player wins immediately.
**Detail:** Surviving entities are those in play on the battlefield, in fortresses, or anywhere other than the graveyard and deck.
**State touched:** Entity state, game state
**Edge cases:** none
**Open questions:** none

### R10.3 — Landlord victory condition
**Source:** §7 "Victory Conditions" (rulebook lines 527–541)
**Requirement:** A player becomes Landlord when they control every fortress in play AND no unplayed fortress cards remain in any player's deck or hand. This is not an instant win: the Landlord must survive one full round (starting from the next player's turn) still meeting both conditions to win.
**Detail:** Landlord status is broken if, during the survival round: another player captures one of the Landlord's fortresses, another player plays a new fortress into their suburbs, or a scenario effect introduces a new fortress. Destruction of a Landlord's fortress does NOT break status by itself, but if it leaves zero fortresses in play, status ends. A broken Landlord status can be re-achieved later; the survival round restarts from scratch.
**State touched:** Fortress control state, game state, victory state
**Edge cases:** Destruction of a fortress does not break status unless it leaves the Landlord with zero fortresses
**Open questions:** Can a Landlord with zero fortresses still claim status if all other fortresses are destroyed? (Likely no; they must control "every fortress in play.")

### R10.4 — Hamlet victory condition (loss for all)
**Source:** §7 "Victory Conditions" (rulebook lines 543–544)
**Requirement:** All entities are destroyed, and no player can legally put a new entity into play. Everyone loses.
**Detail:** Hamlet is checked if no other victory condition triggers. It ends the game in a loss for all players.
**State touched:** Game state
**Edge cases:** none
**Open questions:** none

### R10.5 — Special victory conditions
**Source:** §7 "Victory Conditions" (rulebook lines 546–550)
**Requirement:** A special effect on an item, entity, fortress, or scenario may create an additional victory condition. If that special effect is successfully resolved, its victory condition overrides the standard multiplayer victory conditions and the controlling player wins immediately.
**Detail:** Card text creates custom win conditions; these take precedence over all other victory checks.
**State touched:** Game state
**Edge cases:** none
**Open questions:** none

### R10.6 — Victory Check phase procedures
**Source:** §9 Phase 5 "Victory Check" (rulebook lines 737–745)
**Requirement:** At the end of the turn, after Card Draw is complete, check whether any victory condition has been met. If so, the game ends. Landlord status is checked and tracked here. During the victory check, players must communicate whether or not they have any unplayed fortresses in their hand or deck, and may look through their own deck to confirm. Reshuffle per Section 8 shuffling rules.
**Detail:** Landlord requires an honest communication of remaining fortress cards. Players may verify their own decks but not opponents' decks.
**State touched:** Game state, victory state
**Edge cases:** none
**Open questions:** none

### R10.7 — Old Age rule and counter
**Source:** §14 "Old Age" (rulebook lines 1031–1043)
**Requirement:** At the end of a player's turn, if that player has gone 3 of their own turns without declaring an engagement, randomly choose one of their surviving entities. That entity dies and is discarded.
**Detail:** Declaring any engagement resets the count. Initial Volley does not reset the count. Fortress Barrage does reset the count. Old Age cannot be prevented, healed, revived, or used for Last Stand. If a player's last entity dies from Old Age, that player loses.
**State touched:** Entity state, Old Age counter, graveyard
**Edge cases:** Initial Volley alone does not reset; Fortress Barrage does reset; no other effects can prevent Old Age
**Open questions:** If a player declares an engagement that lasts multiple rounds, does the counter reset at declaration or at engagement end? (Likely at declaration per the rule "declaring any engagement resets.")

---

## Appendix A: Cross-Rule Interactions

The following combinations are explicitly addressed in the rulebook:

**Fortress buffs and items stack:** Fortress buffs apply to occupants and stack with item buffs, subject to stat limits (1–5 Attack, 0–6 HP per die) (R3.10).

**Fortress buffs lost immediately on entity departure:** Fortress buffs are removed when an entity leaves a fortress via Combat Staging, Movement, Retreat, or any movement rule (R3.10).

**Fortress buffs apply to Initial Volley and Fortress Barrage:** Entities firing Initial Volleys or Fortress Barrage from a fortress apply that fortress's buffs to their Attack stat (R3.10, R6.7, R6.21).

**Last Stand and Healing:** A Heal action can be used as a Last Stand action. If the Heal roll succeeds, the entity's HP rises to 1 and it survives defeat (R6.12, R6.18, FAQ Q15).

**Last Stand and Supercharged Attack self-damage:** Self-damage from a failed Supercharged Attack triggers Last Stand if it reduces the entity to 0 HP (R6.16, FAQ Q12).

**Parry and consumables/specials:** Parry cannot cancel damage from consumables or special abilities; only normal attacks may be parried (R6.12, FAQ Q3).

**Scavenger and item ownership:** Scavenged items remain owned by the original player; enemy items never transfer (R6.20, R3.8, FAQ Q17).

**Retreating entity from fortress assault:** A fortress entity under assault may retreat into the battlefield (if room exists) or another friendly fortress (if room exists) (R6.13).

**Reinforcements isolation in fortress assault:** Defenders inside a fortress under assault cannot call or receive reinforcements (R6.19).

**Reinforcements at capacity:** Reinforcements cannot be called into a location already at capacity (3 entities per fortress, 5 per player on battlefield) (R6.19).

**Multiple fortresses in one engagement:** An attacker may target multiple enemy fortresses in a single fortress assault engagement; each fortress resolves capture or destruction independently (R6.8).

**Capture requires garrisoned entity:** At least 1 entity must move into a newly captured fortress for control to transfer; otherwise, the fortress remains under previous owner's control (R6.10).

**Old Age counter and engagement types:** Initial Volley alone does not reset the Old Age counter, but declaring any other engagement (battlefield, fortress assault, fortress barrage) does reset it (R10.7).

**Fortress Barrage and Initial Volley conflict:** A fortress participating in Fortress Barrage cannot fire an Initial Volley into a different battlefield engagement (R6.7, R6.21).

---

## Appendix B: Rule Numbering Map

**Part 1: Setup & Components**
- R1.1: Required materials
- R1.2: Deck regimes and minimum composition
- R1.3: Starting hand and mulligan
- R1.4: First player determination
- R1.5: Shop setup at game start

**Part 2: Cards (Types, Anatomy, Rarity, Stat Limits)**
- R2.1: Card types overview
- R2.2: Entity cards
- R2.3: Fortress cards
- R2.4: Item cards
- R2.5: Card anatomy and stat values
- R2.6: Stat limits (Attack and HP per die)
- R2.7: Capacity limits (items, entities per fortress, battlefield entities)

**Part 3: Zones & Core Concepts**
- R3.1: Battlefield zone
- R3.2: Suburbs zone and fortress placement
- R3.3: Graveyard zone
- R3.4: Deck and Hand zones
- R3.5: Shop zone (optional)
- R3.6: Control and occupation
- R3.7: Engagement definition and scope
- R3.8: Item ownership and control
- R3.9: Card text overrides rules
- R3.10: Fortress buffs and debuffs

**Part 4: Turn Structure Overview**
- R4.1: Five-phase turn structure
- R4.2: Entity participation limit per engagement per turn

**Part 5: Card Play Phase (Phase 1)**
- R5.1: Three-card rule and forced play/discard
- R5.2: Legal card plays
- R5.3: Placement capacity during Card Play
- R5.4: Consumables play and use
- R5.5: Shop purchase costs
- R5.6: Shop inventory rules
- R5.7: Multiple shop purchases in one Card Play phase

**Part 6: Combat Phase (Phase 2)**
- R6.1: Combat declaration and scope
- R6.2: Combat staging and entity movement into engagement
- R6.3: Combat round structure
- R6.4: Actions available in combat
- R6.5: Normal attack resolution
- R6.6: Engagement end conditions
- R6.7: Initial Volley
- R6.8: Fortress assault declaration and scope
- R6.9: Fortress assault end conditions
- R6.10: Fortress capture mechanics
- R6.11: Fortress destruction mechanics
- R6.12: Parry action
- R6.13: Retreat action
- R6.14: Item Swap action
- R6.15: Healing action
- R6.16: Supercharged Attack action
- R6.17: Buy Extra Action action
- R6.18: Last Stand action
- R6.19: Reinforcements action
- R6.20: Scavenger action
- R6.21: Fortress Barrage

**Part 7: Damage, Healing, Defeat, and Item Ownership**
- R7.1: Applying damage
- R7.2: HP persistence between combats
- R7.3: Defeat of entities
- R7.4: Destruction of fortresses

**Part 8: Movement Phase (Phase 3)**
- R8.1: Movement rules and legal destinations
- R8.2: End-of-Movement positioning and next-turn implications

**Part 9: Card Draw Phase (Phase 4)**
- R9.1: Card draw mechanics
- R9.2: Deck exhaustion during Card Draw

**Part 10: Victory Phase (Phase 5) & End-of-Turn Checks**
- R10.1: Victory conditions overview
- R10.2: Last Man Standing victory condition
- R10.3: Landlord victory condition
- R10.4: Hamlet victory condition (loss for all)
- R10.5: Special victory conditions
- R10.6: Victory Check phase procedures
- R10.7: Old Age rule and counter
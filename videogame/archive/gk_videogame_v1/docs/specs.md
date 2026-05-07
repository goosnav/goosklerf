GOOSKLERF II DIGITAL GAME
SOFTWARE REQUIREMENTS AND ARCHITECTURE BIBLE
V1.0

================================================================================
1. PRODUCT DEFINITION
================================================================================

Build an offline desktop videogame adaptation of Goosklerf II.

The game must faithfully implement Classic Goosklerf using the full official ruleset, with all Advanced Rules enabled. The game must support human play against AI bots and also support headless AI-vs-AI simulations for balance testing.

This is not a generic tabletop simulator. It is a purpose-built Goosklerf II videogame.

Primary goals:

1. Let a human play Classic Goosklerf against 1-3 AI players.
2. Let 2-4 AI players play thousands of games locally without a GUI.
3. Generate useful balance reports from those simulations.
4. Be downloadable and playable offline on desktop.
5. Be simple, robust, deterministic where possible, and easy to expand later.

V1 must not require:

- Server
- Internet
- Paid APIs
- Online multiplayer
- Account system
- Cloud saves
- Local LLM
- Neural network AI
- Mobile layout
- Campaign Mode
- Chessklerf
- Singleplayer Battlepath Mode

================================================================================
2. V1 SCOPE
================================================================================

V1 includes:

- Desktop app
- Classic Mode only
- All Advanced Rules always enabled
- 2-4 total players
- 0-1 human players
- 1-3 AI players
- AI-vs-AI headless simulator
- Local deterministic rules engine
- Local card image assets
- Imported card database from existing CSV
- Random legal deck generation
- Medium deck default
- Dice visualization in GUI
- Full game log
- Save/load
- Simulation reports
- AI personalities
- Offline packaging for Windows, macOS, and Linux

V1 excludes:

- Online multiplayer
- LAN multiplayer
- Phone UI
- Portrait mode
- Campaign Mode
- Chessklerf
- Rule toggles
- Custom modes
- Card OCR app
- Card creator
- Local LLM
- Steam integration
- Cloud sync
- 3D tabletop simulation

================================================================================
3. TARGET USER EXPERIENCE
================================================================================

The user should be able to:

1. Download a zip file.
2. Unzip it.
3. Open the app.
4. Choose number of players.
5. Choose AI opponents/personalities.
6. Start a Classic Goosklerf game.
7. Play using a clear card-table UI.
8. See dice rolls, legal actions, card effects, HP, logs, and victory status.
9. Save/load games.
10. Run AI simulations from a command-line tool or developer/simulator menu.
11. Generate balance reports.

The GUI should feel like:

- Colonist.io in clarity
- Desktop Solitaire in immediacy
- A clean digital board/card game
- Alive but not overanimated
- Functional before decorative

The game should not feel like:

- A wooden tabletop simulator
- A bloated 3D board game
- A generic web demo
- A rules spreadsheet with pictures
- A hyperanimated mobile gacha game

================================================================================
4. RECOMMENDED TECH STACK
================================================================================

Use:

- Electron
- React
- TypeScript
- Vite
- Node.js
- dnd-kit for drag/drop
- Zustand or Redux Toolkit for UI state
- electron-builder for packaging
- JSON for card database
- CSV as import source
- Node CLI for headless simulator

Rationale:

Electron allows one desktop app codebase for Windows, macOS, and Linux. React/TypeScript is appropriate for a complex card UI. Node/TypeScript allows the same rules engine to power both the GUI and the simulator.

The critical architectural requirement:

THE GUI AND THE HEADLESS SIMULATOR MUST USE THE SAME RULES ENGINE.

Do not implement rules twice.

================================================================================
5. REPOSITORY STRUCTURE
================================================================================

Recommended monorepo:

goosklerf-digital/
  package.json
  tsconfig.json
  vite.config.ts

  apps/
    desktop/
      electron/
        main.ts
        preload.ts
      src/
        App.tsx
        screens/
        components/
        styles/
      public/
        cards/
          *.jpg

    simulator/
      src/
        cli.ts
        batchRunner.ts
        reportWriter.ts

    card-tools/
      src/
        importCsv.ts
        validateCards.ts
        buildCardDb.ts

  packages/
    engine/
      src/
        state/
        rules/
        actions/
        validators/
        reducers/
        combat/
        victory/
        rng/
        logging/
        serialization/

    ai/
      src/
        policies/
        personalities/
        evaluators/
        aiController.ts

    cards/
      data/
        raw/
          card_data-003.csv
        generated/
          cards.generated.json
          cardIndex.generated.ts
      src/
        cardTypes.ts
        cardSchema.ts
        cardEffects/

    shared/
      src/
        ids.ts
        errors.ts
        result.ts
        constants.ts

  tests/
    engine/
    cards/
    ai/
    simulations/

  docs/
    software_bible.txt
    rules_mapping.txt
    ai_personalities.txt
    card_effects_status.txt

================================================================================
6. CARD DATA REQUIREMENTS
================================================================================

The existing OCR CSV is the input source. It must be transformed into a canonical JSON card database before gameplay.

Known CSV columns:

- filename
- card_name
- card_type
- hp
- fortress_hp
- attack
- attack_buff
- hp_buff
- misc_stat
- description
- has_special
- notes

Known current dataset:

- Total cards: 128
- Entities: 45
- Fortresses: 9
- Regular items: 17
- Consumables: 57
- Cards with special logic: 65
- Cards without special logic: 63

The CSV must not be directly used by the runtime engine. It is an import source only.

The generated runtime database must be:

cards.generated.json

Each card must have a stable canonical ID independent of filename.

Example:

AVERAGE POLYCULE -> average_polycule
BABY'S FIRST HOWITZER -> babys_first_howitzer
BILLY'S BIG CASTLE -> billys_big_castle

If duplicate names exist, append suffixes:

average_polycule
average_polycule_2
average_polycule_alt_art

================================================================================
7. CANONICAL CARD SCHEMA
================================================================================

Each card definition must conform to this structure:

CardDefinition:
  id: string
  name: string
  filename: string
  imagePath: string

  type:
    entity
    fortress
    item_regular
    item_consumable

  rarity:
    normal
    rare
    unknown

  baseAttack?: number
  baseHp?: number
  fortressHp?: number

  attackBuff?: number
  hpBuff?: number

  miscStat?: string
  rulesText: string
  notes?: string

  hasSpecial: boolean
  effectIds: string[]

  tags: string[]

  validationStatus:
    valid
    warning
    invalid

  validationErrors: string[]

  automationStatus:
    fully_implemented
    partially_implemented
    not_implemented
    data_error

Required validation:

1. Every card must have a non-empty name.
2. Every card must have a valid type.
3. Every card must have a unique ID.
4. Every card must map to exactly one image file.
5. Every entity must have attack and HP.
6. Every fortress must have fortress HP.
7. Every item must have valid buff/effect data or valid rules text.
8. Every special card must have an implementation status.
9. Cards with invalid required stats must be excluded from playable deck generation.
10. Cards with unimplemented special effects must be excluded from v1 default deck generation unless explicitly permitted by developer debug mode.

================================================================================
8. CARD IMAGE REQUIREMENTS
================================================================================

There is exactly one JPG per card.

Card images must be bundled locally with the app.

Required build-time validation:

For every card row:
  - filename exists in public/cards/

For every image file:
  - it is referenced by one card row, or flagged as unused

For every loaded card:
  - image path resolves
  - image loads in GUI
  - image can be enlarged/inspected

The app must not depend on remote image URLs.

================================================================================
9. CARD INSTANCE MODEL
================================================================================

A CardDefinition is static. A CardInstance is an actual copy of a card in a game.

CardInstance:
  instanceId: string
  definitionId: string
  ownerPlayerId: string
  controllerPlayerId: string

  zone: ZoneRef

  currentHp?: number
  maxHp?: number
  currentFortressHp?: number
  maxFortressHp?: number

  equippedItemIds: string[]
  containedEntityIds: string[]

  exhaustedThisEngagement: boolean
  participatedThisTurn: boolean

  temporaryModifiers: Modifier[]
  persistentModifiers: Modifier[]

This distinction is mandatory because a legal deck may contain multiple copies of the same card name.

================================================================================
10. GAME STATE MODEL
================================================================================

GameState:
  gameId: string
  ruleset: classic_advanced_v1

  rngSeed: string
  rngState: RngState

  players: PlayerState[]
  activePlayerId: string
  turnNumber: number
  roundNumber: number

  phase:
    card_play
    combat
    movement
    card_draw
    victory_check
    game_over

  pendingEngagement?: EngagementState
  pendingChoice?: PendingChoice

  zones:
    battlefield: ZoneState
    shops: Record<PlayerId, ZoneState>
    hands: Record<PlayerId, ZoneState>
    decks: Record<PlayerId, ZoneState>
    graveyards: Record<PlayerId, ZoneState>
    suburbs: Record<PlayerId, ZoneState>

  cardsByInstanceId: Record<string, CardInstance>

  landlordStatus?:
    claimantPlayerId: string
    startedAtTurnNumber: number
    survivalRoundRemainingPlayerIds: string[]

  oldAgeCounters: Record<PlayerId, number>

  log: GameLogEntry[]

  winner?: PlayerId
  gameOverReason?: string

PlayerState:
  playerId: string
  name: string
  type: human | ai
  aiPersonalityId?: string
  eliminated: boolean
  seatIndex: number

================================================================================
11. RULES ENGINE REQUIREMENTS
================================================================================

The rules engine is the core of the project.

The rules engine must:

1. Be written in TypeScript.
2. Be independent from React and Electron.
3. Be callable from both GUI and simulator.
4. Validate all actions before applying them.
5. Block illegal moves.
6. Produce structured errors for illegal moves.
7. Emit structured log entries.
8. Use deterministic seeded RNG.
9. Serialize and deserialize complete game state.
10. Support replay from action log.
11. Have unit tests for all major rules.

The rules engine must not:

1. Access the DOM.
2. Use React state directly.
3. Use Math.random().
4. Depend on GUI-only assumptions.
5. Duplicate logic inside UI components.
6. Call cloud APIs.
7. Require internet.

================================================================================
12. ACTION COMMAND SYSTEM
================================================================================

Every player or AI action must be represented as a command.

GameAction types:

- PLAY_CARD
- DISCARD_CARD
- EQUIP_ITEM
- DECLARE_ENGAGEMENT
- SELECT_COMBAT_PARTICIPANTS
- NORMAL_ATTACK
- USE_CONSUMABLE
- USE_SPECIAL_ABILITY
- PARRY
- RETREAT
- ITEM_SWAP
- HEAL
- SUPERCHARGED_ATTACK
- BUY_EXTRA_ACTION
- MOVE_ENTITY
- TRANSFER_ITEM
- DRAW_CARDS
- SEARCH_DECK
- END_PHASE
- RESOLVE_PENDING_CHOICE

Every action must go through:

1. validateAction(state, action)
2. if invalid, reject with structured explanation
3. applyAction(state, action)
4. update state
5. emit game log entries
6. process automatic triggers
7. check pending choices
8. return new GameState

Required function shape:

reduceGameAction(state: GameState, action: GameAction): ActionResult

ActionResult:
  ok: boolean
  state?: GameState
  error?: GameRuleError
  logEntries: GameLogEntry[]
  pendingChoice?: PendingChoice

================================================================================
13. RNG REQUIREMENTS
================================================================================

All randomness must use a deterministic seeded RNG.

Randomness includes:

- deck shuffling
- starting player selection
- dice rolls
- random discards
- random card draws
- AI stochastic choices
- Old Age random entity selection
- random deck generation
- simulation seeds

Do not use Math.random() in gameplay logic.

RngService:
  seed: string
  nextFloat(): number
  rollD6(): number
  shuffle<T>(items: T[]): T[]
  pickOne<T>(items: T[]): T
  pickN<T>(items: T[], n: number): T[]

Every game must store:

- initial seed
- current RNG state
- full action log

This allows exact reproduction of simulation bugs.

================================================================================
14. CLASSIC MODE SETUP
================================================================================

V1 supports Classic Mode only.

Player count:

- Minimum 2 total players
- Maximum 4 total players
- 0 or 1 human players
- Remaining players are AI

Default deck regime:

- Medium Deck
- 36 cards
- official standard deck size

Deck legality:

- 36 cards exactly
- minimum 10 entities
- minimum 2 fortresses
- minimum 15 items
- maximum 3 copies of any card with the same name

Recommended default random deck composition:

- 12 entities
- 3 fortresses
- 21 items

Recommended item split:

- 8 regular items
- 13 consumables

Setup flow:

1. Select total player count.
2. Select whether human participates.
3. Assign AI personalities.
4. Generate legal 36-card deck for each player.
5. Shuffle each deck.
6. Draw shop cards for each player.
7. Draw starting hand of 7 cards for each player.
8. Determine first player by RNG.
9. Begin Card Play phase.

Shop setup:

- Medium Deck uses 7 shop cards.
- Each player has their own visible shop.
- Shop cards belong to the player whose shop they are in.

================================================================================
15. PHASE STRUCTURE
================================================================================

Each game turn has exactly five phases:

1. Card Play
2. Combat
3. Movement
4. Card Draw
5. Victory Check

The active player must complete each phase before moving to the next.

The engine must enforce phase-specific legal actions.

================================================================================
16. CARD PLAY PHASE REQUIREMENTS
================================================================================

During Card Play:

- Active player must play exactly 3 cards if possible.
- If fewer than 3 legal plays exist, active player must discard until played + discarded = 3.
- If active player has fewer than 3 cards in hand, they play/discard as many as possible.
- If hand is empty, skip Card Play.

Legal plays:

- Play fortress into own suburbs.
- Play entity onto battlefield.
- Play entity into own fortress.
- Equip item to own entity.
- Purchase and immediately play/equip a shop card.

Capacity limits must be enforced:

- Max 3 items per entity.
- Max 3 entities per fortress.
- Max 5 battlefield entities per player.

================================================================================
17. COMBAT PHASE REQUIREMENTS
================================================================================

During Combat:

- Active player may declare any number of engagements.
- Each engagement resolves completely before the next begins.
- Each active player's entity may participate in only one engagement per turn unless card text overrides this.

Combat types:

1. Battlefield engagement
2. Fortress assault
3. Mega-engagement against multiple fortresses
4. Fortress Barrage

Combat sub-phases:

1. Combat Staging/Movement
2. Initial Volley if applicable
3. Combat Rounds
4. Combat Resolution

Combat round order:

1. Attacker participating entities each take one action.
2. Defender participating entities each take one action.
3. Check whether one side is destroyed, retreated, or engagement ended.
4. If not, begin next round.

Basic combat actions:

- Normal Attack
- Use Consumable
- Use Special Ability

Advanced combat actions:

- Parry
- Retreat
- Item Swap
- Healing
- Supercharged Attack
- Buy Extra Action

================================================================================
18. NORMAL ATTACK REQUIREMENTS
================================================================================

Normal attack process:

1. Acting entity selects legal target.
2. Roll 1d6.
3. If roll <= current modified Attack, attack hits.
4. Otherwise attack misses.
5. A normal hit deals 1 HP damage unless card text overrides.
6. Apply damage.
7. Check defeat, Last Stand, Scavenger, and other triggers.

Attack stat limits:

- Minimum Attack: 1
- Maximum Attack: 5
- Card text may override.

Dice must be visible in GUI.

================================================================================
19. FORTRESS ASSAULT REQUIREMENTS
================================================================================

Only battlefield entities can assault enemy fortresses.

In a fortress assault:

- Attackers may target the fortress or defending entities inside.
- Defending entities inside the fortress may target attackers.
- Attackers may target multiple enemy fortresses in one engagement.
- Each targeted fortress resolves capture/destruction independently.

A fortress assault ends when:

- all defending entities are killed or retreat, or
- all attackers are killed or retreat, or
- the fortress is destroyed.

Capture rule:

If all defenders of a fortress are killed or retreat and the fortress has at least 1 HP, surviving attackers may capture or destroy it.

To capture:

- Control transfers to attacker.
- At least 1 surviving attacker must move inside the fortress.
- Fortress capacity must be respected.
- Excess attackers stay on battlefield.

To destroy:

- Fortress is discarded.
- No one controls it.
- Attackers remain on battlefield.

Destroyed fortress:

- At 0 HP, fortress is destroyed.
- All entities inside are destroyed.
- All items carried by those entities are destroyed.
- Last Stand may trigger if active.

================================================================================
20. INITIAL VOLLEY REQUIREMENTS
================================================================================

Initial Volley occurs when a real battlefield engagement begins.

A fortress may fire Initial Volley only if:

- It has at least one surviving occupant.
- It is not currently under assault.
- It is not participating in Fortress Barrage.
- The engagement is a battlefield engagement, not a fortress assault.
- At least one attacking entity has been committed.

Each eligible fortress may fire at most one Initial Volley per engagement.

The controlling player chooses which occupant fires.

Volley is one normal attack against one enemy entity participating in the battlefield engagement.

Volleys cannot target fortresses.

================================================================================
21. MOVEMENT PHASE REQUIREMENTS
================================================================================

During Movement, the active player may reposition own entities and transfer own items.

Legal movement:

- Battlefield to own fortress with room.
- Own fortress to battlefield if battlefield room exists.
- Own fortress to another own fortress with room.

Only battlefield entities can assault and capture enemy fortresses.

Entities inside fortresses can:

- defend
- fire Initial Volley
- use Fortress Barrage
- benefit from fortress buffs

Entities inside fortresses cannot capture enemy fortresses.

================================================================================
22. CARD DRAW PHASE REQUIREMENTS
================================================================================

During Card Draw:

1. Active player draws top 2 cards from deck.
2. Active player searches deck for 1 card of choice.
3. Add all 3 cards to hand.
4. Shuffle deck after searching.

If fewer than 3 cards remain:

- draw random cards first
- search only if at least 1 card remains

AI search must be policy-driven.

Human search must show searchable/selectable deck UI.

================================================================================
23. VICTORY CHECK REQUIREMENTS
================================================================================

Victory conditions:

1. Last Man Standing
2. Landlord
3. Hamlet
4. Special

Last Man Standing:

- Only one player/team has surviving entities in play.
- That player wins immediately.

Landlord:

- A player controls every fortress in play.
- No unplayed fortress cards remain in any player's deck or hand.
- Landlord must survive one full round, starting from next player's turn.
- If status remains through the survival round, Landlord wins.

Landlord status breaks if:

- another player captures one of the Landlord's fortresses
- another player plays a new fortress
- a scenario/special effect introduces a new fortress

Destruction of a Landlord fortress does not break status by itself unless it leaves zero fortresses in play.

Hamlet:

- All entities are destroyed.
- No player can legally put a new entity into play.
- Everyone loses.

Special:

- A special effect may create additional victory condition.
- If resolved, it overrides standard victory.

================================================================================
24. ADVANCED RULES REQUIRED IN V1
================================================================================

All Advanced Rules are always active.

Required Advanced Rules:

1. Shop
2. Old Age
3. Parry
4. Retreat
5. Item Swap
6. Healing
7. Supercharged Attack
8. Extra Actions
9. Last Stand
10. Reinforcements
11. Scavenger
12. Fortress Barrage

No rule toggling in v1.

================================================================================
25. SHOP REQUIREMENTS
================================================================================

Each player has own shop.

Medium deck shop size:

- 7 cards

Buying cost:

- discard 2 normal cards from hand, or
- discard 1 rare card from hand

Purchased card must be immediately played/equipped.

Purchase counts as one of the 3 Card Play cards.

If card cannot be legally placed, it cannot be purchased.

Shop does not refill automatically.

================================================================================
26. OLD AGE REQUIREMENTS
================================================================================

At end of player's turn:

- If player has gone 3 own turns without declaring an engagement, randomly choose one surviving entity controlled by that player.
- That entity dies and is discarded.

Declaring any engagement resets count.

Initial Volley does not reset count.

Fortress Barrage does reset count.

Old Age cannot be prevented, healed, revived, or used for Last Stand.

If last entity dies from Old Age, player loses.

================================================================================
27. PARRY REQUIREMENTS
================================================================================

Parry is an advanced combat action.

Instead of normal action, entity may parry.

Parry targets one normal hit suffered during previous enemy round.

Roll 1d6 against entity Attack.

On success:

- regain 1 HP lost from that normal hit.

On failure:

- action is consumed.

Parry cannot cancel:

- specials
- consumables
- non-normal damage
- bonus damage from other rules

================================================================================
28. RETREAT REQUIREMENTS
================================================================================

Retreat is an advanced combat action.

Entity announces retreat and takes no action that round.

During next enemy round:

- enemy can target retreating entity normally.

If retreating entity survives:

- it leaves engagement at end of round.

Legal destinations:

- battlefield entity may retreat into friendly fortress with room
- fortress defender may retreat to battlefield if room exists
- fortress defender may retreat into another friendly fortress with room

If no legal destination exists, entity cannot retreat.

================================================================================
29. ITEM SWAP REQUIREMENTS
================================================================================

Item Swap is an advanced combat action.

Entity may transfer up to 2 equipped items to another friendly entity in same engagement.

Receiving entity must have capacity.

Consumables already activated cannot be transferred.

Items cannot transfer to enemies.

================================================================================
30. HEALING REQUIREMENTS
================================================================================

Healing is an advanced combat action.

Acting entity rolls 1d6 against its modified Attack.

On hit:

- randomly draw 1 card from controller's deck
- discard that card
- heal one friendly entity in engagement by +1 HP

On miss:

- action consumed
- no card discarded

Healing cannot raise HP above printed maximum unless card says otherwise.

Healing can be used as a Last Stand action if Last Stand is active.

================================================================================
31. SUPERCHARGED ATTACK REQUIREMENTS
================================================================================

Supercharged Attack is an advanced combat action.

Roll 3d6.

If all three dice are <= Attack:

- attack deals 2 damage.

If any die misses:

- attack fails
- attacking entity takes 1 self-damage.

Consumes entity action.

Last Stand may trigger from self-damage.

================================================================================
32. EXTRA ACTIONS REQUIREMENTS
================================================================================

Entity may buy extra action during combat.

Cost:

- randomly draw 3 cards from controlling player's deck
- discard them

Effect:

- entity gets one additional action this combat round.

Extra Actions can be bought repeatedly if enough deck remains.

No cap except deck depth.

================================================================================
33. LAST STAND REQUIREMENTS
================================================================================

When entity reaches 0 HP:

- it may take one final action before being discarded.

Valid Last Stand actions:

- normal attack
- consumable
- special ability
- heal if Healing rule active

If Last Stand action restores HP above 0:

- entity survives.

If not:

- entity and items go to graveyard.

An entity may receive only one Last Stand per damage event.

Old Age does not trigger Last Stand.

================================================================================
34. REINFORCEMENTS REQUIREMENTS
================================================================================

At end of either side's combat round:

- that side may call one reinforcement into engagement.

Calling requires choosing one friendly entity already in engagement as caller.

The caller's next action is spent calling reinforcement.

If caller dies before next action:

- reinforcement still arrives
- caller dies normally

Only one reinforcement per side per round.

Defenders inside a fortress under assault cannot call or receive reinforcements.

Reinforcement source:

- own fortress in suburbs
- battlefield

Reinforcing entity enters engagement immediately.

It cannot act during round it arrives.

Capacity limits apply.

================================================================================
35. SCAVENGER REQUIREMENTS
================================================================================

When friendly entity dies during engagement:

- surviving friendly entities controlled by same player in same engagement may immediately equip dead ally's items if they have capacity.

Scavenger applies only to own dead allies' items.

Enemy items may never be picked up.

Unclaimed items are discarded.

================================================================================
36. FORTRESS BARRAGE REQUIREMENTS
================================================================================

Fortress Barrage is fortress-vs-fortress combat.

To declare:

- attacking fortress must have at least one entity inside.
- target must be one enemy fortress.

Entities inside attacking fortress may target only the target fortress.

Defending entities inside target fortress may target attacking entities inside attacking fortress.

Combat resolves in alternating rounds.

Fortress cannot be captured through Barrage.

If target fortress occupants die but fortress remains:

- fortress stands empty under previous controller.

If target fortress destroyed:

- occupants and items destroyed.

Fortress Barrage resets Old Age counter.

================================================================================
37. STAT LIMITS
================================================================================

Default stat limits:

Attack:
  min 1
  max 5

HP per die:
  min 0
  max 6

Items per entity:
  min 0
  max 3

Entities per fortress:
  min 0
  max 3

Battlefield entities:
  min 0
  max 5 per player

If buff exceeds cap, cap applies.

If debuff goes below minimum, minimum applies.

HP may reach 0.

If capacity changes cause overflow, controlling player chooses excess cards to discard.

================================================================================
38. SPECIAL CARD LOGIC
================================================================================

Special card logic is the largest implementation risk.

The engine must not try to interpret English card text dynamically.

Every special card must be handled explicitly by code.

CardEffectHandler:
  id: string
  cardId: string
  timing: EffectTiming[]
  canTrigger(ctx): boolean
  getChoices(ctx): ChoiceSpec[]
  resolve(ctx, choices): EffectResult

EffectTiming examples:

- on_play
- on_equip
- on_unequip
- on_attack_declared
- after_attack_roll
- on_hit
- on_miss
- on_damage_taken
- on_damage_dealt
- on_death
- on_last_stand
- on_turn_start
- on_turn_end
- on_engagement_start
- on_engagement_end
- on_fortress_capture
- continuous_modifier

Each special card must be assigned:

- fully_implemented
- partially_implemented
- disabled_due_to_ambiguity
- data_error

V1 deck generation must only include:

- cards with no special text, or
- cards with fully implemented special logic

Unimplemented special cards must not appear in default random decks.

Developer debug mode may allow unimplemented cards, but release mode must not.

Required file:

docs/card_effects_status.txt

Required fields:

- card_id
- card_name
- special_text
- status
- effect_handler_id
- notes
- test_status

================================================================================
39. AI REQUIREMENTS
================================================================================

V1 AI must be rule-based, not LLM-based.

AI must:

1. Generate legal actions only.
2. Score legal actions.
3. Pick actions based on personality weights.
4. Use deterministic seeded randomness.
5. Handle all game phases.
6. Play complete games without human intervention.
7. Be usable in both GUI and headless simulator.
8. Never cheat unless explicitly configured for test mode.

AI architecture:

chooseAction(state, playerId, personality):
  1. get legal actions
  2. score each action
  3. apply personality weights
  4. use weighted stochastic selection
  5. return action

AI must support personalities.

Required personalities:

1. The Butcher
2. The Landlord
3. The Goblin
4. The Accountant

================================================================================
40. AI PERSONALITY DEFINITIONS
================================================================================

AiPersonality:
  id: string
  name: string
  weights:
    aggression: number
    fortressCapture: number
    fortressDefense: number
    entityPreservation: number
    itemGreed: number
    shopUse: number
    riskTolerance: number
    superchargeUse: number
    extraActionUse: number
    retreatPreference: number
    focusFire: number
    randomness: number

The Butcher:

- high aggression
- high focus fire
- high risk tolerance
- high extra action use
- high supercharge use
- low retreat preference
- medium fortress capture

The Landlord:

- high fortress capture
- high fortress defense
- high entity preservation
- low risk tolerance
- medium aggression
- high Landlord victory awareness

The Goblin:

- high item greed
- high shop use
- high consumable use
- high randomness
- high special use
- medium aggression

The Accountant:

- balanced optimizer
- low randomness
- high survival awareness
- high expected-value decisions
- good baseline AI for simulations

================================================================================
41. AI BOARD EVALUATION
================================================================================

AI must evaluate:

- own entity count
- enemy entity count
- own total HP
- enemy total HP
- own fortress count
- enemy fortress count
- own occupied fortresses
- enemy occupied fortresses
- own battlefield threat
- enemy battlefield threat
- hand value
- deck value
- shop value
- item value
- capture opportunities
- Landlord threat
- Hamlet risk
- likely retaliation
- expected damage
- kill opportunities
- survival risk

Action scores should account for:

Normal attack:
  expected damage
  kill bonus
  focus-fire bonus
  capture progress
  retaliation risk

Retreat:
  entity preservation
  lost attack opportunity
  survival bonus
  fortress defense value

Supercharged attack:
  probability of all dice hitting
  expected 2 damage value
  probability of self-damage
  risk personality bonus

Extra Action:
  expected value of best extra action
  value lost from discarding 3 random deck cards

Shop purchase:
  value of purchased card
  cost of discarded cards
  immediate playability
  synergy with board

Card search:
  current tactical need
  missing entity/fortress/item balance
  survival need
  offensive opportunity

================================================================================
42. HEADLESS SIMULATOR REQUIREMENTS
================================================================================

The headless simulator is mandatory.

It must run AI-vs-AI games locally without GUI.

Example command:

npm run sim -- --games 10000 --players 4 --seed goosnav-2026 --out reports/run-001

Simulator inputs:

- number of games
- total players
- AI personalities
- deck profile
- RNG seed
- max turns
- output directory
- optional card pool restrictions

Simulator outputs:

reports/run-001/
  summary.json
  games.csv
  card_stats.csv
  ai_stats.csv
  victory_modes.csv
  balance_flags.json
  readable_report.html

Required report metrics:

- total games
- average turns per game
- average estimated real session length
- win rate by AI personality
- win rate by seat/order
- victory condition frequency
- Landlord frequency
- Hamlet frequency
- Last Man Standing frequency
- Special victory frequency
- average engagements per game
- average fortress captures
- average fortress destructions
- average entity deaths
- average cards drawn
- average cards discarded
- average shop purchases
- average extra actions bought
- average supercharged attacks
- average retreats
- average parries
- average heals
- most-played cards
- highest win-rate cards
- most lethal cards
- most-equipped items
- most-used consumables
- cards never played
- cards causing errors
- games exceeding max turn limit

Balance flags:

- AI personality win rate above expected range
- first-player advantage too high
- average game length too long
- Hamlet rate too high
- Landlord never occurs
- specific card appears too often in winning decks
- specific card has abnormal kill contribution
- repeated unresolved choice failures
- illegal action attempted by AI
- max-turn games too frequent

================================================================================
43. GUI REQUIREMENTS
================================================================================

The GUI must be desktop landscape-first.

Required screens:

1. Main Menu
2. New Game Setup
3. Game Table
4. Card Database Viewer
5. Simulation Runner or Simulation Report Viewer
6. Settings
7. Load Game

Main table layout:

- AI opponent panels at top/sides
- battlefield in center
- enemy suburbs/fortresses near opponents
- player suburbs/fortresses near bottom
- player hand at bottom
- action panel
- dice panel
- log panel
- phase/turn indicator

Required visible information:

For human player:

- own hand
- own deck count
- own graveyard
- own shop
- own fortresses
- own entities
- own items
- active choices

For AI players:

- AI name/personality
- hand count
- deck count
- graveyard count
- visible shop
- visible entities
- visible fortresses
- visible equipped items
- hidden hand cards

Card interaction:

- click to inspect
- drag to valid zone
- legal zones highlighted
- illegal zones blocked
- legal targets highlighted
- invalid actions explained briefly
- card enlarged on hover/click
- equipped items visible under or beside entity
- fortress occupants visible nested inside fortress

Dice UI:

- show d6 roll
- show target number
- show hit/miss
- show damage result
- show multi-dice Supercharged Attack rolls

Animation:

- light card movement
- simple dice motion or flash
- hit/damage pulse
- no long unskippable animations
- fast mode available

================================================================================
44. HIDDEN INFORMATION
================================================================================

Human player can see:

- own hand
- own shop
- all visible battlefield cards
- all visible fortresses
- all graveyards
- opponent hand counts
- opponent deck counts
- opponent visible shops

Human player cannot see:

- opponent hands
- opponent deck order
- AI hidden choices before action

Headless simulator has full state access internally but AI decision functions should only evaluate legal information available to that AI unless deliberately configured otherwise.

================================================================================
45. GAME LOG REQUIREMENTS
================================================================================

Every action must generate readable and structured log entries.

Example log:

Turn 4 - Goblin AI - Combat
Goblin declares fortress assault against Billy's Big Castle.
Average Polycule attacks Brat.
Roll: 3 vs Attack 4 -> HIT.
Brat takes 1 damage. HP: 2 -> 1.
Butcher AI triggers Last Stand with Wormson Wormley.

GameLogEntry:
  id: string
  turnNumber: number
  phase: GamePhase
  playerId?: string
  actionType: string
  message: string
  structuredData: object

The log is required for:

- player clarity
- debugging
- AI development
- simulation analysis
- replaying bugs

================================================================================
46. SAVE / LOAD REQUIREMENTS
================================================================================

The game must support save/load.

Save file:

game_YYYY-MM-DD_001.goosklerf-save.json

Save file contains:

- complete GameState
- ruleset version
- card database version
- RNG seed and state
- action log
- AI personalities
- decklists
- timestamp
- app version

Required features:

- manual save
- manual load
- autosave after every action
- export game log
- replay from action log

Saved games must not rely on internet access.

================================================================================
47. PACKAGING REQUIREMENTS
================================================================================

Build separate desktop zips:

- Goosklerf-II-Windows.zip
- Goosklerf-II-macOS.zip
- Goosklerf-II-Linux.zip

Each package includes:

- executable app
- bundled card images
- bundled card database
- default settings
- README
- license file
- version file

Player should not need to install Node.js.

Developer commands:

npm install
npm run dev
npm run desktop
npm run build
npm run package:win
npm run package:mac
npm run package:linux
npm run sim
npm run test
npm run cards:import
npm run cards:validate

================================================================================
48. TESTING REQUIREMENTS
================================================================================

Testing is mandatory.

Test categories:

- card database validation
- deck generation
- phase transitions
- card play
- movement
- combat
- fortress assault
- Initial Volley
- Shop
- Old Age
- Parry
- Retreat
- Item Swap
- Healing
- Supercharged Attack
- Extra Actions
- Last Stand
- Reinforcements
- Scavenger
- Fortress Barrage
- victory conditions
- AI legal actions
- save/load
- replay
- simulation stability
- card special effects

Required deterministic tests:

1. Attack 3 hits on rolls 1,2,3 and misses on 4,5,6.
2. Entity at 0 HP is defeated.
3. Last Stand gives one final action.
4. Successful Last Stand Healing revives entity.
5. Parry only cancels normal-hit damage.
6. Consumable damage cannot be parried.
7. Only battlefield entities can capture fortresses.
8. Fortress occupants defend during assault.
9. Destroyed fortress destroys occupants.
10. Landlord requires survival round.
11. Hamlet triggers correctly.
12. Extra Action discards 3 random deck cards.
13. Old Age kills after 3 own turns without engagement.
14. Fortress Barrage cannot capture fortress.
15. Scavenger never transfers enemy items.
16. Shop purchase requires immediate legal play.
17. Card Draw draws two then searches one.
18. Deck search shuffles afterward.

Release soak test:

npm run sim -- --games 10000 --players 4 --seed release-test

Release passes only if:

- 0 crashes
- 0 illegal accepted actions
- 0 unresolved pending choices
- 0 infinite loops
- 0 missing image assets
- 0 invalid default deck cards
- 0 unimplemented special cards in default deck pool

================================================================================
49. DEVELOPMENT MILESTONES
================================================================================

MILESTONE 0 - DATA CLEANUP

Deliverables:

- cards.generated.json
- card validation report
- missing-stat report
- image mapping report
- special-card implementation status file

Exit criteria:

- all default deck cards valid
- all filenames resolve
- no entity missing attack
- no fortress missing HP
- no duplicate card IDs
- unimplemented specials excluded from default pool

MILESTONE 1 - HEADLESS CORE ENGINE

Deliverables:

- GameState model
- action system
- phase transitions
- random deck generation
- card play
- movement
- draw/search
- victory shell

Exit criteria:

- can create a legal game
- can step through phases
- can serialize/deserialize state

MILESTONE 2 - COMBAT ENGINE

Deliverables:

- engagement system
- normal attacks
- damage
- defeat
- fortress assault
- capture/destroy
- Initial Volley
- combat logs

Exit criteria:

- can simulate basic Classic Goosklerf with no advanced actions

MILESTONE 3 - ADVANCED RULES

Deliverables:

- Shop
- Old Age
- Parry
- Retreat
- Item Swap
- Healing
- Supercharged Attack
- Extra Actions
- Last Stand
- Reinforcements
- Scavenger
- Fortress Barrage

Exit criteria:

- all Advanced Rules pass unit tests

MILESTONE 4 - CARD SPECIALS

Deliverables:

- effect handler system
- implemented handlers for default-pool special cards
- card effect tests

Exit criteria:

- no unimplemented special cards appear in release deck generation

MILESTONE 5 - AI

Deliverables:

- legal action generator
- board evaluator
- Butcher AI
- Landlord AI
- Goblin AI
- Accountant AI

Exit criteria:

- 1000 AI games complete without crash

MILESTONE 6 - SIMULATOR

Deliverables:

- CLI simulator
- batch runner
- CSV/JSON reports
- HTML report
- seeded replay

Exit criteria:

- 10000-game run completes locally and outputs useful report

MILESTONE 7 - DESKTOP GUI

Deliverables:

- Electron app
- game setup screen
- table screen
- card inspector
- action UI
- dice UI
- battle log
- AI turn visualization
- save/load

Exit criteria:

- human can play full Classic game against 1-3 AI

MILESTONE 8 - PACKAGING

Deliverables:

- Windows zip
- macOS zip
- Linux zip
- README
- versioned release

Exit criteria:

- fresh machine can unzip and play offline

================================================================================
50. IMPLEMENTATION PRIORITY
================================================================================

Correct build order:

1. Normalize card database.
2. Build deterministic rules engine.
3. Build headless CLI runner.
4. Build combat.
5. Build Advanced Rules.
6. Build special card effect system.
7. Build AI.
8. Run AI-vs-AI simulations.
9. Fix engine/rule bugs.
10. Build GUI.
11. Package desktop app.

Do not build the drag/drop UI first.

The engine is the game. The GUI is just a view/controller.

================================================================================
51. RELEASE CRITERIA
================================================================================

V1 release is acceptable only if:

- Classic Mode works.
- All Advanced Rules are enforced.
- Human can play against 1-3 AI.
- AI can complete games without illegal moves.
- Headless simulator can run 10000 games.
- Reports are generated.
- All default-deck cards are valid.
- All default-deck specials are implemented.
- Saves load correctly.
- Game logs are readable.
- App works offline.
- App packages for Windows, macOS, and Linux.

================================================================================
52. CENTRAL DEVELOPMENT INSTRUCTION
================================================================================

Build Goosklerf II as an offline Electron desktop game with a deterministic TypeScript rules engine. The GUI and simulator must use the same engine. V1 implements only Classic Mode with all Advanced Rules enabled, 2-4 total players, 0-1 human players, and 1-3 AI players. The game must enforce legal moves, use local card JPGs, generate legal random decks from the card database, support AI personalities, and run headless AI-vs-AI Monte Carlo simulations that output balance reports. No server, no online multiplayer, no cloud APIs, no LLM AI, no Campaign Mode, no Chessklerf, and no phone UI in v1.

================================================================================
53. CRITICAL WARNING
================================================================================

The biggest risk is special card logic.

The base rules are implementable.
The GUI is implementable.
The simulator is implementable.
The AI is implementable.

But 65 special cards means the team must either:

1. Implement each special card explicitly, or
2. Exclude unimplemented special cards from v1 deck generation.

There is no reliable third option.

Recommended policy:

V1 deck pool = only cards with valid stats and fully implemented specials.
V1.1 = expand implemented special-card pool.
V1.2 = full 128-card implementation.

This keeps the game faithful, shippable, and robust.

================================================================================
END OF SOFTWARE BIBLE
================================================================================
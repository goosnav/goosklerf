import React, { useEffect, useMemo, useState } from 'react'
import { createAiController } from '@gk/ai'
import {
  getAttackValue,
  getContainingFortressId,
  getDefinition,
  getEnemyBattleCards,
  getFortressOccupants,
  getPlayerBattleCards,
  getPlayerInPlayEntities,
  getPlayerSuburbCards,
  reduceGameAction,
  type GameAction,
  type GameState,
  type InstanceId,
} from '@gk/engine'
import type { CardDefinition } from '@gk/cards'
import { useToast } from '../components/Toast.js'
import { saveGame } from '../services/persistence.js'

interface Props {
  state: GameState
  onStateChange: (state: GameState) => void
  onExit: () => void
}

type TrayTab = 'hand' | 'shop' | 'log'

export default function TableScreen({ state, onStateChange, onExit }: Props) {
  const [selectedCard, setSelectedCard] = useState<InstanceId>('')
  const [selectedTarget, setSelectedTarget] = useState<InstanceId>('')
  const [selectedAttacker, setSelectedAttacker] = useState<InstanceId>('')
  const [selectedMover, setSelectedMover] = useState<InstanceId>('')
  const [selectedMoveFortress, setSelectedMoveFortress] = useState<InstanceId>('')
  const [inspectedCard, setInspectedCard] = useState<InstanceId | null>(null)
  const [trayTab, setTrayTab] = useState<TrayTab>('hand')
  const toast = useToast()

  const activePlayer = state.players.find(p => p.playerId === state.activePlayerId)!
  const humanActive = activePlayer.type === 'human'
  const ai = useMemo(() => createAiController(activePlayer.aiPersonalityId), [activePlayer.aiPersonalityId])
  const ownFortresses = getPlayerSuburbCards(state, activePlayer.playerId)
  const ownBattlefieldEntities = getPlayerBattleCards(state, activePlayer.playerId, 'entity')
  const ownEntities = getPlayerInPlayEntities(state, activePlayer.playerId)
  const enemyTargets = getEnemyBattleCards(state, activePlayer.playerId)
  const visibleCards = [
    ...state.zones.hands[activePlayer.playerId].instanceIds,
    ...state.zones.shops[activePlayer.playerId].instanceIds,
  ]
  const selectedDef = selectedCard ? getDefinition(state, selectedCard) : undefined
  const playIntent = selectedDef
    ? getPlayIntent(state, selectedCard, selectedDef, activePlayer.playerId)
    : null
  const targetOptions = playIntent?.targetKind === 'friendly_entity'
    ? ownEntities
    : playIntent?.targetKind === 'friendly_fortress'
      ? ownFortresses.filter(id => getFortressOccupants(state, id).length < 3)
      : playIntent?.targetKind === 'enemy'
        ? enemyTargets
        : []
  const boardTargetIds = state.phase === 'combat'
    ? enemyTargets
    : state.phase === 'card_play'
      ? targetOptions
      : []
  const latestLog = [...state.log].slice(-12).reverse()

  useEffect(() => {
    if (!selectedCard || !visibleCards.includes(selectedCard)) {
      setSelectedCard(visibleCards[0] ?? '')
    }
  }, [selectedCard, visibleCards.join('|')])

  useEffect(() => {
    if (!selectedAttacker || !ownBattlefieldEntities.includes(selectedAttacker)) {
      setSelectedAttacker(
        ownBattlefieldEntities.find(id => !state.cardsByInstanceId[id].participatedThisTurn) ??
        ownBattlefieldEntities[0] ??
        '',
      )
    }
  }, [ownBattlefieldEntities.join('|'), selectedAttacker, state])

  useEffect(() => {
    if (!selectedMover || !ownEntities.includes(selectedMover)) {
      setSelectedMover(ownEntities[0] ?? '')
    }
    if (!selectedMoveFortress || !ownFortresses.includes(selectedMoveFortress)) {
      setSelectedMoveFortress(ownFortresses[0] ?? '')
    }
  }, [ownEntities.join('|'), ownFortresses.join('|'), selectedMover, selectedMoveFortress])

  useEffect(() => {
    if (!selectedTarget || !targetOptions.includes(selectedTarget)) {
      setSelectedTarget(targetOptions[0] ?? '')
    }
  }, [targetOptions.join('|'), selectedTarget])

  useEffect(() => {
    if (state.phase === 'combat' && (!selectedTarget || !enemyTargets.includes(selectedTarget))) {
      setSelectedTarget(enemyTargets[0] ?? '')
    }
  }, [state.phase, enemyTargets.join('|'), selectedTarget])

  useEffect(() => {
    if (state.phase === 'game_over' || humanActive) return
    const timeout = window.setTimeout(() => {
      applyAction(ai.selectAction(state, activePlayer.playerId))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [state, humanActive, activePlayer.playerId, ai])

  function applyAction(action: GameAction) {
    const result = reduceGameAction(state, action)
    if (result.ok && result.state) {
      onStateChange(result.state)
    } else {
      toast.error(result.error?.message ?? 'Illegal action')
    }
  }

  function handleSave() {
    const slot = saveGame(state, `Turn ${state.turnNumber} · ${state.phase.replace('_', ' ')}`)
    toast.success(`Saved: ${slot.name}`)
  }

  // Keyboard shortcuts: Spacebar = end phase, Esc = clear selection / close modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (state.phase === 'game_over') return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (inspectedCard) setInspectedCard(null)
        else {
          setSelectedCard('')
          setSelectedTarget('')
        }
        return
      }
      if (!humanActive) return
      if (e.key === ' ') {
        e.preventDefault()
        applyAction({ type: 'END_PHASE', playerId: activePlayer.playerId })
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state, humanActive, activePlayer.playerId, inspectedCard])

  function playSelectedCard() {
    if (!selectedCard || !selectedDef || !playIntent || playIntent.disabledReason) return
    applyAction({
      type: 'PLAY_CARD',
      playerId: activePlayer.playerId,
      instanceId: selectedCard,
      targetInstanceId: playIntent.targetKind === 'none' ? undefined : selectedTarget,
    })
  }

  function attackSelectedTarget() {
    if (!selectedAttacker || !selectedTarget) return
    applyAction({
      type: 'NORMAL_ATTACK',
      playerId: activePlayer.playerId,
      attackerInstanceId: selectedAttacker,
      targetInstanceId: selectedTarget,
    })
  }

  function moveSelectedEntity() {
    if (!selectedMover) return
    const containingFortress = getContainingFortressId(state, selectedMover)
    applyAction({
      type: 'MOVE_ENTITY',
      playerId: activePlayer.playerId,
      entityInstanceId: selectedMover,
      destination: containingFortress ? 'battlefield' : 'fortress',
      targetFortressId: containingFortress ? undefined : selectedMoveFortress,
    })
  }

  const inspected = inspectedCard ? getDefinition(state, inspectedCard) : null
  const phaseLabel = state.phase.replace('_', ' ')

  return (
    <div className="table-screen">
      <header className="top-bar">
        <div className="title-block">
          <h2>Goosklerf II</h2>
          <span>{state.gameId}</span>
        </div>
        <div className="turn-pill">
          <strong>{state.phase === 'game_over' ? 'Game Over' : activePlayer.name}</strong>
          <span>Turn {state.turnNumber} | {phaseLabel}</span>
          <span>Cards {state.cardPlaysThisTurn[activePlayer.playerId] ?? 0}/3</span>
        </div>
        <div className="top-actions">
          <button
            disabled={!humanActive || state.phase === 'game_over'}
            onClick={() => applyAction({ type: 'END_PHASE', playerId: activePlayer.playerId })}
            title="End Phase (Space)"
          >
            End Phase
          </button>
          <button onClick={handleSave} title="Save Game (Ctrl/Cmd+S)">Save</button>
          <button onClick={onExit}>Exit</button>
        </div>
      </header>

      {state.phase === 'game_over' && (
        <div className="notice">
          Winner: {state.players.find(p => p.playerId === state.winner)?.name ?? state.winner ?? 'none'}
          {state.gameOverReason ? ` (${state.gameOverReason})` : ''}
        </div>
      )}

      <main className="game-shell">
        <section className="board-column" aria-label="Game board">
          <div className="board-header">
            <h3>Board</h3>
            <span>{state.phase === 'combat' ? 'Choose a battlefield attacker, then click or select a legal target.' : 'Suburbs / Battlefield'}</span>
          </div>
          <div className="players-grid">
            {state.players.map(player => (
              <PlayerBoard
                key={player.playerId}
                playerId={player.playerId}
                active={player.playerId === activePlayer.playerId}
                state={state}
                onInspect={setInspectedCard}
                targetIds={boardTargetIds}
                selectedTargetId={selectedTarget}
                onTargetSelect={setSelectedTarget}
              />
            ))}
          </div>
        </section>

        <aside className="control-column" aria-label="Controls">
          <section className="action-panel">
            <h3>{state.phase === 'combat' ? 'Combat' : state.phase === 'movement' ? 'Movement' : 'Card Assignment'}</h3>
            {state.phase === 'combat' ? (
              <CombatControls
                state={state}
                disabled={!humanActive}
                playerId={activePlayer.playerId}
                attackerId={selectedAttacker}
                targetId={selectedTarget}
                onAttackerChange={setSelectedAttacker}
                onTargetChange={setSelectedTarget}
                onAttack={attackSelectedTarget}
              />
            ) : state.phase === 'movement' ? (
              <MovementControls
                state={state}
                disabled={!humanActive}
                playerId={activePlayer.playerId}
                entityId={selectedMover}
                fortressId={selectedMoveFortress}
                onEntityChange={setSelectedMover}
                onFortressChange={setSelectedMoveFortress}
                onMove={moveSelectedEntity}
              />
            ) : (
              <CardAssignment
                state={state}
                disabled={!humanActive || state.phase !== 'card_play'}
                selectedCard={selectedCard}
                selectedDef={selectedDef}
                playIntent={playIntent}
                targetId={selectedTarget}
                targetOptions={targetOptions}
                onTargetChange={setSelectedTarget}
                onPlay={playSelectedCard}
                onDiscard={() => applyAction({ type: 'DISCARD_CARD', playerId: activePlayer.playerId, instanceId: selectedCard })}
                onInspect={setInspectedCard}
              />
            )}
          </section>

          <section className="tray-panel">
            <div className="tabs">
              <button className={trayTab === 'hand' ? 'active' : ''} onClick={() => setTrayTab('hand')}>
                Hand {state.zones.hands[activePlayer.playerId].instanceIds.length}
              </button>
              <button className={trayTab === 'shop' ? 'active' : ''} onClick={() => setTrayTab('shop')}>
                Shop {state.zones.shops[activePlayer.playerId].instanceIds.length}
              </button>
              <button className={trayTab === 'log' ? 'active' : ''} onClick={() => setTrayTab('log')}>
                Log
              </button>
            </div>
            {trayTab === 'log' ? (
              <div className="log-list">
                {latestLog.map(entry => <div key={entry.id} className="log-entry">{entry.message}</div>)}
              </div>
            ) : (
              <CardTray
                state={state}
                ids={trayTab === 'hand'
                  ? state.zones.hands[activePlayer.playerId].instanceIds
                  : state.zones.shops[activePlayer.playerId].instanceIds}
                selectedCard={selectedCard}
                onSelect={setSelectedCard}
                onInspect={setInspectedCard}
              />
            )}
          </section>
        </aside>
      </main>

      {inspected && inspectedCard && (
        <div className="modal-backdrop" onClick={() => setInspectedCard(null)}>
          <div className="card-modal" onClick={e => e.stopPropagation()}>
            <img src={`/${inspected.imagePath}`} alt={inspected.name} />
            <div>
              <h2>{inspected.name}</h2>
              <p className="muted">{inspected.type.replace('_', ' ')}</p>
              <p>{inspected.rulesText || 'No rules text.'}</p>
              <p className="muted">Automation: {inspected.automationStatus}</p>
              <button onClick={() => setInspectedCard(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerBoard({ playerId, active, state, onInspect, targetIds = [], selectedTargetId, onTargetSelect }: {
  playerId: string
  active: boolean
  state: GameState
  onInspect: (id: InstanceId) => void
  targetIds?: InstanceId[]
  selectedTargetId?: InstanceId
  onTargetSelect?: (id: InstanceId) => void
}) {
  const player = state.players.find(p => p.playerId === playerId)!
  const suburbs = getPlayerSuburbCards(state, playerId)
  const entities = getPlayerBattleCards(state, playerId, 'entity')
  return (
    <section className={`player-board ${active ? 'active' : ''}`}>
      <header>
        <div>
          <h4>{player.name}{player.eliminated ? ' (out)' : ''}</h4>
          <span>{player.type === 'human' ? 'Human' : `AI ${player.aiPersonalityId ?? ''}`}</span>
        </div>
        <div className="mini-stats">
          <span>Deck {state.zones.decks[playerId].instanceIds.length}</span>
          <span>Hand {state.zones.hands[playerId].instanceIds.length}</span>
          <span>Grave {state.zones.graveyards[playerId].instanceIds.length}</span>
        </div>
      </header>
      <ZoneBlock
        title="Suburbs"
        ids={suburbs}
        state={state}
        emptyText="No fortress in suburbs"
        onInspect={onInspect}
        targetIds={targetIds}
        selectedTargetId={selectedTargetId}
        onTargetSelect={onTargetSelect}
      />
      <ZoneBlock
        title="Battlefield"
        ids={entities}
        state={state}
        emptyText="No entities in battle"
        onInspect={onInspect}
        targetIds={targetIds}
        selectedTargetId={selectedTargetId}
        onTargetSelect={onTargetSelect}
      />
    </section>
  )
}

function ZoneBlock({ title, ids, state, emptyText, onInspect, targetIds = [], selectedTargetId, onTargetSelect }: {
  title: string
  ids: InstanceId[]
  state: GameState
  emptyText: string
  onInspect: (id: InstanceId) => void
  targetIds?: InstanceId[]
  selectedTargetId?: InstanceId
  onTargetSelect?: (id: InstanceId) => void
}) {
  return (
    <div className={`zone-block ${title.toLowerCase()}`}>
      <div className="zone-title">
        <strong>{title}</strong>
        <span>{ids.length}</span>
      </div>
      <div className="card-row">
        {ids.map(id => (
          <BoardCard
            key={id}
            instanceId={id}
            state={state}
            onInspect={onInspect}
            targetIds={targetIds}
            selectedTargetId={selectedTargetId}
            onTargetSelect={onTargetSelect}
          />
        ))}
        {ids.length === 0 && <div className="empty-zone">{emptyText}</div>}
      </div>
    </div>
  )
}

function CardAssignment({ state, disabled, selectedCard, selectedDef, playIntent, targetId, targetOptions, onTargetChange, onPlay, onDiscard, onInspect }: {
  state: GameState
  disabled: boolean
  selectedCard: InstanceId
  selectedDef?: CardDefinition
  playIntent: PlayIntent | null
  targetId: InstanceId
  targetOptions: InstanceId[]
  onTargetChange: (id: InstanceId) => void
  onPlay: () => void
  onDiscard: () => void
  onInspect: (id: InstanceId) => void
}) {
  if (!selectedCard || !selectedDef || !playIntent) {
    return <p className="muted">Select a card from Hand or Shop.</p>
  }
  const canPlay = !disabled && !playIntent.disabledReason && (playIntent.targetKind === 'none' || Boolean(targetId))
  return (
    <div className="assignment-flow">
      <div>
        <strong>{selectedDef.name}</strong>
        <p>{playIntent.summary}</p>
        {playIntent.disabledReason && <p className="blocked">{playIntent.disabledReason}</p>}
      </div>
      {playIntent.targetKind !== 'none' && (
        <label className="field-stack">
          <span>{targetLabel(playIntent.targetKind)}</span>
          <select value={targetId} disabled={targetOptions.length === 0} onChange={e => onTargetChange(e.target.value)}>
            {targetOptions.map(id => <option key={id} value={id}>{cardLabel(state, id)}</option>)}
          </select>
        </label>
      )}
      <div className="button-row">
        <button disabled={!canPlay} onClick={onPlay}>{playIntent.buttonLabel}</button>
        <button disabled={disabled || !selectedCard} onClick={onDiscard}>Discard</button>
        <button onClick={() => onInspect(selectedCard)}>Inspect</button>
      </div>
    </div>
  )
}

function MovementControls({ state, disabled, playerId, entityId, fortressId, onEntityChange, onFortressChange, onMove }: {
  state: GameState
  disabled: boolean
  playerId: string
  entityId: InstanceId
  fortressId: InstanceId
  onEntityChange: (id: InstanceId) => void
  onFortressChange: (id: InstanceId) => void
  onMove: () => void
}) {
  const fortresses = getPlayerSuburbCards(state, playerId)
  const battlefield = getPlayerBattleCards(state, playerId, 'entity')
  const occupants = fortresses.flatMap(id => getFortressOccupants(state, id))
  const entities = [...battlefield, ...occupants]
  const containing = entityId ? getContainingFortressId(state, entityId) : undefined
  const fortressTargets = fortresses.filter(id => id !== containing && getFortressOccupants(state, id).length < 3)
  const canMove = !disabled && Boolean(entityId) && (Boolean(containing) || fortressTargets.includes(fortressId))
  return (
    <div className="assignment-flow">
      <label className="field-stack">
        <span>Entity</span>
        <select value={entityId} disabled={disabled || entities.length === 0} onChange={e => onEntityChange(e.target.value)}>
          {entities.map(id => <option key={id} value={id}>{cardLabel(state, id)}</option>)}
        </select>
      </label>
      {!containing && (
        <label className="field-stack">
          <span>Move into fortress</span>
          <select value={fortressId} disabled={disabled || fortressTargets.length === 0} onChange={e => onFortressChange(e.target.value)}>
            {fortressTargets.map(id => <option key={id} value={id}>{cardLabel(state, id)}</option>)}
          </select>
        </label>
      )}
      {!containing && fortressTargets.length === 0 && <p className="blocked">No open fortress is available for this entity.</p>}
      <button disabled={!canMove} onClick={onMove}>{containing ? 'Move To Battlefield' : 'Move Into Fortress'}</button>
    </div>
  )
}

function CombatControls({ state, disabled, playerId, attackerId, targetId, onAttackerChange, onTargetChange, onAttack }: {
  state: GameState
  disabled: boolean
  playerId: string
  attackerId: InstanceId
  targetId: InstanceId
  onAttackerChange: (id: InstanceId) => void
  onTargetChange: (id: InstanceId) => void
  onAttack: () => void
}) {
  const attackers = getPlayerBattleCards(state, playerId, 'entity')
    .filter(id => !state.cardsByInstanceId[id].participatedThisTurn)
  const targets = getEnemyBattleCards(state, playerId)
  return (
    <div className="assignment-flow">
      <label className="field-stack">
        <span>Attacker</span>
        <select value={attackerId} disabled={disabled || attackers.length === 0} onChange={e => onAttackerChange(e.target.value)}>
          {attackers.map(id => <option key={id} value={id}>{cardLabel(state, id)} ATK {getAttackValue(state, id)}</option>)}
        </select>
      </label>
      <label className="field-stack">
        <span>Target</span>
        <select value={targetId} disabled={disabled || targets.length === 0} onChange={e => onTargetChange(e.target.value)}>
          {targets.map(id => <option key={id} value={id}>{cardLabel(state, id)}</option>)}
        </select>
      </label>
      <button disabled={disabled || !attackerId || !targetId} onClick={onAttack}>{attackButtonLabel(state, targetId)}</button>
    </div>
  )
}

function CardTray({ ids, state, selectedCard, onSelect, onInspect }: {
  ids: InstanceId[]
  state: GameState
  selectedCard: InstanceId
  onSelect: (id: InstanceId) => void
  onInspect: (id: InstanceId) => void
}) {
  if (ids.length === 0) return <div className="empty-zone">No cards here</div>
  return (
    <div className="tray-grid">
      {ids.map(id => (
        <BoardCard
          key={id}
          instanceId={id}
          state={state}
          selected={id === selectedCard}
          onSelect={onSelect}
          onInspect={onInspect}
        />
      ))}
    </div>
  )
}

function BoardCard({ instanceId, state, selected, onSelect, onInspect, targetIds = [], selectedTargetId, onTargetSelect }: {
  instanceId: InstanceId
  state: GameState
  selected?: boolean
  onSelect?: (id: InstanceId) => void
  onInspect: (id: InstanceId) => void
  targetIds?: InstanceId[]
  selectedTargetId?: InstanceId
  onTargetSelect?: (id: InstanceId) => void
}) {
  const card = getDefinition(state, instanceId)
  const instance = state.cardsByInstanceId[instanceId]
  if (!card || !instance) return null
  const hp = card.type === 'fortress'
    ? `${instance.currentFortressHp ?? card.fortressHp}/${instance.maxFortressHp ?? card.fortressHp}`
    : card.type === 'entity'
      ? `${instance.currentHp ?? card.baseHp}/${instance.maxHp ?? card.baseHp}`
      : ''
  const containingFortressId = card.type === 'entity' ? getContainingFortressId(state, instanceId) : undefined
  const containingFortress = containingFortressId ? getDefinition(state, containingFortressId) : undefined
  const targetable = targetIds.includes(instanceId)
  const targetSelected = selectedTargetId === instanceId
  const buffLabel = card.type === 'fortress' && ((card.attackBuff ?? 0) || (card.hpBuff ?? 0))
    ? `Buff ${signed(card.attackBuff ?? 0)} ATK ${signed(card.hpBuff ?? 0)} HP`
    : ''
  return (
    <article className={`board-card ${selected ? 'selected' : ''} ${targetable ? 'targetable' : ''} ${targetSelected ? 'target-selected' : ''}`}>
      <button
        className="image-button"
        onClick={() => targetable && onTargetSelect ? onTargetSelect(instanceId) : onSelect ? onSelect(instanceId) : onInspect(instanceId)}
      >
        <img src={`/${card.imagePath}`} alt={card.name} />
      </button>
      <div className="card-name">{card.name}</div>
      <div className="card-meta">
        <span>{card.type.replace('_', ' ')}</span>
        {card.type === 'entity' && <span>ATK {getAttackValue(state, instanceId)}</span>}
        {hp && <span>HP {hp}</span>}
        {containingFortress && <span>Inside {containingFortress.name}</span>}
        {card.type === 'fortress' && <span>Inside {instance.containedEntityIds.length}/3</span>}
        {buffLabel && <span>{buffLabel}</span>}
      </div>
      {instance.equippedItemIds.length > 0 && (
        <div className="equipment-list">
          {instance.equippedItemIds.map(itemId => (
            <button key={itemId} onClick={() => onInspect(itemId)}>{cardLabel(state, itemId)}</button>
          ))}
        </div>
      )}
      {card.type === 'fortress' && instance.containedEntityIds.length > 0 && (
        <div className="occupant-list">
          <strong>Inside</strong>
          {instance.containedEntityIds.map(entityId => (
            <BoardCard
              key={entityId}
              instanceId={entityId}
              state={state}
              onInspect={onInspect}
              targetIds={targetIds}
              selectedTargetId={selectedTargetId}
              onTargetSelect={onTargetSelect}
            />
          ))}
        </div>
      )}
      <div className="card-actions">
        {onSelect && <button onClick={() => onSelect(instanceId)}>Select</button>}
        {targetable && onTargetSelect && <button onClick={() => onTargetSelect(instanceId)}>Target</button>}
        <button onClick={() => onInspect(instanceId)}>Inspect</button>
      </div>
    </article>
  )
}

type PlayIntent = {
  targetKind: 'none' | 'friendly_entity' | 'friendly_fortress' | 'enemy'
  summary: string
  buttonLabel: string
  disabledReason?: string
}

function getPlayIntent(state: GameState, instanceId: InstanceId, card: CardDefinition, playerId: string): PlayIntent {
  if (card.type === 'entity') {
    const fortressTargets = getPlayerSuburbCards(state, playerId)
      .filter(id => getFortressOccupants(state, id).length < 3)
    return {
      targetKind: 'friendly_fortress',
      summary: 'Assign this entity to one of your fortresses. Fortress buffs apply while it stays inside.',
      buttonLabel: 'Garrison Entity',
      disabledReason: fortressTargets.length === 0 ? 'Build a fortress with open room before playing an entity.' : undefined,
    }
  }
  if (card.type === 'fortress') {
    return { targetKind: 'none', summary: 'Play this fortress to your suburbs.', buttonLabel: 'Build Fortress' }
  }
  const friendlyEntities = getPlayerInPlayEntities(state, playerId)
  if (card.type === 'item_regular') {
    return {
      targetKind: 'friendly_entity',
      summary: 'Equip this item to one of your entities.',
      buttonLabel: 'Equip Item',
      disabledReason: friendlyEntities.length === 0 ? 'Play an entity before equipping an item.' : undefined,
    }
  }
  const enemyTargets = getEnemyBattleCards(state, playerId)
  const hpBuff = card.hpBuff ?? 0
  if (hpBuff > 0) {
    return {
      targetKind: 'friendly_entity',
      summary: 'Use this consumable to heal a friendly entity.',
      buttonLabel: 'Use Consumable',
      disabledReason: friendlyEntities.length === 0 ? 'No friendly entity can receive this effect.' : undefined,
    }
  }
  if (hpBuff < 0 || hasRollDefeatAutomation(card)) {
    return {
      targetKind: 'enemy',
      summary: 'Use this consumable against an enemy entity or fortress.',
      buttonLabel: 'Use Consumable',
      disabledReason: enemyTargets.length === 0 ? 'No enemy target is currently in play.' : undefined,
    }
  }
  return {
    targetKind: 'none',
    summary: 'This card has text, but no MVP automation yet.',
    buttonLabel: 'Unavailable',
    disabledReason: 'This special effect is visible for reference but is not automated yet.',
  }
}

function targetLabel(kind: PlayIntent['targetKind']): string {
  if (kind === 'friendly_entity') return 'Choose friendly entity'
  if (kind === 'friendly_fortress') return 'Choose fortress'
  if (kind === 'enemy') return 'Choose enemy target'
  return 'No target'
}

function hasRollDefeatAutomation(card: CardDefinition): boolean {
  return /kill|die|destroy|defeat/i.test(card.rulesText) && /roll\s*<=?\s*[1-6]/i.test(card.miscStat ?? card.rulesText)
}

function cardLabel(state: GameState, id: InstanceId): string {
  const card = getDefinition(state, id)
  const instance = state.cardsByInstanceId[id]
  if (!card || !instance) return id
  if (card.type === 'fortress') {
    const occupants = getFortressOccupants(state, id).length
    return `${card.name} (${occupants === 0 ? 'empty fortress' : `${occupants}/3 inside`})`
  }
  if (card.type === 'entity') {
    const containing = getContainingFortressId(state, id)
    if (containing) return `${card.name} (inside ${getDefinition(state, containing)?.name ?? 'fortress'})`
    if (instance.zone.zone === 'battlefield') return `${card.name} (battlefield)`
  }
  return card.name
}

function attackButtonLabel(state: GameState, targetId: InstanceId): string {
  const card = targetId ? getDefinition(state, targetId) : undefined
  if (card?.type === 'fortress' && getFortressOccupants(state, targetId).length === 0) return 'Attack / Capture'
  return 'Attack'
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

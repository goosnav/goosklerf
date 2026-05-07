import React, { useEffect, useMemo, useState } from 'react'
import { createAiController } from '@gk/ai'
import { loadCards } from '@gk/cards'
import {
  getContainingFortressId,
  getAttackValue,
  getDefinition,
  getPlayerBattleCards,
  getPlayerInPlayEntities,
  getPlayerSuburbCards,
  reduceGameAction,
  setupGame,
  type GameState,
  type InstanceId,
} from '@gk/engine'
import type { DeckSize } from '@gk/shared'

type EndedBy = 'running' | 'winner' | 'max_turns' | 'error'

interface SimMeta {
  actionCount: number
  illegalActionCount: number
  endedBy: EndedBy
  error?: string
}

const cards = loadCards()

export default function App() {
  const [playerCount, setPlayerCount] = useState(2)
  const [deckSize, setDeckSize] = useState<DeckSize>('medium')
  const [seed, setSeed] = useState('gui-sim')
  const [maxTurns, setMaxTurns] = useState(240)
  const [state, setState] = useState(() => makeGame(2, 'medium', 'gui-sim'))
  const [meta, setMeta] = useState<SimMeta>({ actionCount: 0, illegalActionCount: 0, endedBy: 'running' })
  const [running, setRunning] = useState(false)
  const latestLog = [...state.log].slice(-14).reverse()
  const liveMetrics = useMemo(() => collectLogMetrics(state), [state])
  const report = useMemo(() => makeReport(state, meta, liveMetrics, playerCount, deckSize, seed, maxTurns), [state, meta, liveMetrics, playerCount, deckSize, seed, maxTurns])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setStep()
    }, 250)
    return () => window.clearInterval(timer)
  }, [running, state, meta, maxTurns])

  function resetGame() {
    setRunning(false)
    setState(makeGame(playerCount, deckSize, seed))
    setMeta({ actionCount: 0, illegalActionCount: 0, endedBy: 'running' })
  }

  function setStep() {
    setState(current => {
      const result = stepSimulation(current, meta, maxTurns)
      setMeta(result.meta)
      if (result.meta.endedBy !== 'running') setRunning(false)
      return result.state
    })
  }

  function runToEnd() {
    setRunning(false)
    let nextState = state
    let nextMeta = meta
    for (let i = 0; i < 5000 && nextMeta.endedBy === 'running'; i++) {
      const result = stepSimulation(nextState, nextMeta, maxTurns)
      nextState = result.state
      nextMeta = result.meta
    }
    setState(nextState)
    setMeta(nextMeta)
  }

  return (
    <div className="sim-app">
      <header className="sim-header">
        <div>
          <h1>Goosklerf AI Simulator</h1>
          <p>Single-game viewer for 2-4 AI players. The headless simulator remains available for batch reports.</p>
        </div>
        <div className={`status-pill ${meta.endedBy}`}>
          {meta.endedBy === 'running' ? state.phase.replace('_', ' ') : meta.endedBy}
        </div>
      </header>

      <main className="sim-layout">
        <aside className="sim-controls">
          <label>
            Players
            <input type="number" min={2} max={4} value={playerCount} onChange={e => setPlayerCount(clamp(Number(e.target.value), 2, 4))} />
          </label>
          <label>
            Deck
            <select value={deckSize} onChange={e => setDeckSize(e.target.value as DeckSize)}>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </label>
          <label>
            Seed
            <input value={seed} onChange={e => setSeed(e.target.value)} />
          </label>
          <label>
            Max turns
            <input type="number" min={20} max={2000} value={maxTurns} onChange={e => setMaxTurns(Math.max(20, Number(e.target.value)))} />
          </label>
          <div className="button-grid">
            <button onClick={resetGame}>New Sim</button>
            <button disabled={meta.endedBy !== 'running'} onClick={setStep}>Step</button>
            <button disabled={meta.endedBy !== 'running'} onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Auto'}</button>
            <button disabled={meta.endedBy !== 'running'} onClick={runToEnd}>Run End</button>
          </div>
          <div className="stat-grid">
            <span>Turn {state.turnNumber}</span>
            <span>Actions {meta.actionCount}</span>
            <span>Illegal {meta.illegalActionCount}</span>
            <span>Winner {winnerLabel(state)}</span>
            <span>Captures {liveMetrics.fortressesCaptured}</span>
            <span>Deaths {liveMetrics.entitiesDefeated}</span>
          </div>
          <div className="button-grid">
            <button onClick={() => download('goosklerf-gui-sim-report.json', JSON.stringify(report, null, 2), 'application/json')}>JSON</button>
            <button onClick={() => download('goosklerf-gui-sim-game.csv', reportToCsv(report), 'text/csv')}>CSV</button>
          </div>
        </aside>

        <section className="sim-board">
          {state.players.map(player => (
            <article key={player.playerId} className={`sim-player ${player.playerId === state.activePlayerId ? 'active' : ''}`}>
              <header>
                <div>
                  <h2>{player.name}{player.eliminated ? ' (out)' : ''}</h2>
                  <span>{player.playerId === state.activePlayerId ? 'active' : 'waiting'}</span>
                </div>
                <div className="mini-stats">
                  <span>Deck {state.zones.decks[player.playerId].instanceIds.length}</span>
                  <span>Hand {state.zones.hands[player.playerId].instanceIds.length}</span>
                  <span>Shop {state.zones.shops[player.playerId].instanceIds.length}</span>
                  <span>Grave {state.zones.graveyards[player.playerId].instanceIds.length}</span>
                </div>
              </header>
              <Zone title="Suburbs" ids={getPlayerSuburbCards(state, player.playerId)} state={state} />
              <Zone title="Battlefield" ids={getPlayerBattleCards(state, player.playerId, 'entity')} state={state} />
            </article>
          ))}
        </section>

        <aside className="sim-log">
          <h2>Simulation Log</h2>
          {latestLog.map(entry => <div key={entry.id} className="log-line">{entry.message}</div>)}
        </aside>
      </main>
    </div>
  )
}

function makeGame(playerCount: number, deckSize: DeckSize, seed: string): GameState {
  return setupGame(cards, {
    seed,
    deckSize,
    allowUnimplementedSpecials: false,
    players: Array.from({ length: playerCount }, (_, index) => ({
      name: `AI Player ${index + 1}`,
      type: 'ai' as const,
      aiPersonalityId: 'butcher',
    })),
  })
}

function stepSimulation(state: GameState, meta: SimMeta, maxTurns: number): { state: GameState; meta: SimMeta } {
  if (meta.endedBy !== 'running') return { state, meta }
  if (state.phase === 'game_over') return { state, meta: { ...meta, endedBy: 'winner' } }
  if (state.turnNumber > maxTurns) return { state, meta: { ...meta, endedBy: 'max_turns' } }
  try {
    const player = state.players.find(p => p.playerId === state.activePlayerId)
    const ai = createAiController(player?.aiPersonalityId)
    const result = reduceGameAction(state, ai.selectAction(state, state.activePlayerId))
    if (result.ok && result.state) {
      return {
        state: result.state,
        meta: {
          ...meta,
          actionCount: meta.actionCount + 1,
          endedBy: result.state.phase === 'game_over' ? 'winner' : 'running',
        },
      }
    }
    const fallback = reduceGameAction(state, { type: 'END_PHASE', playerId: state.activePlayerId })
    if (fallback.ok && fallback.state) {
      return {
        state: fallback.state,
        meta: {
          ...meta,
          actionCount: meta.actionCount + 1,
          illegalActionCount: meta.illegalActionCount + 1,
          endedBy: fallback.state.phase === 'game_over' ? 'winner' : 'running',
        },
      }
    }
    return { state, meta: { ...meta, endedBy: 'error', error: result.error?.message ?? 'Unknown reducer failure' } }
  } catch (e) {
    return { state, meta: { ...meta, endedBy: 'error', error: e instanceof Error ? e.message : String(e) } }
  }
}

function Zone({ title, ids, state }: { title: string; ids: InstanceId[]; state: GameState }) {
  return (
    <div className={`zone ${title.toLowerCase()}`}>
      <strong>{title}</strong>
      <div className="sim-card-grid">
        {ids.map(id => <SimCard key={id} id={id} state={state} />)}
        {ids.length === 0 && <span className="empty">empty</span>}
      </div>
    </div>
  )
}

function SimCard({ id, state }: { id: InstanceId; state: GameState }) {
  const card = getDefinition(state, id)
  const instance = state.cardsByInstanceId[id]
  if (!card || !instance) return null
  const hp = card.type === 'fortress'
    ? `${instance.currentFortressHp ?? card.fortressHp}/${instance.maxFortressHp ?? card.fortressHp}`
    : `${instance.currentHp ?? card.baseHp}/${instance.maxHp ?? card.baseHp}`
  const containingFortressId = card.type === 'entity' ? getContainingFortressId(state, id) : undefined
  const containingFortress = containingFortressId ? getDefinition(state, containingFortressId) : undefined
  const buffLabel = card.type === 'fortress' && ((card.attackBuff ?? 0) || (card.hpBuff ?? 0))
    ? `Buff ${signed(card.attackBuff ?? 0)} ATK ${signed(card.hpBuff ?? 0)} HP`
    : ''
  return (
    <div className="sim-card">
      <img src={`/${card.imagePath}`} alt={card.name} />
      <b>{card.name}</b>
      <span>{card.type === 'entity' ? `ATK ${getAttackValue(state, id)} | HP ${hp}` : `HP ${hp}`}</span>
      {containingFortress && <span>Inside {containingFortress.name}</span>}
      {card.type === 'fortress' && <span>Inside {instance.containedEntityIds.length}/3</span>}
      {buffLabel && <span>{buffLabel}</span>}
      {instance.equippedItemIds.length > 0 && (
        <span>Items: {instance.equippedItemIds.map(itemId => getDefinition(state, itemId)?.name ?? 'item').join(', ')}</span>
      )}
      {card.type === 'fortress' && instance.containedEntityIds.length > 0 && (
        <div className="sim-occupants">
          <span>Inside</span>
          {instance.containedEntityIds.map(entityId => <SimCard key={entityId} id={entityId} state={state} />)}
        </div>
      )}
    </div>
  )
}

function makeReport(state: GameState, meta: SimMeta, metrics: ReturnType<typeof collectLogMetrics>, playerCount: number, deckSize: DeckSize, seed: string, maxTurns: number) {
  return {
    generatedAt: new Date().toISOString(),
    mode: 'gui-single-game',
    seed,
    playerCount,
    deckSize,
    maxTurns,
    gameId: state.gameId,
    phase: state.phase,
    turnNumber: state.turnNumber,
    winner: state.winner,
    gameOverReason: state.gameOverReason,
    metrics,
    ...meta,
    players: state.players.map(player => ({
      playerId: player.playerId,
      name: player.name,
      eliminated: player.eliminated,
      deck: state.zones.decks[player.playerId].instanceIds.length,
      hand: state.zones.hands[player.playerId].instanceIds.length,
      shop: state.zones.shops[player.playerId].instanceIds.length,
      suburbs: state.zones.suburbs[player.playerId].instanceIds.length,
      battlefield: getPlayerBattleCards(state, player.playerId, 'entity').length,
      entitiesInPlay: getPlayerInPlayEntities(state, player.playerId).length,
      graveyard: state.zones.graveyards[player.playerId].instanceIds.length,
    })),
  }
}

function reportToCsv(report: ReturnType<typeof makeReport>): string {
  const header = 'gameId,seed,playerCount,deckSize,winner,endedBy,turnNumber,actionCount,illegalActionCount'
  const row = [
    report.gameId,
    report.seed,
    report.playerCount,
    report.deckSize,
    report.winner ?? '',
    report.endedBy,
    report.turnNumber,
    report.actionCount,
    report.illegalActionCount,
  ]
  return `${header}\n${row.join(',')}\n`
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function winnerLabel(state: GameState): string {
  if (!state.winner) return '-'
  return state.players.find(p => p.playerId === state.winner)?.name ?? state.winner
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}

function collectLogMetrics(state: GameState) {
  const metrics = {
    attacks: 0,
    hits: 0,
    entitiesDefeated: 0,
    fortressesCaptured: 0,
    fortressesDestroyed: 0,
    captureOpportunities: 0,
  }
  for (const entry of state.log) {
    const data = entry.data ?? {}
    if (data['event'] !== 'attack') continue
    metrics.attacks++
    if (data['hit']) metrics.hits++
    if (data['defeated'] && data['targetType'] === 'entity') metrics.entitiesDefeated++
    if (data['captured']) metrics.fortressesCaptured++
    if (data['destroyed']) metrics.fortressesDestroyed++
    if (data['captureOpportunity']) metrics.captureOpportunities++
  }
  return metrics
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

import React, { useState } from 'react'
import type { GameState } from '@gk/engine'
import { setupGame } from '@gk/engine'
import { loadCards } from '@gk/cards'
import { useToast } from '../components/Toast.js'

interface Props {
  onStart: (state: GameState) => void
  onBack: () => void
}

export default function NewGameSetup({ onStart, onBack }: Props) {
  const [playerCount, setPlayerCount] = useState(2)
  const [seed, setSeed] = useState(`seed-${Date.now()}`)
  const [deckSize, setDeckSize] = useState<'small' | 'medium' | 'large'>('medium')
  const toast = useToast()

  function handleStart() {
    try {
      const cards = loadCards()
      const players = Array.from({ length: playerCount }, (_, i) => ({
        name: i === 0 ? 'Human' : `AI Bot ${i}`,
        type: i === 0 ? ('human' as const) : ('ai' as const),
        aiPersonalityId: 'butcher',
      }))
      const state = setupGame(cards, { seed, deckSize, players })
      onStart(state)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="menu-screen">
      <div className="menu-card menu-card-wide">
        <h2 className="menu-title-sm">New Game</h2>

        <div className="menu-form">
          <label className="field-stack">
            <span>Players: {playerCount}</span>
            <input
              type="range" min={2} max={4} value={playerCount}
              onChange={e => setPlayerCount(Number(e.target.value))}
            />
          </label>

          <label className="field-stack">
            <span>Seed</span>
            <input value={seed} onChange={e => setSeed(e.target.value)} />
          </label>

          <label className="field-stack">
            <span>Deck size</span>
            <select value={deckSize} onChange={e => setDeckSize(e.target.value as typeof deckSize)}>
              <option value="small">Small (24 cards · 3 shop)</option>
              <option value="medium">Medium (36 cards · 7 shop)</option>
              <option value="large">Large (54 cards · 7 shop)</option>
            </select>
          </label>

          <p className="muted">
            Player 1 is human. Remaining seats are AI (Butcher personality).
          </p>
        </div>

        <div className="menu-actions">
          <button onClick={onBack}>Back</button>
          <button className="menu-primary" onClick={handleStart}>Start Game</button>
        </div>
      </div>
    </div>
  )
}

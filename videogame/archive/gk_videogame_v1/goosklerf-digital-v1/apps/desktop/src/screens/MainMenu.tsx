import React, { useEffect, useState } from 'react'
import { listSaves, loadGame, deleteSave, type SaveSlot } from '../services/persistence.js'
import type { GameState } from '@gk/engine'

interface Props {
  onNewGame: () => void
  onResume: (state: GameState) => void
}

export default function MainMenu({ onNewGame, onResume }: Props) {
  const [saves, setSaves] = useState<SaveSlot[]>([])
  const [showLoad, setShowLoad] = useState(false)

  useEffect(() => {
    setSaves(listSaves())
  }, [showLoad])

  function handleResume(id: string) {
    const state = loadGame(id)
    if (state) onResume(state)
  }

  function handleDelete(id: string) {
    deleteSave(id)
    setSaves(listSaves())
  }

  return (
    <div className="menu-screen">
      <div className="menu-card">
        <h1 className="menu-title">GOOSKLERF II</h1>
        <p className="menu-subtitle">Digital Edition v0.1</p>

        {!showLoad ? (
          <div className="menu-actions">
            <button className="menu-primary" onClick={onNewGame}>New Game</button>
            <button onClick={() => setShowLoad(true)} disabled={saves.length === 0}>
              {saves.length > 0 ? `Load Game (${saves.length})` : 'Load Game'}
            </button>
          </div>
        ) : (
          <div className="menu-loadlist">
            <h3>Saved games</h3>
            {saves.length === 0 ? (
              <p className="muted">No saved games found.</p>
            ) : (
              <ul>
                {saves.map(slot => (
                  <li key={slot.id}>
                    <div>
                      <strong>{slot.name}</strong>
                      <div className="muted">
                        Turn {slot.turnNumber} · {slot.phase.replace('_', ' ')} · {slot.playerCount} players
                        · {new Date(slot.savedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="menu-row-actions">
                      <button onClick={() => handleResume(slot.id)}>Resume</button>
                      <button onClick={() => handleDelete(slot.id)} className="danger">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="menu-actions">
              <button onClick={() => setShowLoad(false)}>Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

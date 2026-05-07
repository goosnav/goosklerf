import React, { useState } from 'react'
import MainMenu from './screens/MainMenu.js'
import NewGameSetup from './screens/NewGameSetup.js'
import TableScreen from './screens/TableScreen.js'
import { ToastProvider } from './components/Toast.js'
import type { GameState } from '@gk/engine'

type Screen = 'main_menu' | 'new_game_setup' | 'table'

export default function App() {
  const [screen, setScreen] = useState<Screen>('main_menu')
  const [gameState, setGameState] = useState<GameState | null>(null)

  function startGame(state: GameState) {
    setGameState(state)
    setScreen('table')
  }

  function exitToMenu() {
    setScreen('main_menu')
  }

  return (
    <ToastProvider>
      {screen === 'table' && gameState ? (
        <TableScreen
          state={gameState}
          onStateChange={setGameState}
          onExit={exitToMenu}
        />
      ) : screen === 'new_game_setup' ? (
        <NewGameSetup onStart={startGame} onBack={exitToMenu} />
      ) : (
        <MainMenu
          onNewGame={() => setScreen('new_game_setup')}
          onResume={startGame}
        />
      )}
    </ToastProvider>
  )
}

import { Command } from 'commander'
import { runBatch } from './batchRunner.js'
import { writeSummaryJson, writeGamesCsv, writeTextReport } from './reportWriter.js'
import type { DeckSize } from '@gk/shared'

const program = new Command()

program
  .name('gk-sim')
  .description('Goosklerf II Headless Simulator')
  .requiredOption('--games <n>', 'Number of games to simulate', '10')
  .requiredOption('--players <n>', 'Players per game (2-4)', '2')
  .requiredOption('--seed <s>', 'Base RNG seed', 'test-seed')
  .option('--out <dir>', 'Output directory under apps/simulator by default', 'reports/headless-latest')
  .option('--deck-size <s>', 'Deck size: small|medium|large', 'medium')
  .option('--max-turns <n>', 'Stop a game after this many turns if there is no winner', '200')
  .option('--allow-unimplemented-specials', 'Allow all unimplemented special cards in simulator decks')
  .action((opts) => {
    const gameCount   = parseInt(opts.games)
    const playerCount = parseInt(opts.players)
    const deckSize    = opts.deckSize as DeckSize
    const maxTurns    = parseInt(opts.maxTurns)

    if (playerCount < 2 || playerCount > 4) {
      console.error('Player count must be 2-4')
      process.exit(1)
    }

    console.log(`Running ${gameCount} games with ${playerCount} players, seed: ${opts.seed}`)

    const results = runBatch({
      gameCount,
      playerCount,
      baseSeed: opts.seed,
      deckSize,
      maxTurns,
      allowUnimplementedSpecials: Boolean(opts.allowUnimplementedSpecials),
    })

    writeSummaryJson(results, `${opts.out}/summary.json`)
    writeGamesCsv(results, `${opts.out}/games.csv`)
    writeTextReport(results, `${opts.out}/report.txt`)

    console.log(`\nDone. ${results.length} games simulated.`)
    console.log(`Valid cards: ${results[0]?.validCardCount ?? 0}`)
    console.log(`Invalid cards: ${results[0]?.invalidCardCount ?? 0}`)
    console.log(`Winners: ${results.filter(r => r.endedBy === 'winner').length}`)
    console.log(`Max-turn stops: ${results.filter(r => r.endedBy === 'max_turns').length}`)
    console.log(`Errors: ${results.filter(r => r.endedBy === 'error').length}`)
  })

// pnpm injects a bare '--' when forwarding extra args; strip it so Commander sees the flags
const argv = [process.argv[0]!, process.argv[1]!, ...process.argv.slice(2).filter(a => a !== '--')]
program.parse(argv)

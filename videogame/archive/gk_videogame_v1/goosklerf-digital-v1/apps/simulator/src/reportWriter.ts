import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { SimResult } from './batchRunner.js'

export function writeSummaryJson(results: SimResult[], outPath: string): void {
  const summary = {
    generatedAt: new Date().toISOString(),
    totalGames: results.length,
    playerCount: results[0]?.playerCount ?? 0,
    deckSize: results[0]?.deckSize ?? 'unknown',
    validCardCount: results[0]?.validCardCount ?? 0,
    invalidCardCount: results[0]?.invalidCardCount ?? 0,
    games: results.map(r => ({
      gameId: r.gameId,
      seed: r.seed,
      winner: r.winner,
      endedBy: r.endedBy,
      turnNumber: r.turnNumber,
      actionCount: r.actionCount,
      illegalActionCount: r.illegalActionCount,
      unimplementedSpecialCount: r.unimplementedSpecialCount,
      deckSizes: r.deckSizePerPlayer,
      handSizes: r.handSizePerPlayer,
      shopSizes: r.shopSizePerPlayer,
      error: r.error,
      metrics: r.metrics,
    })),
    aggregate: aggregateMetrics(results),
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.log(`Wrote summary to ${outPath}`)
}

export function writeGamesCsv(results: SimResult[], outPath: string): void {
  const header = [
    'gameId',
    'seed',
    'playerCount',
    'deckSize',
    'winner',
    'endedBy',
    'turnNumber',
    'actionCount',
    'illegalActionCount',
    'unimplementedSpecialCount',
    'cardsPlayed',
    'cardsDiscarded',
    'entitiesPlayed',
    'fortressesBuilt',
    'itemsEquipped',
    'consumablesUsed',
    'cardsDrawn',
    'attacks',
    'hits',
    'misses',
    'entitiesDefeated',
    'fortressesDestroyed',
    'fortressesCaptured',
    'fortressAssaults',
    'attacksOnEmptyFortresses',
    'attacksOnOccupiedFortresses',
    'attacksOnFortressDefenders',
    'captureOpportunities',
    'capturesAfterClearingDefenders',
    'entityMoves',
    'victoryType',
    'error',
  ].join(',')
  const rows = results.map(r =>
    [
      r.gameId, r.seed, r.playerCount, r.deckSize,
      r.winner ?? '',
      r.endedBy,
      r.turnNumber,
      r.actionCount,
      r.illegalActionCount,
      r.unimplementedSpecialCount,
      r.metrics.cardsPlayed,
      r.metrics.cardsDiscarded,
      r.metrics.entitiesPlayed,
      r.metrics.fortressesBuilt,
      r.metrics.itemsEquipped,
      r.metrics.consumablesUsed,
      r.metrics.cardsDrawn,
      r.metrics.attacks,
      r.metrics.hits,
      r.metrics.misses,
      r.metrics.entitiesDefeated,
      r.metrics.fortressesDestroyed,
      r.metrics.fortressesCaptured,
      r.metrics.fortressAssaults,
      r.metrics.attacksOnEmptyFortresses,
      r.metrics.attacksOnOccupiedFortresses,
      r.metrics.attacksOnFortressDefenders,
      r.metrics.captureOpportunities,
      r.metrics.capturesAfterClearingDefenders,
      r.metrics.entityMoves,
      r.metrics.victoryType,
      r.error ? JSON.stringify(r.error) : '',
    ].join(',')
  )
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, [header, ...rows].join('\n'))
  console.log(`Wrote games CSV to ${outPath}`)
}

export function writeTextReport(results: SimResult[], outPath: string): void {
  const aggregate = aggregateMetrics(results)
  const lines = [
    'GOOSKLERF II HEADLESS SIMULATION REPORT',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Games: ${results.length}`,
    `Players: ${results[0]?.playerCount ?? 0}`,
    `Deck size: ${results[0]?.deckSize ?? 'unknown'}`,
    '',
    'Outcomes',
    `- Winners: ${results.filter(r => r.endedBy === 'winner').length}`,
    `- Max-turn stops: ${results.filter(r => r.endedBy === 'max_turns').length}`,
    `- Errors: ${results.filter(r => r.endedBy === 'error').length}`,
    '',
    'Victory Types',
    ...formatCounts(countBy(results.map(r => r.metrics.victoryType))),
    '',
    'Fortress Capture Diagnostics',
    `- Fortress assaults: avg ${aggregate.fortressAssaults.avg.toFixed(2)}, low ${aggregate.fortressAssaults.min}, high ${aggregate.fortressAssaults.max}`,
    `- Capture opportunities: avg ${aggregate.captureOpportunities.avg.toFixed(2)}, low ${aggregate.captureOpportunities.min}, high ${aggregate.captureOpportunities.max}`,
    `- Captures: avg ${aggregate.fortressesCaptured.avg.toFixed(2)}, low ${aggregate.fortressesCaptured.min}, high ${aggregate.fortressesCaptured.max}`,
    `- Captures after clearing last defender: avg ${aggregate.capturesAfterClearingDefenders.avg.toFixed(2)}, low ${aggregate.capturesAfterClearingDefenders.min}, high ${aggregate.capturesAfterClearingDefenders.max}`,
    `- Capture success rate: ${formatRate(sum(results.map(r => r.metrics.fortressesCaptured)), sum(results.map(r => r.metrics.captureOpportunities)))}`,
    `- Target mix: empty fortress attacks ${sum(results.map(r => r.metrics.attacksOnEmptyFortresses))}, occupied fortress attacks ${sum(results.map(r => r.metrics.attacksOnOccupiedFortresses))}, defender attacks ${sum(results.map(r => r.metrics.attacksOnFortressDefenders))}`,
    '',
    'Per-Game Metrics (average, low, high)',
    ...Object.entries(aggregate).map(([key, value]) =>
      `- ${key}: avg ${value.avg.toFixed(2)}, low ${value.min}, high ${value.max}`
    ),
    '',
    'Game Summaries',
    ...results.slice(0, 50).map(r =>
      `- ${r.seed}: ${r.endedBy}, turns ${r.turnNumber}, attacks ${r.metrics.attacks}, ` +
      `entities defeated ${r.metrics.entitiesDefeated}, fortresses captured ${r.metrics.fortressesCaptured}, ` +
      `capture opportunities ${r.metrics.captureOpportunities}, cards played ${r.metrics.cardsPlayed}, discarded ${r.metrics.cardsDiscarded}`
    ),
  ]
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, lines.join('\n'))
  console.log(`Wrote text report to ${outPath}`)
}

function aggregateMetrics(results: SimResult[]) {
  const keys = [
    'turns',
    'cardsPlayed',
    'cardsDiscarded',
    'entitiesPlayed',
    'fortressesBuilt',
    'itemsEquipped',
    'consumablesUsed',
    'cardsDrawn',
    'attacks',
    'hits',
    'misses',
    'entitiesDefeated',
    'fortressesDestroyed',
    'fortressesCaptured',
    'fortressAssaults',
    'attacksOnEmptyFortresses',
    'attacksOnOccupiedFortresses',
    'attacksOnFortressDefenders',
    'captureOpportunities',
    'capturesAfterClearingDefenders',
    'entityMoves',
  ] as const
  return Object.fromEntries(keys.map(key => {
    const values = results.map(result => result.metrics[key])
    return [key, summarize(values)]
  }))
}

function summarize(values: number[]) {
  if (values.length === 0) return { avg: 0, min: 0, max: 0 }
  return {
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return 'n/a'
  return `${((numerator / denominator) * 100).toFixed(1)}% (${numerator}/${denominator})`
}

function formatCounts(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts)
  if (entries.length === 0) return ['- none']
  return entries.map(([key, value]) => `- ${key}: ${value}`)
}

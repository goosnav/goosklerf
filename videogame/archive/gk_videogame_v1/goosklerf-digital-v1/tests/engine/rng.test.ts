import { describe, it, expect } from 'vitest'
import { SeededRng } from '../../packages/engine/src/rng/rng.js'

describe('SeededRng', () => {
  it('same seed produces same sequence', () => {
    const a = new SeededRng('test-seed-1')
    const b = new SeededRng('test-seed-1')
    const seqA = Array.from({ length: 20 }, () => a.nextFloat())
    const seqB = Array.from({ length: 20 }, () => b.nextFloat())
    expect(seqA).toEqual(seqB)
  })

  it('different seed produces different sequence', () => {
    const a = new SeededRng('seed-aaa')
    const b = new SeededRng('seed-bbb')
    const seqA = Array.from({ length: 10 }, () => a.nextFloat())
    const seqB = Array.from({ length: 10 }, () => b.nextFloat())
    expect(seqA).not.toEqual(seqB)
  })

  it('nextInt returns integer in [min, max)', () => {
    const rng = new SeededRng('range-test')
    for (let i = 0; i < 100; i++) {
      const n = rng.nextInt(1, 7)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThan(7)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('shuffle produces same order for same seed', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const a = new SeededRng('shuffle-seed')
    const b = new SeededRng('shuffle-seed')
    expect(a.shuffle([...arr])).toEqual(b.shuffle([...arr]))
  })

  it('shuffle does not mutate original array', () => {
    const original = [1, 2, 3, 4, 5]
    const rng = new SeededRng('mutate-test')
    rng.shuffle(original)
    expect(original).toEqual([1, 2, 3, 4, 5])
  })

  it('getState / restoreState reproduces sequence', () => {
    const rng = new SeededRng('state-test')
    rng.nextFloat(); rng.nextFloat()
    const state = rng.getState()
    const nextValues = Array.from({ length: 5 }, () => rng.nextFloat())
    const rng2 = new SeededRng('state-test')
    rng2.restoreState(state)
    const reproduced = Array.from({ length: 5 }, () => rng2.nextFloat())
    expect(reproduced).toEqual(nextValues)
  })
})

import seedrandom from 'seedrandom'

export interface RngState {
  seed: string
  callCount: number
}

export class SeededRng {
  private seed: string
  private callCount: number
  private rng: () => number

  constructor(seed: string) {
    this.seed = seed
    this.callCount = 0
    this.rng = seedrandom(seed)
  }

  nextFloat(): number {
    this.callCount++
    return this.rng()
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min)) + min
  }

  rollD6(): number {
    return this.nextInt(1, 7)
  }

  shuffle<T>(array: T[]): T[] {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  getState(): RngState {
    return { seed: this.seed, callCount: this.callCount }
  }

  restoreState(state: RngState): void {
    this.seed = state.seed
    this.callCount = 0
    this.rng = seedrandom(state.seed)
    for (let i = 0; i < state.callCount; i++) this.rng()
    this.callCount = state.callCount
  }
}

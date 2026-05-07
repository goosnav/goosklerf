export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function generateCardId(name: string): string {
  return `card_${slugify(name)}`
}

export function generateInstanceId(definitionId: string, index: number): string {
  return `${definitionId}_inst_${index}`
}

function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (((hash << 5) + hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36).padStart(8, '0')
}

export function generateGameId(seed: string, timestamp: number): string {
  return `game_${djb2(seed)}_${djb2(String(timestamp))}`
}

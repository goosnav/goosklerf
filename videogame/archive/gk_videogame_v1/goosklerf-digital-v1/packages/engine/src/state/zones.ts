export type ZoneName =
  | 'hand'
  | 'deck'
  | 'graveyard'
  | 'battlefield'
  | 'shop'
  | 'suburbs'

export interface ZoneRef {
  zone: ZoneName
  playerId: string
}

export interface ZoneState {
  instanceIds: string[]
}

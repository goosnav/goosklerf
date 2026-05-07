export interface AiPersonality {
  id: string
  displayName: string
  description: string
  aggressionBias: number
  fortressBias: number
  itemUsageBias: number
}

export const PERSONALITIES: Record<string, AiPersonality> = {
  butcher: {
    id: 'butcher',
    displayName: 'The Butcher',
    description: 'Attacks relentlessly, maximizes entity kills',
    aggressionBias: 0.95,
    fortressBias: 0.2,
    itemUsageBias: 0.7,
  },
  landlord: {
    id: 'landlord',
    displayName: 'The Landlord',
    description: 'Prioritizes fortress control and the Landlord win condition',
    aggressionBias: 0.4,
    fortressBias: 0.95,
    itemUsageBias: 0.5,
  },
  goblin: {
    id: 'goblin',
    displayName: 'The Goblin',
    description: 'Chaotic and unpredictable, high variance plays',
    aggressionBias: 0.6,
    fortressBias: 0.4,
    itemUsageBias: 0.9,
  },
  accountant: {
    id: 'accountant',
    displayName: 'The Accountant',
    description: 'Methodical and resource-efficient, plays conservatively',
    aggressionBias: 0.2,
    fortressBias: 0.6,
    itemUsageBias: 0.3,
  },
}

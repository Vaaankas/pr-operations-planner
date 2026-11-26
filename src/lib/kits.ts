export interface SpecialistKit {
  id: string
  name: string
  short: string
  limits: [number, number, number, number, number]
}

export const SPECIALIST_KITS: SpecialistKit[] = [
  { id: 'mg', name: 'Machine Gunner', short: 'MG', limits: [1, 2, 3, 3, 4] },
  { id: 'marksman', name: 'Marksman', short: 'MARK', limits: [1, 2, 3, 3, 4] },
  { id: 'ap', name: 'Anti-Personnel Rifleman', short: 'AP', limits: [1, 2, 3, 3, 4] },
  { id: 'spotter', name: 'Spotter', short: 'SPOT', limits: [0, 1, 1, 2, 2] },
  { id: 'engineer', name: 'Combat Engineer', short: 'ENG', limits: [0, 1, 1, 2, 2] },
  { id: 'aa', name: 'Anti-Air Rifleman', short: 'AA', limits: [0, 1, 1, 2, 2] },
  { id: 'sniper', name: 'Sniper', short: 'SNIP', limits: [0, 1, 1, 2, 2] },
  { id: 'hat', name: 'Heavy Anti-Tank', short: 'HAT', limits: [0, 1, 1, 1, 1] },
]

export function specialistKit(id: string | undefined): SpecialistKit | undefined {
  return SPECIALIST_KITS.find((kit) => kit.id === id)
}

export function specialistLimit(kit: SpecialistKit, players: number): number {
  if (players <= 7) return kit.limits[0]
  if (players <= 15) return kit.limits[1]
  if (players <= 23) return kit.limits[2]
  if (players <= 31) return kit.limits[3]
  return kit.limits[4]
}

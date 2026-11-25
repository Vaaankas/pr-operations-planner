import type { ControlPoint, LayerData, Plan } from '../types'

export function captureTeam(plan: Plan, cp: ControlPoint): number {
  return plan.flagTeams?.[String(cp.id)] ?? cp.team
}

export function cycleTeam(team: number): number {
  return team === 1 ? 2 : team === 2 ? 0 : 1
}

export function teamName(layer: LayerData, team: number): string {
  const faction = team ? layer.factions[String(team)] : null
  return faction?.name ?? 'Neutral'
}

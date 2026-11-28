import type { LayerData, MapMeta, Member, Plan, Squad, VehicleSpawn } from '../types'
import { assignedKits, SPECIALIST_KITS, specialistKit, specialistLimit } from './kits'
import { isHiddenVehicle, isVehicleInBounds, playerCount } from './utils'
import { layerDisplayName } from './layerLabels'

export interface RosterViewMember {
  id: string
  name: string
  role?: 'SL' | '2IC'
  kit?: string
  kitName?: string
  state: 'confirmed' | 'uncertain' | 'unknown'
}

export interface RosterViewVehicle {
  id: string
  label: string
  crew: string[]
}

export interface RosterViewSquad {
  id: string
  number: number
  name: string
  type: string
  color: string
  kits: string[]
  members: RosterViewMember[]
  hiddenMembers: number
  vehicles: RosterViewVehicle[]
}

export interface RosterViewKit {
  id: string
  name: string
  short: string
  count: number
  limit: number
}

export interface RosterView {
  meta: string
  commander: RosterViewMember | null
  squads: RosterViewSquad[]
  extraSquads: number
  kits: RosterViewKit[]
  reserves: RosterViewMember[]
  total: number
  confirmed: number
  uncertain: number
}

function memberView(
  member: Member,
  assignments: Record<string, string[]> | undefined,
  role?: 'SL' | '2IC',
): RosterViewMember {
  const kitId = assignedKits(assignments, member.id)[0]
  const kit = specialistKit(kitId)
  return {
    id: member.id,
    name: member.name,
    role,
    kit: kit?.short,
    kitName: kit?.name,
    state: member.unconfirmed ? 'uncertain' : member.confirmed ? 'confirmed' : 'unknown',
  }
}

function crewNames(vehicle: VehicleSpawn, squad: Squad, plan: Plan): string[] {
  const crew = plan.vehicleCrew?.[vehicle.id] ?? []
  return crew
    .map((id) => squad.members.find((member) => member.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

export function buildRosterView(plan: Plan, map: MapMeta, layer: LayerData): RosterView {
  const assignments = plan.roster.specialistAssignments
  const side = layer.factions[String(plan.side)]
  const allMembers = [
    ...(plan.roster.commander ? [plan.roster.commander] : []),
    ...plan.roster.squads.flatMap((squad) => squad.members),
    ...plan.roster.unassigned,
  ]
  const counts = SPECIALIST_KITS.reduce<Record<string, number>>((acc, kit) => {
    acc[kit.id] = 0
    return acc
  }, {})
  Object.values(assignments ?? {}).forEach((value) => {
    const kitIds = Array.isArray(value) ? value : [value as unknown as string]
    kitIds.forEach((kitId) => {
      if (counts[kitId] !== undefined) counts[kitId] += 1
    })
  })
  const players = playerCount(plan)
  const squads = plan.roster.squads.slice(0, 9).map((squad, index): RosterViewSquad => {
    const vehicles = layer.vehicles
      .filter((vehicle) =>
        plan.claims[vehicle.id] === squad.id
        && !isHiddenVehicle(vehicle.template)
        && isVehicleInBounds(vehicle, layer.world),
      )
      .map((vehicle) => ({
        id: vehicle.id,
        label: vehicle.label,
        crew: crewNames(vehicle, squad, plan),
      }))
    return {
      id: squad.id,
      number: index + 1,
      name: squad.name.toUpperCase(),
      type: squad.type || 'INF',
      color: squad.color,
      kits: assignedKits(assignments, squad.id)
        .map((kitId) => specialistKit(kitId)?.short)
        .filter((kit): kit is string => Boolean(kit)),
      members: squad.members.slice(0, 8).map((member, memberIndex) =>
        memberView(member, assignments, memberIndex === 0 ? 'SL' : memberIndex === 1 ? '2IC' : undefined),
      ),
      hiddenMembers: Math.max(0, squad.members.length - 8),
      vehicles,
    }
  })
  return {
    meta: `${map.name} · ${layerDisplayName(layer)} · ${side?.name ?? `Team ${plan.side}`}`,
    commander: plan.roster.commander ? memberView(plan.roster.commander, assignments) : null,
    squads,
    extraSquads: Math.max(0, plan.roster.squads.length - 9),
    kits: SPECIALIST_KITS.map((kit) => ({
      id: kit.id,
      name: kit.name,
      short: kit.short,
      count: counts[kit.id] ?? 0,
      limit: specialistLimit(kit, players),
    })),
    reserves: plan.roster.unassigned.map((member) => memberView(member, assignments)),
    total: players,
    confirmed: allMembers.filter((member) => member.confirmed).length,
    uncertain: allMembers.filter((member) => member.unconfirmed).length,
  }
}

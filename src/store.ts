import { create } from 'zustand'
import type { DrawElement, LayerData, MapMeta, Member, Plan, Roster, Squad, Stage, Team, UIState, VehicleMove } from './types'
import { clamp, defaultRoster, newSquad, newStage, PLAYER_CAP, SQUAD_SIZE, uid } from './lib/utils'

const HISTORY_LIMIT = 80
const STORAGE_KEY = 'prplanner.plan.v1'

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function makePlan(meta: MapMeta, layer: LayerData, side: Team, operation?: string): Plan {
  const stage = newStage(0, 0)
  return {
    version: 1,
    id: uid('plan'),
    operation: operation || `${meta.name} — ${layer.name}`,
    mapId: meta.id,
    layerId: layer.id,
    side,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    roster: defaultRoster(),
    stages: [stage],
    activeStageId: stage.id,
    claims: {},
    notes: '',
  }
}

export function loadStoredPlan(): Plan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const plan = JSON.parse(raw) as Plan
    if (plan?.version !== 1 || !plan.mapId || !Array.isArray(plan.stages) || plan.stages.length === 0) return null
    return plan
  } catch {
    return null
  }
}

export function storePlan(plan: Plan | null): void {
  try {
    if (!plan) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  } catch {
    // storage full or unavailable; the in-memory plan is still intact
  }
}

interface PlannerStore {
  plan: Plan | null
  past: Plan[]
  future: Plan[]
  setPlan: (plan: Plan | null) => void
  mutate: (fn: (plan: Plan) => void) => void
  checkpoint: () => void
  undo: () => void
  redo: () => void
  setMeta: (patch: Partial<Pick<Plan, 'operation' | 'notes' | 'side'>>) => void
  addElement: (element: DrawElement) => void
  updateElement: (id: string, patch: Partial<DrawElement>) => void
  removeElement: (id: string) => void
  moveVehicle: (vehicleId: string, move: VehicleMove) => void
  clearVehicleMove: (vehicleId: string) => void
  addStage: () => void
  updateStage: (id: string, patch: Partial<Stage>) => void
  removeStage: (id: string) => void
  setActiveStage: (id: string) => void
  addMember: (target: string, name: string, kit?: string) => boolean
  renameMember: (memberId: string, name: string) => void
  moveMember: (memberId: string, target: string, index?: number) => void
  removeMember: (memberId: string) => void
  setCommander: (memberId: string) => void
  addSquad: () => void
  updateSquad: (squadId: string, patch: Partial<Omit<Squad, 'members'>>) => void
  removeSquad: (squadId: string) => void
  claimVehicle: (vehicleId: string, squadId: string | null) => void
  setRoster: (roster: Roster) => void
  resetAll: () => void
}

function findMember(roster: Roster, memberId: string): Member | null {
  if (roster.commander?.id === memberId) return roster.commander
  for (const squad of roster.squads) {
    const hit = squad.members.find((m) => m.id === memberId)
    if (hit) return hit
  }
  return roster.unassigned.find((m) => m.id === memberId) ?? null
}

function extractMember(roster: Roster, memberId: string): Member | null {
  if (roster.commander?.id === memberId) {
    const m = roster.commander
    roster.commander = null
    return m
  }
  for (const squad of roster.squads) {
    const idx = squad.members.findIndex((m) => m.id === memberId)
    if (idx >= 0) return squad.members.splice(idx, 1)[0]
  }
  const idx = roster.unassigned.findIndex((m) => m.id === memberId)
  if (idx >= 0) return roster.unassigned.splice(idx, 1)[0]
  return null
}

function totalMembers(roster: Roster): number {
  return (
    (roster.commander ? 1 : 0) +
    roster.squads.reduce((n, s) => n + s.members.length, 0) +
    roster.unassigned.length
  )
}

export const usePlanner = create<PlannerStore>((set, get) => ({
  plan: null,
  past: [],
  future: [],

  setPlan: (plan) => set({ plan, past: [], future: [] }),

  mutate: (fn) => {
    const { plan, past } = get()
    if (!plan) return
    const before = clone(plan)
    const next = clone(plan)
    fn(next)
    next.updatedAt = new Date().toISOString()
    set({ plan: next, past: [...past.slice(-HISTORY_LIMIT + 1), before], future: [] })
  },

  checkpoint: () => {
    const { plan, past } = get()
    if (!plan) return
    set({ past: [...past.slice(-HISTORY_LIMIT + 1), clone(plan)], future: [] })
  },

  undo: () => {
    const { plan, past, future } = get()
    if (!plan || past.length === 0) return
    const prev = past[past.length - 1]
    set({ plan: prev, past: past.slice(0, -1), future: [clone(plan), ...future] })
  },

  redo: () => {
    const { plan, past, future } = get()
    if (!plan || future.length === 0) return
    const next = future[0]
    set({ plan: next, past: [...past, clone(plan)], future: future.slice(1) })
  },

  setMeta: (patch) => get().mutate((plan) => Object.assign(plan, patch)),

  addElement: (element) =>
    get().mutate((plan) => {
      const stage = plan.stages.find((s) => s.id === plan.activeStageId) ?? plan.stages[0]
      if (stage) stage.elements.push(element)
    }),

  updateElement: (id, patch) =>
    get().mutate((plan) => {
      for (const stage of plan.stages) {
        const el = stage.elements.find((e) => e.id === id)
        if (el) {
          Object.assign(el, patch)
          return
        }
      }
    }),

  removeElement: (id) =>
    get().mutate((plan) => {
      for (const stage of plan.stages) {
        const idx = stage.elements.findIndex((e) => e.id === id)
        if (idx >= 0) {
          stage.elements.splice(idx, 1)
          return
        }
      }
    }),

  moveVehicle: (vehicleId, move) => {
    const { plan } = get()
    if (!plan) return
    const stage = plan.stages.find((s) => s.id === plan.activeStageId)
    if (!stage) return
    set({
      plan: {
        ...plan,
        updatedAt: new Date().toISOString(),
        stages: plan.stages.map((s) =>
          s.id === stage.id ? { ...s, moves: { ...s.moves, [vehicleId]: move } } : s,
        ),
      },
    })
  },

  clearVehicleMove: (vehicleId) =>
    get().mutate((plan) => {
      const stage = plan.stages.find((s) => s.id === plan.activeStageId)
      if (stage) delete stage.moves[vehicleId]
    }),

  addStage: () => {
    const { plan } = get()
    if (!plan) return
    const maxTime = plan.stages.reduce((n, s) => Math.max(n, s.time), 0)
    const stage = newStage(plan.stages.length, maxTime + 300)
    get().mutate((draft) => {
      draft.stages.push(stage)
      draft.activeStageId = stage.id
    })
    useUI.getState().setSelected(null, null)
  },

  updateStage: (id, patch) =>
    get().mutate((plan) => {
      const stage = plan.stages.find((s) => s.id === id)
      if (stage) Object.assign(stage, patch)
    }),

  removeStage: (id) => {
    const { plan } = get()
    if (!plan || plan.stages.length <= 1) return
    get().mutate((draft) => {
      draft.stages = draft.stages.filter((s) => s.id !== id)
      if (draft.activeStageId === id) draft.activeStageId = draft.stages[0].id
    })
  },

  setActiveStage: (id) => {
    const { plan } = get()
    if (!plan || !plan.stages.some((s) => s.id === id)) return
    set({ plan: { ...plan, activeStageId: id } })
  },

  addMember: (target, name, kit) => {
    const { plan } = get()
    if (!plan) return false
    const roster = plan.roster
    if (totalMembers(roster) >= PLAYER_CAP) return false
    const member: Member = { id: uid('m'), name: name.trim(), kit }
    if (!member.name) return false
    if (target === 'commander') {
      if (roster.commander) return false
    } else if (target === 'unassigned') {
      // allowed
    } else {
      const squad = roster.squads.find((s) => s.id === target)
      if (!squad || squad.members.length >= SQUAD_SIZE) return false
    }
    get().mutate((draft) => {
      if (target === 'commander') draft.roster.commander = member
      else if (target === 'unassigned') draft.roster.unassigned.push(member)
      else draft.roster.squads.find((s) => s.id === target)?.members.push(member)
    })
    return true
  },

  renameMember: (memberId, name) =>
    get().mutate((plan) => {
      const m = findMember(plan.roster, memberId)
      if (m) m.name = name
    }),

  moveMember: (memberId, target, index) =>
    get().mutate((plan) => {
      const member = extractMember(plan.roster, memberId)
      if (!member) return
      if (target === 'commander') {
        if (plan.roster.commander) {
          plan.roster.unassigned.push(plan.roster.commander)
        }
        plan.roster.commander = member
      } else if (target === 'unassigned') {
        plan.roster.unassigned.splice(index ?? plan.roster.unassigned.length, 0, member)
      } else {
        const squad = plan.roster.squads.find((s) => s.id === target)
        if (!squad || squad.members.length >= SQUAD_SIZE) {
          plan.roster.unassigned.push(member)
          return
        }
        squad.members.splice(index ?? squad.members.length, 0, member)
      }
    }),

  removeMember: (memberId) =>
    get().mutate((plan) => {
      extractMember(plan.roster, memberId)
    }),

  setCommander: (memberId) => get().moveMember(memberId, 'commander'),

  addSquad: () => {
    const { plan } = get()
    if (!plan || plan.roster.squads.length >= 9) return
    get().mutate((draft) => {
      draft.roster.squads.push(newSquad(draft.roster.squads.length))
    })
  },

  updateSquad: (squadId, patch) =>
    get().mutate((plan) => {
      const squad = plan.roster.squads.find((s) => s.id === squadId)
      if (squad) Object.assign(squad, patch)
    }),

  removeSquad: (squadId) =>
    get().mutate((plan) => {
      const squad = plan.roster.squads.find((s) => s.id === squadId)
      if (!squad) return
      plan.roster.unassigned.push(...squad.members)
      plan.roster.squads = plan.roster.squads.filter((s) => s.id !== squadId)
      for (const [vehicleId, owner] of Object.entries(plan.claims)) {
        if (owner === squadId) delete plan.claims[vehicleId]
      }
    }),

  claimVehicle: (vehicleId, squadId) =>
    get().mutate((plan) => {
      if (squadId) plan.claims[vehicleId] = squadId
      else delete plan.claims[vehicleId]
    }),

  setRoster: (roster) => get().mutate((plan) => { plan.roster = roster }),

  resetAll: () => {
    storePlan(null)
    set({ plan: null, past: [], future: [] })
  },
}))

export const useUI = create<UIState & {
  setTool: (tool: UIState['tool']) => void
  setColor: (color: string) => void
  setWidth: (width: number) => void
  setOpacity: (opacity: number) => void
  setDash: (dash: boolean) => void
  setArrowBoth: (value: boolean) => void
  setFillShapes: (value: boolean) => void
  setMarker: (icon: string) => void
  setUnit: (unit: string) => void
  setAffiliation: (a: UIState['unitAffiliation']) => void
  setSelected: (id: string | null, kind: UIState['selectedKind']) => void
  setRightTab: (tab: UIState['rightTab']) => void
  toggle: (key: 'showVehicles' | 'showEnemy' | 'showFlags' | 'showAssets' | 'showLabels') => void
  setExportOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setLayerPickerOpen: (open: boolean) => void
}>((set) => ({
  tool: 'select',
  color: '#f8fafc',
  width: 4,
  opacity: 1,
  dash: false,
  arrowBoth: false,
  fillShapes: false,
  markerIcon: 'objective',
  unitKind: 'inf',
  unitAffiliation: 'hostile',
  selectedId: null,
  selectedKind: null,
  rightTab: 'roster',
  showVehicles: true,
  showEnemy: true,
  showFlags: true,
  showAssets: false,
  showLabels: true,
  exportOpen: false,
  helpOpen: false,
  layerPickerOpen: false,

  setTool: (tool) => set({ tool, selectedId: null, selectedKind: null }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width: clamp(width, 1, 24) }),
  setOpacity: (opacity) => set({ opacity: clamp(opacity, 0.1, 1) }),
  setDash: (dash) => set({ dash }),
  setArrowBoth: (arrowBoth) => set({ arrowBoth }),
  setFillShapes: (fillShapes) => set({ fillShapes }),
  setMarker: (markerIcon) => set({ markerIcon }),
  setUnit: (unitKind) => set({ unitKind }),
  setAffiliation: (unitAffiliation) => set({ unitAffiliation }),
  setSelected: (selectedId, selectedKind) => set({ selectedId, selectedKind }),
  setRightTab: (rightTab) => set({ rightTab }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<UIState>),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setLayerPickerOpen: (layerPickerOpen) => set({ layerPickerOpen }),
}))

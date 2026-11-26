import { create } from 'zustand'
import type { DrawElement, LayerData, MapMeta, Member, Plan, Roster, Squad, Stage, Team, UIState, VehicleMove, VehicleTurn } from './types'
import { clamp, defaultRoster, newSquad, newStage, PHONETIC, PLAYER_CAP, SQUAD_SIZE, SQUAD_TYPES, uid } from './lib/utils'

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
    operation: operation || `Operation ${meta.name}`,
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
    plan.roster.squads.forEach((squad, index) => {
      if (/^\d+$/.test(squad.name) || SQUAD_TYPES.includes(squad.name)) {
        squad.name = PHONETIC[index] ?? squad.name
      }
    })
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
  setVehicleTurns: (vehicleId: string, turns: VehicleTurn[]) => void
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
  reorderSquads: (fromId: string, toId: string) => void
  cycleConfirmation: (memberId: string) => void
  claimVehicle: (vehicleId: string, squadId: string | null) => void
  cycleFlagTeam: (cpId: number, current: number) => void
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

  setVehicleTurns: (vehicleId, turns) => {
    const { plan } = get()
    if (!plan) return
    const stage = plan.stages.find((s) => s.id === plan.activeStageId)
    if (!stage) return
    set({
      plan: {
        ...plan,
        updatedAt: new Date().toISOString(),
        stages: plan.stages.map((s) =>
          s.id === stage.id ? { ...s, turns: { ...(s.turns ?? {}), [vehicleId]: turns } } : s,
        ),
      },
    })
  },

  clearVehicleMove: (vehicleId) =>
    get().mutate((plan) => {
      const stage = plan.stages.find((s) => s.id === plan.activeStageId)
      if (stage) {
        delete stage.moves[vehicleId]
        if (stage.turns) delete stage.turns[vehicleId]
      }
    }),

  addStage: () => {
    const { plan } = get()
    if (!plan) return
    const maxTime = plan.stages.reduce((n, s) => Math.max(n, s.time), 0)
    const previous = [...plan.stages].sort((a, b) => a.time - b.time)[plan.stages.length - 1]
    const stage = newStage(plan.stages.length, maxTime + 300)
    if (previous) {
      stage.elements = clone(previous.elements).map((el) => ({ ...el, id: uid('el') }))
      stage.moves = clone(previous.moves)
      stage.turns = {}
    }
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
    const member: Member = { id: uid('m'), name: name.trim(), kit }
    if (!member.name) return false
    if (target === 'commander') {
      if (roster.commander) return false
    } else if (target === 'unassigned') {
      // allowed
    } else {
      const squad = roster.squads.find((s) => s.id === target)
      if (!squad) return false
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
        if (!squad) {
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
    if (!plan || plan.roster.squads.length >= 10) return
    get().mutate((draft) => {
      draft.roster.squads.push(newSquad(draft.roster.squads.length))
    })
  },

  reorderSquads: (fromId, toId) =>
    get().mutate((plan) => {
      const from = plan.roster.squads.findIndex((s) => s.id === fromId)
      const to = plan.roster.squads.findIndex((s) => s.id === toId)
      if (from < 0 || to < 0 || from === to) return
      const [squad] = plan.roster.squads.splice(from, 1)
      plan.roster.squads.splice(to, 0, squad)
    }),

  cycleConfirmation: (memberId) =>
    get().mutate((plan) => {
      const member = findMember(plan.roster, memberId)
      if (!member) return
      if (!member.unconfirmed && !member.confirmed) {
        member.confirmed = true
      } else if (member.confirmed) {
        member.confirmed = false
        member.unconfirmed = true
      } else {
        member.unconfirmed = false
      }
    }),

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

  cycleFlagTeam: (cpId, current) =>
    get().mutate((plan) => {
      const key = String(cpId)
      plan.flagNext = { ...(plan.flagNext ?? {}) }
      plan.flagTeams = { ...(plan.flagTeams ?? {}) }
      if (current === 1 || current === 2) {
        plan.flagTeams[key] = 0
        plan.flagNext[key] = current === 1 ? 2 : 1
      } else {
        const next = plan.flagNext[key] ?? 1
        plan.flagTeams[key] = next
        plan.flagNext[key] = next === 1 ? 2 : 1
      }
    }),

  setRoster: (roster) => get().mutate((plan) => { plan.roster = roster }),

  resetAll: () => {
    storePlan(null)
    set({ plan: null, past: [], future: [] })
  },
}))

export const useUI = create<UIState & {
  setView: (view: UIState['view']) => void
  setTool: (tool: UIState['tool']) => void
  setColor: (color: string) => void
  setWidth: (width: number) => void
  setOpacity: (opacity: number) => void
  setFillOpacity: (opacity: number) => void
  setDash: (dash: boolean) => void
  setArrowBoth: (value: boolean) => void
  setFillShapes: (value: boolean) => void
  setVisibleRoutes: (ids: string[]) => void
  toggleRoute: (id: string) => void
  toggleCp: (id: number) => void
  setAllRoutes: (ids: string[], visible: boolean) => void
  setMarker: (icon: string) => void
  setUnit: (unit: string) => void
  setAffiliation: (a: UIState['unitAffiliation']) => void
  setSelected: (id: string | null, kind: UIState['selectedKind']) => void
  setRightTab: (tab: UIState['rightTab']) => void
  toggle: (key: 'showVehicles' | 'showEnemy' | 'showFlags' | 'showAssets' | 'showLabels' | 'showVehiclePaths') => void
  toggleVehiclePath: (vehicleId: string) => void
  setExportOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setLayerPickerOpen: (open: boolean) => void
}>((set) => ({
  view: 'plan',
  tool: 'select',
  color: '#e2e8f0',
  width: 4,
  opacity: 1,
  fillOpacity: 0.18,
  dash: false,
  arrowBoth: false,
  fillShapes: false,
  visibleRoutes: [],
  hiddenCps: [],
  markerIcon: 'objective',
  unitKind: 'inf',
  unitAffiliation: 'hostile',
  selectedId: null,
  selectedKind: null,
  rightTab: 'assets',
  showVehicles: true,
  showEnemy: false,
  showFlags: true,
  showAssets: true,
  showLabels: true,
  showVehiclePaths: true,
  hiddenVehiclePaths: [],
  exportOpen: false,
  helpOpen: false,
  layerPickerOpen: false,

  setView: (view) => set({ view }),
  setTool: (tool) => set({ tool, selectedId: null, selectedKind: null }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width: clamp(width, 1, 24) }),
  setOpacity: (opacity) => set({ opacity: clamp(opacity, 0.1, 1) }),
  setFillOpacity: (fillOpacity) => set({ fillOpacity: clamp(fillOpacity, 0.02, 1) }),
  setDash: (dash) => set({ dash }),
  setArrowBoth: (arrowBoth) => set({ arrowBoth }),
  setFillShapes: (fillShapes) => set({ fillShapes }),
  setVisibleRoutes: (visibleRoutes) => set({ visibleRoutes }),
  toggleRoute: (id) => set((s) => ({
    visibleRoutes: s.visibleRoutes.includes(id)
      ? s.visibleRoutes.filter((r) => r !== id)
      : [...s.visibleRoutes, id],
  })),
  toggleCp: (id) => set((s) => ({
    hiddenCps: s.hiddenCps.includes(id)
      ? s.hiddenCps.filter((c) => c !== id)
      : [...s.hiddenCps, id],
  })),
  setAllRoutes: (ids, visible) => set({ visibleRoutes: visible ? ids : [] }),
  setMarker: (markerIcon) => set({ markerIcon }),
  setUnit: (unitKind) => set({ unitKind }),
  setAffiliation: (unitAffiliation) => set({ unitAffiliation }),
  setSelected: (selectedId, selectedKind) => set({ selectedId, selectedKind }),
  setRightTab: (rightTab) => set({ rightTab }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<UIState>),
  toggleVehiclePath: (vehicleId) => set((s) => ({
    hiddenVehiclePaths: s.hiddenVehiclePaths.includes(vehicleId)
      ? s.hiddenVehiclePaths.filter((id) => id !== vehicleId)
      : [...s.hiddenVehiclePaths, vehicleId],
  })),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setLayerPickerOpen: (layerPickerOpen) => set({ layerPickerOpen }),
}))

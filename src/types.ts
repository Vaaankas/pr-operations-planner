export type Team = 1 | 2

export interface Faction {
  key: string
  name: string
  short: string
}

export interface LayerRef {
  id: string
  mode: string
  modeLabel: string
  players: number
  name: string
  displayName: string
  sizeKm: number
  layerType: string
  layerTypeLabel: string
  factions: Record<string, Faction>
  tickets?: LayerTickets
  file: string | null
  vehicles: number
  vehiclesAtStart: number
  controlPoints: number
  routes: number
}

export interface MapImages {
  image: string
  thumb: string
  width: number
  height: number
}

export interface MapMeta {
  id: string
  name: string
  world: number
  sizeKm: number
  factions: Record<string, Faction>
  images: MapImages | null
  layers: LayerRef[]
}

export interface MapIndex {
  generated: string
  modes: Record<string, string>
  maps: MapMeta[]
}

export type VehicleCategory =
  | 'mbt' | 'ifv' | 'apc' | 'recon' | 'jeep' | 'logistics' | 'aa' | 'artillery'
  | 'transport_heli' | 'attack_heli' | 'jet' | 'bomber' | 'boat' | 'carrier'
  | 'emplacement' | 'asset' | 'crate' | 'other'

export interface VehicleSpawn {
  id: string
  template: string
  label: string
  category: VehicleCategory
  icon: string
  team: Team | null
  x: number
  z: number
  rotation: number
  atStart: boolean
  respawn: number | null
  cp: number | null
}

export interface ControlPoint {
  id: number
  cpId: number
  raw: string
  name: string
  x: number
  z: number
  team: number
  radius: number
  sgid: number
  order: number
  pick: number
  route: number | null
}

export interface Route {
  id: string
  label: string
  cps: number[]
}

export interface LayerTickets {
  start1: number
  start2: number
  bleed1: number
  bleed2: number
  loss: number
}

export interface LayerData {
  id: string
  levelId: string
  mode: string
  modeLabel: string
  players: number
  layerType: string
  layerTypeLabel: string
  displayName: string
  name: string
  sizeKm: number
  world: number
  factions: Record<string, Faction>
  tickets?: LayerTickets
  controlPoints: ControlPoint[]
  routes: Route[]
  caches?: { x: number; z: number }[]
  vehicles: VehicleSpawn[]
  vehicleAtStart: number
  counts: Record<string, number>
}

export interface AssetManifest {
  factionFlags: Record<string, string>
  cpFlags: Record<string, string>
  scoreFlags: Record<string, string>
  vehicles: Record<string, string>
  vehicleTemplates?: Record<string, string>
  squads: Record<string, string>
  commander: string
  markers: Record<string, string>
  orders: Record<string, string>
}

export interface Point {
  x: number
  y: number
}

export interface ElementBase {
  id: string
  opacity: number
  color: string
  width: number
  dash?: boolean
  fillOpacity?: number
}

export type DrawElement =
  | (ElementBase & { type: 'pen'; points: Point[] })
  | (ElementBase & { type: 'line'; a: Point; b: Point; arrow: 'none' | 'end' | 'both' })
  | (ElementBase & { type: 'ruler'; a: Point; b: Point })
  | (ElementBase & { type: 'rect'; a: Point; b: Point; fill: boolean })
  | (ElementBase & { type: 'ellipse'; a: Point; b: Point; fill: boolean })
  | (ElementBase & { type: 'polygon'; points: Point[]; fill: boolean })
  | (ElementBase & { type: 'text'; at: Point; text: string; fontSize: number; box?: boolean })
  | (ElementBase & {
      type: 'squad'
      at: Point
      squadId: string
      squadNumber: number
      squadColor: string
      size: number
    })
  | (ElementBase & { type: 'icon'; at: Point; icon: string; rotation: number; size: number })
  | (ElementBase & {
      type: 'unit'
      at: Point
      unit: string
      affiliation: 'friend' | 'hostile' | 'neutral'
      size: number
      echelon?: string
    })

export type ElementType = DrawElement['type']

export interface VehicleMove {
  x: number
  z: number
  rotation: number
}

export interface VehicleTurn {
  x: number
  z: number
}

export interface StageFrame {
  x: number
  y: number
  size: number
}

export interface StageVisibility {
  showVehicles: boolean
  showEnemy: boolean
  showFlags: boolean
  showLabels: boolean
  showDrawings: boolean
  showVehicleNames: boolean
  showVehiclePaths: boolean
}

export interface Stage {
  id: string
  name: string
  time: number
  frame?: StageFrame
  visibility?: StageVisibility
  iconSize?: number
  notes: string
  elements: DrawElement[]
  moves: Record<string, VehicleMove>
  turns?: Record<string, VehicleTurn[]>
}

export interface Member {
  id: string
  name: string
  kit?: string
  unconfirmed?: boolean
  confirmed?: boolean
}

export interface Squad {
  id: string
  name: string
  type: string
  color: string
  members: Member[]
}

export interface Roster {
  commander: Member | null
  squads: Squad[]
  unassigned: Member[]
  specialists?: Record<string, number>
  specialistAssignments?: Record<string, string[]>
}

export interface Plan {
  version: 1
  id: string
  operation: string
  mapId: string
  layerId: string
  side: Team
  createdAt: string
  updatedAt: string
  roster: Roster
  stages: Stage[]
  activeStageId: string
  claims: Record<string, string>
  vehicleCrew?: Record<string, string[]>
  flagTeams?: Record<string, number>
  flagNext?: Record<string, number>
  notes: string
}

export type Tool =
  | 'select' | 'pen' | 'line' | 'arrow' | 'ruler' | 'rect' | 'ellipse'
  | 'polygon' | 'text' | 'textbox' | 'marker' | 'erase'

export interface UIState {
  view: 'plan' | 'roster'
  mode: 'edit' | 'preview'
  iconSize: number
  tool: Tool
  color: string
  width: number
  opacity: number
  fillOpacity: number
  dash: boolean
  arrowBoth: boolean
  fillShapes: boolean
  visibleRoutes: string[]
  hiddenCps: number[]
  markerIcon: string
  unitKind: string
  unitAffiliation: 'friend' | 'hostile' | 'neutral'
  selectedId: string | null
  selectedKind: 'element' | 'vehicle' | null
  rightTab: 'assets' | 'stage' | 'routes'
  showVehicles: boolean
  showEnemy: boolean
  showFlags: boolean
  showAssets: boolean
  showLabels: boolean
  showDrawings: boolean
  showVehicleNames: boolean
  showVehiclePaths: boolean
  hiddenVehiclePaths: string[]
  exportOpen: boolean
  helpOpen: boolean
  layerPickerOpen: boolean
}

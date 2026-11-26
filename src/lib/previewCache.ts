import type { LayerData, MapMeta, Plan, Stage } from '../types'
import type { UIState } from '../types'

const cache = new Map<string, string>()

export function stagePreviewKey(plan: Plan, map: MapMeta, layer: LayerData, stage: Stage, ui: UIState): string {
  return JSON.stringify({
    map: map.id,
    layer: layer.id,
    stage,
    side: plan.side,
    claims: plan.claims,
    squads: plan.roster.squads,
    ui: {
      showFlags: ui.showFlags,
      showVehicles: ui.showVehicles,
      showEnemy: ui.showEnemy,
      showLabels: ui.showLabels,
      showDrawings: ui.showDrawings,
      showVehicleNames: ui.showVehicleNames,
      showVehiclePaths: ui.showVehiclePaths,
      hiddenVehiclePaths: ui.hiddenVehiclePaths,
      hiddenCps: ui.hiddenCps,
      visibleRoutes: ui.visibleRoutes,
      iconSize: ui.iconSize,
    },
  })
}

export function getStagePreview(key: string): string | undefined {
  return cache.get(key)
}

export function setStagePreview(key: string, data: string): void {
  cache.set(key, data)
}

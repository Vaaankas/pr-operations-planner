import type { LayerData, MapMeta, Plan, Stage } from '../types'
import type { UIState } from '../types'

const cache = new Map<string, string>()
const MAX_PREVIEWS = 8

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
      showAssets: ui.showAssets,
      showMarkers: ui.showMarkers,
      showProtection: ui.showProtection,
      showRestricted: ui.showRestricted,
      showLabels: ui.showLabels,
      showDrawings: ui.showDrawings,
      showVehicleNames: ui.showVehicleNames,
      showVehiclePaths: ui.showVehiclePaths,
      startingOnly: ui.startingOnly,
      hiddenVehiclePaths: ui.hiddenVehiclePaths,
      hiddenCps: ui.hiddenCps,
      visibleRoutes: ui.visibleRoutes,
      iconSize: ui.iconSize,
    },
  })
}

export function getStagePreview(key: string): string | undefined {
  const data = cache.get(key)
  if (data) {
    cache.delete(key)
    cache.set(key, data)
  }
  return data
}

export function setStagePreview(key: string, data: string): void {
  cache.delete(key)
  cache.set(key, data)
  while (cache.size > MAX_PREVIEWS) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

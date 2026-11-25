import type { ControlPoint, LayerData, Route } from '../types'

export interface RouteGroup {
  number: number
  order: number
  cps: ControlPoint[]
}

export function groupRoute(layer: LayerData, route: Route): RouteGroup[] {
  const byOrder = new Map<number, ControlPoint[]>()
  for (const id of route.cps) {
    const cp = layer.controlPoints.find((c) => c.id === id)
    if (!cp) continue
    if (!byOrder.has(cp.order)) byOrder.set(cp.order, [])
    byOrder.get(cp.order)!.push(cp)
  }
  return [...byOrder.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([order, cps], index) => ({
      number: index + 1,
      order,
      cps: cps.sort((a, b) => a.pick - b.pick || a.name.localeCompare(b.name)),
    }))
}

export function routeSegments(layer: LayerData, route: Route): [ControlPoint, ControlPoint][] {
  const groups = groupRoute(layer, route)
  const segments: [ControlPoint, ControlPoint][] = []
  for (let i = 1; i < groups.length; i++) {
    const previous = groups[i - 1].cps
    const current = groups[i].cps
    if (previous.length === 1) {
      for (const cp of current) segments.push([previous[0], cp])
    } else if (current.length === 1) {
      for (const cp of previous) segments.push([cp, current[0]])
    } else {
      for (let j = 0; j < current.length; j++) {
        segments.push([previous[Math.min(j, previous.length - 1)], current[j]])
      }
    }
  }
  return segments
}

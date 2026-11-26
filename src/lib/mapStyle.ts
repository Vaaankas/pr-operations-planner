export const MAP_REFERENCE_SIZE = 900

export const VEHICLE_ICON_PX = {
  mbt: 32,
  boat: 34,
  carrier: 34,
  other: 30,
} as const

export const FLAG_ICON_PX = 30
export const CACHE_ICON_PX = 19
export const SQUAD_ICON_PX = 24

export const MAP_TEXT_FILL = '#f8fafc'
export const MAP_TEXT_OUTLINE = 'rgba(2,6,4,0.92)'
export const MAP_TEXT_OUTLINE_PX = 3

export function vehicleIconPx(category: string): number {
  if (category === 'mbt') return VEHICLE_ICON_PX.mbt
  if (category === 'boat' || category === 'carrier') return VEHICLE_ICON_PX.boat
  return VEHICLE_ICON_PX.other
}

export function exportPx(size: number, px: number, detailScale = 1): number {
  return (px * size * detailScale) / MAP_REFERENCE_SIZE
}

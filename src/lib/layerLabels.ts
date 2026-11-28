import type { LayerData, LayerRef } from '../types'

type LayerLike = Pick<LayerRef, 'mode' | 'players' | 'displayName'> | Pick<LayerData, 'mode' | 'players' | 'displayName'>

const SIZE_VARIANTS: Record<number, string> = {
  16: 'Infantry',
  32: 'Alternative',
  64: 'Standard',
  128: 'Large',
}

const VARIANT_MODES = new Set(['gpm_insurgency', 'gpm_skirmish'])

export function layerVariant(layer: Pick<LayerRef, 'mode' | 'players'> | Pick<LayerData, 'mode' | 'players'>): string | null {
  if (!VARIANT_MODES.has(layer.mode)) return null
  return SIZE_VARIANTS[layer.players] ?? `${layer.players}P`
}

export function layerDisplayName(layer: LayerLike): string {
  const variant = layerVariant(layer)
  return variant ? `${layer.displayName} ${variant}` : layer.displayName
}

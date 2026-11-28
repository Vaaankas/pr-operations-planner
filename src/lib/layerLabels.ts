import type { LayerData, LayerRef } from '../types'

type LayerLike = Pick<LayerRef, 'mode' | 'players' | 'displayName'> | Pick<LayerData, 'mode' | 'players' | 'displayName'>

const INSURGENCY_VARIANTS: Record<number, string> = {
  16: 'INF',
  32: 'ALT',
  64: 'STD',
  128: 'LARGE',
}

export function layerVariant(layer: Pick<LayerRef, 'mode' | 'players'> | Pick<LayerData, 'mode' | 'players'>): string | null {
  if (layer.mode !== 'gpm_insurgency') return null
  return INSURGENCY_VARIANTS[layer.players] ?? `${layer.players}P`
}

export function layerDisplayName(layer: LayerLike): string {
  const variant = layerVariant(layer)
  return variant ? `${layer.displayName} · ${variant}` : layer.displayName
}

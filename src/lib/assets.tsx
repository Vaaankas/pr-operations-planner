import { createContext, useContext } from 'react'
import type { AssetManifest, VehicleSpawn } from '../types'

const EMPTY: AssetManifest = { factionFlags: {}, cpFlags: {}, scoreFlags: {}, vehicles: {}, squads: {}, commander: '', markers: {}, orders: {} }

export const AssetContext = createContext<AssetManifest>(EMPTY)

export function AssetProvider({ value, children }: { value: AssetManifest; children: React.ReactNode }) {
  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>
}

export function useAssets(): AssetManifest {
  return useContext(AssetContext)
}

export function vehicleIconPath(assets: AssetManifest, vehicle: VehicleSpawn): string | undefined {
  return assets.vehicleTemplates?.[vehicle.template]
    ?? assets.vehicles[vehicle.icon]
    ?? assets.vehicles[vehicle.category]
    ?? assets.vehicles.other
}

const FACTION_ALIASES: Record<string, string[]> = {
  us: ['usa', 'us'],
  usa: ['us', 'usa'],
  rus: ['ru'],
  ru: ['rus', 'ru'],
  tal: ['taliban'],
  meinsurgent: ['chinsurgent', 'taliban', 'mec'],
  chinsurgent: ['meinsurgent', 'taliban'],
  ins: ['meinsurgent', 'chinsurgent', 'taliban'],
  gb: ['gb'],
  vnusa: ['us', 'usa'],
  vnusmc: ['us', 'usa'],
}

function factionCandidates(key: string): string[] {
  const normalized = key.toLowerCase()
  const base = normalized.replace(/(?:_(?:ziptie|iron|para|night))+$/, '')
  return [...new Set([
    normalized,
    base,
    ...(FACTION_ALIASES[normalized] ?? []),
    ...(FACTION_ALIASES[base] ?? []),
  ])]
}

export function factionFlag(assets: AssetManifest, key: string | undefined): string | undefined {
  if (!key) return undefined
  for (const candidate of factionCandidates(key)) {
    if (assets.factionFlags[candidate]) return assets.factionFlags[candidate]
  }
  return undefined
}

export function cpFlag(assets: AssetManifest, key: string | undefined): string | undefined {
  if (!key) return assets.cpFlags.neutral
  for (const candidate of factionCandidates(key)) {
    if (assets.cpFlags[candidate]) return assets.cpFlags[candidate]
  }
  return assets.cpFlags.neutral
}

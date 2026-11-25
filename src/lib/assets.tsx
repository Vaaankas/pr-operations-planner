import { createContext, useContext } from 'react'
import type { AssetManifest } from '../types'

const EMPTY: AssetManifest = { factionFlags: {}, cpFlags: {}, vehicles: {}, markers: {}, orders: {} }

export const AssetContext = createContext<AssetManifest>(EMPTY)

export function AssetProvider({ value, children }: { value: AssetManifest; children: React.ReactNode }) {
  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>
}

export function useAssets(): AssetManifest {
  return useContext(AssetContext)
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
}

export function factionFlag(assets: AssetManifest, key: string | undefined): string | undefined {
  if (!key) return undefined
  const candidates = [key, ...(FACTION_ALIASES[key] ?? [])]
  for (const candidate of candidates) {
    if (assets.factionFlags[candidate]) return assets.factionFlags[candidate]
  }
  return undefined
}

export function cpFlag(assets: AssetManifest, key: string | undefined): string | undefined {
  if (!key) return assets.cpFlags.neutral
  const candidates = [key, ...(FACTION_ALIASES[key] ?? [])]
  for (const candidate of candidates) {
    if (assets.cpFlags[candidate]) return assets.cpFlags[candidate]
  }
  return assets.cpFlags.neutral
}

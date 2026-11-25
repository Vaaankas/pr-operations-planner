import type { Plan, Squad, Stage } from '../types'

export const PLAYER_CAP = 50
export const SQUAD_SIZE = 8
export const SQUAD_COLORS = [
  '#3b82f6', '#65a30d', '#22d3ee', '#facc15', '#e2e8f0',
  '#f472b6', '#86efac', '#a78bfa', '#fb923c', '#ef4444',
]
export const SQUAD_TYPES = [
  'INF', 'ARMOR', 'CAS', 'TRANS', 'RECON', 'MORTARS', 'APC', 'LOGISTICS', 'CMD',
]
export const PHONETIC = [
  'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO',
  'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIET',
]

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function parseTime(value: string): number {
  const parts = value.split(':').map((p) => Number.parseInt(p, 10))
  if (parts.some((p) => Number.isNaN(p))) return 0
  if (parts.length === 1) return Math.max(0, parts[0]) * 60
  return Math.max(0, parts[0]) * 60 + clamp(parts[1] || 0, 0, 59)
}

export const ASSET_BASE = import.meta.env.BASE_URL
export const ASSET_VERSION = '20261126-6'

export function dataUrl(path: string): string {
  return `${ASSET_BASE}data/${path}?v=${ASSET_VERSION}`
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function safeName(text: string): string {
  return text.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'plan'
}

export function newSquad(index: number, type = 'INF', name?: string): Squad {
  return {
    id: uid('sq'),
    name: name ?? PHONETIC[index] ?? `SQUAD ${index + 1}`,
    type,
    color: SQUAD_COLORS[index % SQUAD_COLORS.length],
    members: [],
  }
}

export function newStage(index: number, time = 0): Stage {
  return {
    id: uid('st'),
    name: index === 0 ? 'Deployment' : `Stage ${index + 1}`,
    time,
    notes: '',
    elements: [],
    moves: {},
  }
}

export function defaultRoster(): Plan['roster'] {
  const types = ['INF', 'ARMOR', 'TRANS', 'RECON', 'MORTARS']
  return {
    commander: null,
    unassigned: [],
    squads: types.map((t, i) => newSquad(i, t)),
  }
}

export function playerCount(plan: Plan): number {
  return (
    (plan.roster.commander ? 1 : 0) +
    plan.roster.squads.reduce((n, s) => n + s.members.length, 0) +
    plan.roster.unassigned.length
  )
}

export function memberSlots(plan: Plan): number {
  return PLAYER_CAP - (plan.roster.commander ? 1 : 0)
}

export const CATEGORY_LABELS: Record<string, string> = {
  mbt: 'Main battle tank', ifv: 'IFV', apc: 'APC', recon: 'Recon', jeep: 'Light vehicle',
  logistics: 'Logistics', aa: 'Anti-air', artillery: 'Artillery', transport_heli: 'Transport heli',
  attack_heli: 'Attack heli', jet: 'Jet', bomber: 'Bomber', boat: 'Boat', carrier: 'Carrier',
  emplacement: 'Emplacement', asset: 'Asset', crate: 'Crate', other: 'Other',
}

export const SIDE_COLORS = {
  friend: '#38bdf8',
  enemy: '#f87171',
  neutral: '#fbbf24',
}

export function affiliationColor(a: 'friend' | 'hostile' | 'neutral'): string {
  return a === 'friend' ? '#38bdf8' : a === 'hostile' ? '#f87171' : '#fbbf24'
}

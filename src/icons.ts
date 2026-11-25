export type IconName =
  | 'mbt' | 'ifv' | 'apc' | 'recon' | 'jeep' | 'logistics' | 'aa' | 'artillery'
  | 'transport_heli' | 'attack_heli' | 'jet' | 'bomber' | 'boat' | 'carrier'
  | 'emplacement' | 'asset' | 'crate' | 'other'
  | 'flag' | 'fob' | 'rally' | 'lz' | 'objective' | 'observe' | 'attack'
  | 'defend' | 'waypoint' | 'mine' | 'cache' | 'repair' | 'supply' | 'mortar'
  | 'tow' | 'star' | 'inf' | 'armor' | 'air' | 'hq' | 'mech' | 'support'
  | 'squad' | 'phase'

type Glyph = string

// Simple top-down tactical glyphs drawn in a 64x64 box.
const G: Record<string, Glyph> = {
  mbt: `
    <rect x="8" y="13" width="9" height="38" rx="3"/>
    <rect x="47" y="13" width="9" height="38" rx="3"/>
    <rect x="19" y="18" width="26" height="28" rx="3"/>
    <circle cx="32" cy="32" r="8" fill="#0b110d"/>
    <rect x="30" y="5" width="4" height="22" rx="1"/>`,
  ifv: `
    <rect x="9" y="15" width="8" height="34" rx="3"/>
    <rect x="47" y="15" width="8" height="34" rx="3"/>
    <rect x="19" y="20" width="26" height="24" rx="3"/>
    <circle cx="32" cy="32" r="6.5" fill="#0b110d"/>
    <rect x="30.5" y="12" width="3" height="18" rx="1"/>`,
  apc: `
    <rect x="18" y="19" width="28" height="27" rx="5"/>
    <circle cx="14" cy="23" r="3"/><circle cx="14" cy="32" r="3"/><circle cx="14" cy="41" r="3"/>
    <circle cx="50" cy="23" r="3"/><circle cx="50" cy="32" r="3"/><circle cx="50" cy="41" r="3"/>
    <rect x="30" y="14" width="4" height="9" rx="1"/>`,
  jeep: `
    <rect x="21" y="19" width="22" height="27" rx="4"/>
    <rect x="14" y="21" width="6" height="9" rx="2"/><rect x="14" y="35" width="6" height="9" rx="2"/>
    <rect x="44" y="21" width="6" height="9" rx="2"/><rect x="44" y="35" width="6" height="9" rx="2"/>
    <rect x="26" y="14" width="12" height="5" rx="2" fill="#0b110d"/>`,
  logistics: `
    <rect x="20" y="8" width="24" height="14" rx="3"/>
    <rect x="16" y="25" width="32" height="28" rx="3"/>
    <rect x="12" y="18" width="6" height="9" rx="2"/><rect x="46" y="18" width="6" height="9" rx="2"/>
    <rect x="12" y="36" width="6" height="9" rx="2"/><rect x="46" y="36" width="6" height="9" rx="2"/>`,
  aa: `
    <rect x="14" y="22" width="36" height="23" rx="4"/>
    <circle cx="32" cy="33" r="9" fill="#0b110d"/>
    <rect x="22" y="4" width="3.5" height="18" rx="1"/><rect x="28" y="4" width="3.5" height="18" rx="1"/>
    <rect x="34" y="4" width="3.5" height="18" rx="1"/><rect x="40" y="4" width="3.5" height="18" rx="1"/>`,
  artillery: `
    <rect x="18" y="27" width="28" height="22" rx="4"/>
    <rect x="29" y="8" width="5" height="28" rx="1.5" transform="rotate(22 32 32)"/>
    <circle cx="32" cy="32" r="6" fill="#0b110d"/>
    <rect x="12" y="38" width="5" height="8" rx="2"/><rect x="47" y="38" width="5" height="8" rx="2"/>`,
  transport_heli: `
    <rect x="24" y="19" width="16" height="31" rx="8"/>
    <rect x="30" y="45" width="4" height="13" rx="2"/>
    <rect x="22" y="55" width="20" height="3.5" rx="1.5"/>
    <rect x="10" y="25" width="44" height="3.5" rx="1.5"/>
    <rect x="27" y="9" width="10" height="4" rx="2"/>`,
  attack_heli: `
    <rect x="27" y="18" width="10" height="34" rx="5"/>
    <rect x="12" y="27" width="40" height="4" rx="2"/>
    <rect x="30" y="48" width="4" height="11" rx="2"/>
    <rect x="21" y="57" width="22" height="3" rx="1.5"/>
    <rect x="9" y="21" width="46" height="3" rx="1.5"/>`,
  jet: `
    <path d="M32 4 L38 27 L58 39 L58 44 L37 38 L36 53 L43 58 L43 62 L32 59 L21 62 L21 58 L28 53 L27 38 L6 44 L6 39 L26 27 Z"/>`,
  bomber: `
    <path d="M30 6 L34 6 L35 30 L58 34 L58 40 L35 38 L34 52 L42 58 L42 61 L32 59 L22 61 L22 58 L30 52 L29 38 L6 40 L6 34 L29 30 Z"/>`,
  boat: `
    <path d="M32 6 L40 22 L43 50 L32 58 L21 50 L24 22 Z" fill="#0b110d"/>
    <path d="M32 9 L38 23 L40 48 L32 54 L24 48 L26 23 Z"/>
    <rect x="30" y="26" width="4" height="14" rx="1" fill="#0b110d"/>`,
  carrier: `
    <path d="M10 24 L52 24 L58 40 L46 52 L18 52 L6 40 Z"/>
    <rect x="14" y="31" width="34" height="5" rx="2" fill="#0b110d"/>`,
  emplacement: `
    <circle cx="32" cy="36" r="10"/>
    <rect x="30" y="8" width="4" height="24" rx="1"/>
    <path d="M16 52 L32 38 L48 52" fill="none" stroke-width="4"/>
    <circle cx="32" cy="36" r="4" fill="#0b110d"/>`,
  asset: `
    <rect x="14" y="16" width="36" height="34" rx="4"/>
    <rect x="29" y="24" width="6" height="18" rx="1" fill="#0b110d"/>
    <rect x="23" y="30" width="18" height="6" rx="1" fill="#0b110d"/>`,
  crate: `
    <rect x="14" y="14" width="36" height="36" rx="3"/>
    <path d="M18 18 L46 46 M46 18 L18 46" stroke="#0b110d" stroke-width="4" fill="none"/>`,
  other: `<path d="M32 7 L57 32 L32 57 L7 32 Z" fill="none" stroke-width="6"/><circle cx="32" cy="32" r="5"/>`,

  flag: `
    <rect x="16" y="8" width="3.5" height="48" rx="1"/>
    <path d="M20 10 L52 18 L20 27 Z"/>`,
  fob: `
    <path d="M12 50 L20 26 L32 16 L44 26 L52 50 Z"/>
    <rect x="26" y="36" width="12" height="14" fill="#0b110d"/>
    <path d="M12 52 H52" stroke-width="3"/>`,
  rally: `
    <rect x="18" y="14" width="3" height="40" rx="1"/>
    <path d="M21 16 L46 22 L21 30 Z"/>
    <circle cx="40" cy="44" r="9" fill="none" stroke-width="4"/>`,
  lz: `
    <circle cx="32" cy="32" r="24" fill="none" stroke-width="5"/>
    <path d="M23 20 V44 M41 20 V44 M23 32 H41" stroke-width="5" fill="none"/>`,
  objective: `
    <path d="M32 7 L57 32 L32 57 L7 32 Z" fill="none" stroke-width="5"/>
    <circle cx="32" cy="32" r="6"/>`,
  observe: `
    <path d="M6 32 C16 16 48 16 58 32 C48 48 16 48 6 32 Z" fill="none" stroke-width="4.5"/>
    <circle cx="32" cy="32" r="8"/>`,
  attack: `
    <circle cx="32" cy="32" r="19" fill="none" stroke-width="5"/>
    <path d="M32 6 V19 M32 45 V58 M6 32 H19 M45 32 H58" stroke-width="5"/>
    <circle cx="32" cy="32" r="4"/>`,
  defend: `
    <path d="M32 7 L53 15 V32 C53 45 44 53 32 58 C20 53 11 45 11 32 V15 Z" fill="none" stroke-width="5"/>
    <path d="M22 32 L29 39 L43 24" fill="none" stroke-width="5"/>`,
  waypoint: `
    <path d="M32 6 C21 6 14 15 14 25 C14 39 32 58 32 58 C32 58 50 39 50 25 C50 15 43 6 32 6 Z"/>
    <circle cx="32" cy="24" r="7" fill="#0b110d"/>`,
  mine: `
    <circle cx="32" cy="32" r="14"/>
    <path d="M32 8 V16 M32 48 V56 M8 32 H16 M48 32 H56 M15 15 L21 21 M43 43 L49 49 M49 15 L43 21 M21 43 L15 49" stroke-width="4"/>`,
  cache: `
    <rect x="12" y="18" width="40" height="30" rx="2"/>
    <path d="M12 28 H52 M26 18 V48" stroke="#0b110d" stroke-width="4"/>
    <circle cx="40" cy="38" r="6" fill="#0b110d"/>`,
  repair: `
    <path d="M40 10 C31 10 24 17 24 26 C24 29 25 32 27 34 L12 49 L17 54 L32 39 C34 41 37 42 40 42 C49 42 56 35 56 26 L46 33 L40 27 L47 17 C45 13 43 10 40 10 Z"/>`,
  supply: `
    <path d="M8 22 L32 10 L56 22 V44 L32 56 L8 44 Z" fill="none" stroke-width="4.5"/>
    <path d="M32 32 V50 M24 40 H40" stroke-width="5"/>`,
  mortar: `
    <rect x="27" y="8" width="10" height="34" rx="2" transform="rotate(18 32 32)"/>
    <path d="M14 52 L32 38 L50 52" fill="none" stroke-width="4.5"/>
    <circle cx="32" cy="52" r="6"/>`,
  tow: `
    <rect x="10" y="34" width="44" height="16" rx="3"/>
    <rect x="18" y="16" width="28" height="12" rx="3"/>
    <path d="M22 16 L22 8 M42 16 L42 8" stroke-width="4"/>
    <circle cx="32" cy="42" r="4" fill="#0b110d"/>`,
  star: `<path d="M32 6 L39.5 24 L59 25 L44 38 L48.5 57 L32 47 L15.5 57 L20 38 L5 25 L24.5 24 Z"/>`,
  inf: `
    <rect x="8" y="20" width="48" height="24" fill="none" stroke-width="4"/>
    <path d="M8 20 L56 44 M56 20 L8 44" stroke-width="4"/>`,
  armor: `
    <ellipse cx="32" cy="32" rx="24" ry="15" fill="none" stroke-width="4"/>
    <rect x="24" y="26" width="16" height="12" rx="2"/>`,
  air: `
    <path d="M32 8 L37 27 L57 38 L57 43 L37 38 L36 52 L43 57 L43 60 L32 57 L21 60 L21 57 L28 52 L27 38 L7 43 L7 38 L27 27 Z"/>`,
  hq: `
    <rect x="10" y="24" width="44" height="28" rx="2" fill="none" stroke-width="4"/>
    <path d="M10 34 H54 M26 24 V52" stroke-width="4"/>
    <rect x="34" y="14" width="3" height="22"/>`,
  mech: `
    <rect x="6" y="20" width="52" height="24" rx="4" fill="none" stroke-width="4"/>
    <ellipse cx="32" cy="32" rx="13" ry="8" fill="none" stroke-width="4"/>`,
  support: `
    <rect x="8" y="20" width="48" height="24" rx="2" fill="none" stroke-width="4"/>
    <path d="M32 24 V40 M24 32 H40" stroke-width="4"/>`,
  squad: `
    <circle cx="32" cy="32" r="26" fill="none" stroke-width="4"/>
    <circle cx="32" cy="32" r="4"/>`,
  phase: `
    <path d="M8 44 L24 24 L38 34 L56 12" fill="none" stroke-width="5"/>
    <path d="M46 12 H56 V22" fill="none" stroke-width="5"/>`,
}

export const VEHICLE_ICONS: Record<string, IconName> = {
  mbt: 'mbt', ifv: 'ifv', apc: 'apc', recon: 'recon', jeep: 'jeep',
  logistics: 'logistics', aa: 'aa', artillery: 'artillery',
  transport_heli: 'transport_heli', attack_heli: 'attack_heli',
  jet: 'jet', bomber: 'bomber', boat: 'boat', carrier: 'carrier',
  emplacement: 'emplacement', asset: 'asset', crate: 'crate', other: 'other',
}

function esc(s: string) {
  return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
}

const cache = new Map<string, string>()

export function iconSvg(name: string, color: string, bare = false): string {
  const key = `${name}|${color}|${bare}`
  const hit = cache.get(key)
  if (hit) return hit
  const glyph = G[name] ?? G.other
  const body = bare
    ? `<g fill="${color}" stroke="${color}" stroke-width="0">${glyph}</g>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r="30" fill="rgba(7,13,10,0.78)" stroke="${color}" stroke-width="2.5"/>
        <g fill="${color}" stroke="${color}">${glyph}</g>
      </svg>`
  cache.set(key, body)
  return body
}

export function iconDataUrl(name: string, color: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(name, color))}`
}

export function iconImage(name: string, color: string): HTMLImageElement {
  const key = `${name}|${color}`
  const existing = imgCache.get(key)
  if (existing) return existing
  const img = new Image()
  img.src = iconDataUrl(name, color)
  imgCache.set(key, img)
  return img
}

const imgCache = new Map<string, HTMLImageElement>()

export function glyphFor(kind: 'vehicle' | 'marker', value: string): string {
  if (kind === 'vehicle') return VEHICLE_ICONS[value] ?? 'other'
  return value
}

export { esc }

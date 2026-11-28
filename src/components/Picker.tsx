import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronRight, Crosshair } from 'lucide-react'
import type { LayerRef, MapIndex, MapMeta, Team } from '../types'
import { dataUrl } from '../lib/utils'
import { factionFlag, useAssets } from '../lib/assets'

interface Props {
  index: MapIndex
  currentMapId?: string
  currentLayerId?: string
  currentSide?: Team
  onStart: (map: MapMeta, layer: LayerRef, side: Team) => void
  onClose?: () => void
  onDiscard?: () => void
}

const MODES = ['ALL', 'AAS', 'Insurgency', 'Skirmish'] as const
const SIZES = ['ALL', 1, 2, 4, 8] as const

export function Picker({ index, currentMapId, currentLayerId, currentSide, onStart, onClose, onDiscard }: Props) {
  const assets = useAssets()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<(typeof MODES)[number]>('ALL')
  const [size, setSize] = useState<(typeof SIZES)[number]>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(currentMapId ?? index.maps[0]?.id ?? null)
  const [layerId, setLayerId] = useState<string | null>(currentLayerId ?? null)
  const [side, setSide] = useState<Team>(currentSide ?? 1)

  const selected = index.maps.find((m) => m.id === selectedId) ?? null

  const maps = useMemo(() => {
    const q = query.trim().toLowerCase()
    return index.maps.filter((m) => {
      if (!m.images) return false
      if (mode !== 'ALL' && !m.layers.some((l) => l.modeLabel === mode)) return false
      if (size !== 'ALL' && m.sizeKm !== size) return false
      if (!q) return true
      if (m.name.toLowerCase().includes(q)) return true
      return m.layers.some((l) => l.displayName.toLowerCase().includes(q))
    })
  }, [index, query, mode, size])

  const layerGroups = useMemo(() => {
    if (!selected) return []
    const groups = new Map<string, LayerRef[]>()
    for (const l of selected.layers) {
      if (mode !== 'ALL' && l.modeLabel !== mode) continue
      const key = l.modeLabel
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(l)
    }
    return [...groups.entries()]
  }, [selected, mode])

  useEffect(() => {
    if (layerId && selected?.layers.some((l) => l.id === layerId)) return
    const first = layerGroups[0]?.[1][0]
    setLayerId(first?.id ?? null)
  }, [selected, mode, layerId, layerGroups])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pickLayer = selected?.layers.find((l) => l.id === layerId) ?? null
  const factions = pickLayer?.factions ?? selected?.factions ?? {}

  return (
    <div className={onClose ? 'fixed inset-0 z-50 flex flex-col bg-[#070b08]/97 backdrop-blur' : 'flex h-full flex-col bg-[#070b08]'}>
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/10 px-5">
        <div className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-amber-400" />
          <div className="leading-none">
            <div className="font-mono text-[13px] font-bold tracking-[0.22em] text-slate-100">PR OPERATIONS</div>
            <div className="mt-1 font-mono text-[9px] tracking-[0.28em] text-slate-500">MISSION PLANNING BOARD</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onDiscard && (
            <button onClick={onDiscard} className="rounded border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10">
              Discard Current Plan
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="rounded border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">
              {currentMapId ? 'Back to planning' : 'Close'}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search maps or layers…"
                className="w-64 rounded border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
              />
            </div>
            <div className="flex items-center gap-1 rounded border border-white/10 p-0.5">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded px-2.5 py-1 text-[12px] font-semibold tracking-wide ${mode === m ? 'bg-amber-400 text-black' : 'text-slate-300 hover:bg-white/5'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded border border-white/10 p-0.5">
              {SIZES.map((s) => (
                <button
                  key={String(s)}
                  onClick={() => setSize(s)}
                  className={`rounded px-2.5 py-1 text-[12px] font-semibold tracking-wide ${size === s ? 'bg-amber-400 text-black' : 'text-slate-300 hover:bg-white/5'}`}
                >
                  {s === 'ALL' ? 'ALL' : `${s} KM`}
                </button>
              ))}
            </div>
            <div className="ml-auto font-mono text-[11px] uppercase tracking-widest text-slate-400">{maps.length} results</div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {maps.map((m) => {
                const active = m.id === selectedId
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`group relative overflow-hidden rounded border text-left transition ${active ? 'border-amber-400 ring-1 ring-amber-400/40' : 'border-white/10 hover:border-white/25'}`}
                  >
                    <div className="relative aspect-square bg-[#0b110d]">
                      {m.images ? (
                        <img
                          src={dataUrl(`thumbs/${m.images.thumb}`)}
                          alt={m.name}
                          loading="lazy"
                          className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-slate-600">NO MAP ART</div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6">
                        <div className="truncate text-[12px] font-semibold text-slate-100">{m.name}</div>
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-slate-300">
                          {m.sizeKm} km
                        </div>
                      </div>
                      {active && <div className="absolute right-1.5 top-1.5 rounded bg-amber-400 px-1.5 py-0.5 font-mono text-[9px] font-bold text-black">SELECTED</div>}
                    </div>
                  </button>
                )
              })}
            </div>
            {maps.length === 0 && (
              <div className="mt-20 text-center text-sm text-slate-500">No maps match that filter.</div>
            )}
          </div>
        </section>

        <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#090f0b]">
          {selected ? (
            <>
              <div className="border-b border-white/10 px-5 py-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400/80">Selected map</div>
                <div className="mt-1 text-xl font-semibold leading-tight text-slate-100">{selected.name}</div>
                <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">{selected.sizeKm} km</div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {layerGroups.map(([label, layers]) => (
                  <div key={label} className="mb-4">
                    <div className="mb-1.5 flex items-center gap-1 px-1 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {label}
                    </div>
                    <div className="space-y-1">
                      {layers.map((l) => {
                        const active = l.id === layerId
                        const lf = l.factions ?? selected.factions ?? {}
                        const f1 = lf['1']
                        const f2 = lf['2']
                        const flag1 = f1 ? factionFlag(assets, f1.key) : undefined
                        const flag2 = f2 ? factionFlag(assets, f2.key) : undefined
                        return (
                          <button
                            key={l.id}
                            onClick={() => setLayerId(l.id)}
                            className={`flex w-full items-center gap-2 rounded border px-3 py-2.5 text-left transition ${active ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/5 bg-black/20 hover:border-white/15'}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-slate-100">{l.displayName}</span>
                              <span className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider">
                                <span className="flex items-center gap-1 text-rose-400">
                                  {flag1 && <img src={dataUrl(flag1)} alt="" className="h-3 w-4 object-fill" />}
                                  {f1?.short ?? '—'}
                                </span>
                                <span className="text-slate-600">vs</span>
                                <span className="flex items-center gap-1 text-sky-400">
                                  {flag2 && <img src={dataUrl(flag2)} alt="" className="h-3 w-4 object-fill" />}
                                  {f2?.short ?? '—'}
                                </span>
                              </span>
                            </span>
                            {active && <ChevronRight className="h-4 w-4 text-amber-400" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {layerGroups.length === 0 && <div className="mt-8 text-center text-xs text-slate-600">No layers for this filter.</div>}
              </div>

              <div className="border-t border-white/10 px-4 py-4">
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">Planning side</div>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2] as Team[]).map((t) => {
                    const f = factions[String(t)]
                    const active = side === t
                    const flag = f ? factionFlag(assets, f.key) : undefined
                    return (
                      <button
                        key={t}
                        onClick={() => setSide(t)}
                        className={`rounded border px-2.5 py-2 text-left ${
                          active
                            ? t === 1
                              ? 'border-rose-400 bg-rose-500/15'
                              : 'border-sky-400 bg-sky-500/15'
                            : 'border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                          {flag && <img src={dataUrl(flag)} alt="" className="h-4 w-[22px] object-fill" />}
                          {t === 1 ? 'REDFOR' : 'BLUFOR'}
                        </div>
                        <div className={`mt-1 truncate text-[13px] font-semibold ${active ? (t === 1 ? 'text-rose-300' : 'text-sky-300') : 'text-slate-200'}`}>
                          {f?.name ?? 'Unknown'}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <button
                  disabled={!pickLayer}
                  onClick={() => selected && pickLayer && onStart(selected, pickLayer, side)}
                  className="mt-3 w-full rounded bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {pickLayer ? `New plan on ${selected.name}` : 'Select a layer'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-600">Select a map</div>
          )}
        </aside>
      </div>
    </div>
  )
}

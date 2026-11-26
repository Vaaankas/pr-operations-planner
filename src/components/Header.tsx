import { useEffect, useRef, useState } from 'react'
import {
  Download, HelpCircle, Map, Redo2, Save,
  Undo2, Upload, Users,
} from 'lucide-react'
import type { LayerData, MapMeta, Plan } from '../types'
import { usePlanner, useUI } from '../store'
import { playerCount } from '../lib/utils'
import { cpFlag, useAssets } from '../lib/assets'
import { dataUrl } from '../lib/utils'

interface Props {
  plan: Plan
  map: MapMeta
  layer: LayerData
  onOpenPicker: () => void
  onExport: () => void
  onHelp: () => void
}

export function Header({ plan, map, layer, onOpenPicker, onExport, onHelp }: Props) {
  const planner = usePlanner()
  const ui = useUI()
  const assets = useAssets()
  const [operation, setOperation] = useState(plan.operation)
  const fileRef = useRef<HTMLInputElement>(null)
  const canUndo = usePlanner((s) => s.past.length > 0)
  const canRedo = usePlanner((s) => s.future.length > 0)

  useEffect(() => setOperation(plan.operation), [plan.operation])

  const importJson = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data?.version !== 1 || !data.mapId || !Array.isArray(data.stages) || data.stages.length === 0) throw new Error('Not a planner file')
      planner.setPlan(data as Plan)
    } catch (err) {
      window.alert(`Import failed: ${err instanceof Error ? err.message : 'invalid file'}`)
    }
  }

  const side = layer.factions[String(plan.side)]
  const members = [
    ...(plan.roster.commander ? [plan.roster.commander] : []),
    ...plan.roster.squads.flatMap((s) => s.members),
    ...plan.roster.unassigned,
  ]
  const confirmed = members.filter((m) => m.confirmed).length

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#080d0a] px-3">
      <button
        onClick={onOpenPicker}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded border border-white/15 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:border-amber-400/50 hover:text-amber-300"
        title="Back to planning menu"
      >
        <Map className="h-3.5 w-3.5" /> Menu
      </button>
      <button onClick={onHelp} className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-slate-300 hover:bg-white/10" title="Controls & credits">
        <HelpCircle className="h-4 w-4" />
      </button>

      <div className="min-w-0">
        <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Operation</div>
        <input
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
          onBlur={() => operation.trim() && operation !== plan.operation && planner.setMeta({ operation: operation.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-[230px] max-w-[24vw] truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-semibold text-slate-100 outline-none hover:border-white/10 focus:border-amber-400/40"
          title="Operation name"
        />
      </div>

      <div className="hidden min-w-0 border-l border-white/10 pl-3 lg:block">
        <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Map</div>
        <div className="max-w-[240px] truncate px-1 py-0.5 text-[12px] font-medium text-slate-300" title={`${map.name} · ${layer.displayName}`}>
          {map.name} <span className="text-slate-600">·</span> {layer.displayName}
        </div>
      </div>

      <div className="hidden h-7 w-px bg-white/10 lg:block" />

      <span className="hidden items-center gap-1.5 rounded border border-white/10 px-2 py-1 text-[10px] font-medium text-slate-300 lg:flex">
        {side && cpFlag(assets, side.key) ? (
          <img src={dataUrl(cpFlag(assets, side.key)!)} alt="" className="h-4 w-4 object-contain" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        )}
        {side?.name ?? `Team ${plan.side}`}
      </span>

      <div className="flex shrink-0 items-center rounded border border-white/10 p-0.5">
        <button
          onClick={() => ui.setView('plan')}
          className={`rounded px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${ui.view === 'plan' ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Battle Plan
        </button>
        <button
          onClick={() => ui.setView('roster')}
          className={`rounded px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${ui.view === 'roster' ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Roster
        </button>
      </div>

      <span
        className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider"
        title={`${confirmed}/50 confirmed · ${playerCount(plan)} total players · ${members.length - confirmed} unconfirmed`}
      >
        <Users className="h-3 w-3 text-emerald-400" />
        <span className="text-emerald-400">{confirmed}</span>
        <span className="text-slate-500">/50</span>
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={() => planner.undo()} disabled={!canUndo} className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={() => planner.redo()} disabled={!canRedo} className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Redo (Ctrl+Y)">
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="hidden items-center gap-1 px-2 font-mono text-[9px] uppercase tracking-wider text-slate-600 xl:flex">
          <Save className="h-3 w-3 text-emerald-500/70" /> saved {new Date(plan.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-8 w-8 items-center justify-center rounded border border-white/15 text-slate-300 hover:border-amber-400/50 hover:text-amber-300"
          title="Import plan JSON"
        >
          <Upload className="h-3.5 w-3.5" />
        </button>

        <button onClick={onExport} className="flex h-8 items-center gap-1.5 rounded bg-amber-400 px-3 text-[11px] font-bold uppercase tracking-wider text-black hover:bg-amber-300">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importJson(f)
          e.target.value = ''
        }}
      />
    </header>
  )
}



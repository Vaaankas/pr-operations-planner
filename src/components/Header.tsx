import { useEffect, useRef, useState } from 'react'
import {
  Download, HelpCircle, Map, Redo2, Save,
  Undo2, Upload, Users,
} from 'lucide-react'
import type { LayerData, MapMeta, Plan } from '../types'
import { usePlanner, useUI } from '../store'
import { playerCount } from '../lib/utils'
import { factionFlag, useAssets } from '../lib/assets'
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/15 text-slate-200 hover:border-amber-400/50 hover:text-amber-300"
        title="Go back to map/layer selection"
      >
        <Map className="h-4 w-4" />
      </button>
      <button onClick={onHelp} className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-slate-300 hover:bg-white/10" title="Controls & credits">
        <HelpCircle className="h-4 w-4" />
      </button>

      <button onClick={() => planner.undo()} disabled={!canUndo} className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Undo (Ctrl+Z)">
        <Undo2 className="h-4 w-4" />
      </button>
      <button onClick={() => planner.redo()} disabled={!canRedo} className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Redo (Ctrl+Y)">
        <Redo2 className="h-4 w-4" />
      </button>

      <div className="flex shrink-0 items-center rounded border border-white/10 p-0.5">
        <button
          onClick={() => { ui.setView('plan'); ui.setMode('edit') }}
          className={`rounded px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${ui.view === 'plan' && ui.mode === 'edit' ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Edit Plan
        </button>
        <button
          onClick={() => { ui.setView('plan'); ui.setMode('preview') }}
          className={`rounded px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${ui.view === 'plan' && ui.mode === 'preview' ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Preview
        </button>
        <button
          onClick={() => ui.setView('roster')}
          className={`rounded px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${ui.view === 'roster' ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Roster
        </button>
      </div>

      <div className="flex min-w-0 items-stretch divide-x divide-white/10 overflow-hidden rounded-md border border-white/10 bg-white/[0.02]">
        <div className="flex min-w-0 shrink flex-col justify-center px-3 py-1.5">
          <span className="font-mono text-[8px] uppercase leading-none tracking-[0.18em] text-slate-500">Operation</span>
          <input
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            onBlur={() => operation.trim() && operation !== plan.operation && planner.setMeta({ operation: operation.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="mt-1 w-[190px] max-w-[20vw] truncate rounded-sm border border-transparent bg-transparent px-0 text-[12px] font-semibold leading-4 text-slate-100 outline-none hover:border-white/10 focus:border-amber-400/40"
            title="Operation name"
          />
        </div>

        <div className="hidden min-w-0 flex-col justify-center px-3 py-1.5 lg:flex">
          <span className="font-mono text-[8px] uppercase leading-none tracking-[0.18em] text-slate-500">Map</span>
          <div className="mt-1 max-w-[210px] truncate text-[12px] font-medium leading-4 text-slate-300" title={`${map.name} · ${layer.displayName}`}>
            {map.name} {layer.displayName}
          </div>
        </div>

        <div className="hidden flex-col justify-center px-3 py-1.5 lg:flex">
          <span className="font-mono text-[8px] uppercase leading-none tracking-[0.18em] text-slate-500">Faction</span>
          <span className="mt-1 flex items-center gap-1.5 text-[12px] font-medium leading-4 text-slate-300">
            {side && factionFlag(assets, side.key) ? (
              <img src={dataUrl(factionFlag(assets, side.key)!)} alt="" className="h-4 w-[22px] object-fill" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            )}
            {side?.name ?? `Team ${plan.side}`}
          </span>
        </div>

        <div className="flex flex-col justify-center px-3 py-1.5" title={`${confirmed}/50 confirmed · ${playerCount(plan)} total players · ${members.filter((member) => member.unconfirmed).length} uncertain`}>
          <span className="font-mono text-[8px] uppercase leading-none tracking-[0.18em] text-slate-500">Players</span>
          <span className="mt-1 flex items-center gap-1 font-mono text-[11px] leading-4 tracking-wider">
            <Users className="h-3 w-3 text-emerald-400" />
            <span className="text-emerald-400">{confirmed}</span>
            <span className="text-slate-500">/50</span>
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
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



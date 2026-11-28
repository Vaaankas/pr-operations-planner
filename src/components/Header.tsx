import { useEffect, useRef, useState } from 'react'
import {
  Download, HelpCircle, Map, Save, Upload, Users,
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
    <header className="relative z-30 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_422.4px] items-stretch border-b border-white/10 bg-[#080d0a]">
      <div className="relative flex min-w-0 items-center gap-2 px-3">

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-full max-w-[390px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
          <input
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            onBlur={() => operation.trim() && operation !== plan.operation && planner.setMeta({ operation: operation.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="pointer-events-auto w-[230px] max-w-full truncate rounded-sm border border-transparent bg-transparent px-1 text-center text-[14px] font-semibold leading-5 text-slate-100 outline-none hover:border-white/10 focus:border-amber-400/40"
            title="Operation name"
          />
          <div
            className="mt-0.5 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500"
            title={`${side?.name ?? `Team ${plan.side}`} · ${map.name} ${layer.displayName} · ${confirmed}/50 confirmed`}
          >
            <span className="flex min-w-0 items-center justify-end gap-1.5">
              {side && factionFlag(assets, side.key) ? (
                <img src={dataUrl(factionFlag(assets, side.key)!)} alt="" className="h-3 w-4 shrink-0 object-fill" />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
              )}
              <span className="truncate text-slate-300">{side?.short ?? `TEAM ${plan.side}`}</span>
            </span>
            <span className="max-w-[230px] truncate px-1 text-center text-slate-400">
              {map.name} {layer.displayName}
            </span>
            <span
              className="pointer-events-auto flex shrink-0 cursor-help items-center justify-start gap-1 text-emerald-400"
              title={`${confirmed}/50 confirmed · ${playerCount(plan)} total players · ${members.filter((member) => member.unconfirmed).length} uncertain`}
            >
              <Users className="h-3 w-3" />
              {confirmed}<span className="text-slate-500">/50</span>
            </span>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center rounded border border-white/10 p-0.5">
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
      </div>

      <div className="flex items-center gap-2 border-l border-white/10 px-3">
        <button onClick={onHelp} className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-slate-300 hover:bg-white/10" title="Controls & credits">
          <HelpCircle className="h-4 w-4" />
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-wider text-slate-600 xl:flex">
            <Save className="h-3 w-3 text-emerald-500/70" />
            saved {new Date(plan.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          <button
            onClick={onOpenPicker}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/15 text-slate-200 hover:border-amber-400/50 hover:text-amber-300"
            title="Go back to map/layer selection"
          >
            <Map className="h-4 w-4" />
          </button>

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
        </div>
      </div>
    </header>
  )
}



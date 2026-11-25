import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, Crosshair, Download, FileJson, HelpCircle, Map, Menu, Redo2, Save,
  Trash2, Undo2, Upload, Users,
} from 'lucide-react'
import type { LayerData, MapMeta, Plan } from '../types'
import { usePlanner } from '../store'
import { downloadBlob, playerCount, safeName } from '../lib/utils'

interface Props {
  plan: Plan
  map: MapMeta
  layer: LayerData
  onOpenPicker: () => void
  onExport: () => void
  onHelp: () => void
  onReset: () => void
}

export function Header({ plan, map, layer, onOpenPicker, onExport, onHelp, onReset }: Props) {
  const planner = usePlanner()
  const [operation, setOperation] = useState(plan.operation)
  const [menu, setMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const canUndo = usePlanner((s) => s.past.length > 0)
  const canRedo = usePlanner((s) => s.future.length > 0)

  useEffect(() => setOperation(plan.operation), [plan.operation])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${safeName(plan.operation)}.prplan.json`)
    setMenu(false)
  }

  const importJson = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data?.version !== 1 || !data.mapId || !Array.isArray(data.stages) || data.stages.length === 0) throw new Error('Not a planner file')
      planner.setPlan(data as Plan)
      setMenu(false)
    } catch (err) {
      window.alert(`Import failed: ${err instanceof Error ? err.message : 'invalid file'}`)
    }
  }

  const side = layer.factions[String(plan.side)]

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#080d0a] px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-amber-400/40 bg-amber-400/10">
          <Crosshair className="h-4 w-4 text-amber-400" />
        </div>
        <div className="hidden leading-none sm:block">
          <div className="font-mono text-[10px] font-bold tracking-[0.22em] text-amber-400/90">PR OPS</div>
          <div className="mt-0.5 font-mono text-[8px] tracking-[0.2em] text-slate-600">PLANNING BOARD</div>
        </div>
      </div>

      <div className="h-7 w-px bg-white/10" />

      <div className="min-w-0">
        <input
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
          onBlur={() => operation.trim() && operation !== plan.operation && planner.setMeta({ operation: operation.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-[260px] max-w-[34vw] truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-semibold text-slate-100 outline-none hover:border-white/10 focus:border-amber-400/40"
          title="Operation name"
        />
        <button onClick={onOpenPicker} className="group flex items-center gap-1 px-1 text-[10px] text-slate-500 hover:text-amber-300">
          <Map className="h-3 w-3" />
          <span className="truncate">{map.name} · {layer.name}</span>
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 lg:flex">
          <Users className="h-3 w-3" /> {playerCount(plan)}/50
        </span>
        <span className="hidden items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-slate-400 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> {side?.name ?? `Team ${plan.side}`}
        </span>

        <button onClick={() => planner.undo()} disabled={!canUndo} className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={() => planner.redo()} disabled={!canRedo} className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Redo (Ctrl+Y)">
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="hidden items-center gap-1 px-2 font-mono text-[9px] uppercase tracking-wider text-slate-600 xl:flex">
          <Save className="h-3 w-3 text-emerald-500/70" /> saved {new Date(plan.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>

        <button onClick={onExport} className="flex h-8 items-center gap-1.5 rounded bg-amber-400 px-3 text-[11px] font-bold uppercase tracking-wider text-black hover:bg-amber-300">
          <Download className="h-3.5 w-3.5" /> Export
        </button>

        <button onClick={() => setMenu(!menu)} className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-slate-300 hover:bg-white/10" title="Menu">
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
          <div className="absolute right-3 top-12 z-40 w-56 overflow-hidden rounded border border-white/15 bg-[#0d1410] py-1 shadow-2xl">
            <MenuItem icon={<Map className="h-3.5 w-3.5" />} label="New operation" onClick={() => { setMenu(false); onOpenPicker() }} />
            <MenuItem icon={<FileJson className="h-3.5 w-3.5" />} label="Export plan JSON" onClick={exportJson} />
            <MenuItem icon={<Upload className="h-3.5 w-3.5" />} label="Import plan JSON" onClick={() => { setMenu(false); fileRef.current?.click() }} />
            <div className="my-1 h-px bg-white/10" />
            <MenuItem icon={<HelpCircle className="h-3.5 w-3.5" />} label="Controls & credits" onClick={() => { setMenu(false); onHelp() }} />
            <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Discard plan" danger onClick={() => { setMenu(false); onReset() }} />
          </div>
        </>
      )}

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

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-white/5 ${danger ? 'text-rose-400' : 'text-slate-300'}`}
    >
      {icon}
      {label}
    </button>
  )
}

import { useEffect, useState } from 'react'
import { Clock, Eye, EyeOff, Flag, RotateCcw, Shield, Trash2, Truck } from 'lucide-react'
import type { LayerData, Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { formatTime, parseTime } from '../lib/utils'

interface Props {
  layer: LayerData
  plan: Plan
  stage: Stage
}

function CommitInput({
  value, onCommit, className, placeholder,
}: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className={className}
    />
  )
}

export function StagePanel({ layer, plan, stage }: Props) {
  const planner = usePlanner()
  const ui = useUI()
  const [time, setTime] = useState(formatTime(stage.time))
  const [notes, setNotes] = useState(stage.notes)
  useEffect(() => setTime(formatTime(stage.time)), [stage.time])
  useEffect(() => setNotes(stage.notes), [stage.notes])

  const moves = Object.keys(stage.moves).length
  const draws = stage.elements.length

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Stage name</label>
          <CommitInput
            value={stage.name}
            onCommit={(v) => planner.updateStage(stage.id, { name: v || 'Untitled stage' })}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] font-semibold text-slate-100 outline-none focus:border-amber-400/50"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
            <Clock className="h-3 w-3" /> Mission clock
          </label>
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => planner.updateStage(stage.id, { time: parseTime(time) })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="00:00"
            className="w-28 rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[13px] text-slate-100 outline-none focus:border-amber-400/50"
          />
          <span className="ml-2 text-[10px] text-slate-600">mm:ss from round start</span>
        </div>

        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Commander intent / notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== stage.notes && planner.updateStage(stage.id, { notes })}
            rows={8}
            placeholder="Intent, tasks, timing, coordination..."
            className="w-full resize-none rounded border border-white/10 bg-black/30 px-2 py-2 text-[12px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Drawings</div>
            <div className="font-mono text-lg text-slate-200">{draws}</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Moved vehicles</div>
            <div className="font-mono text-lg text-slate-200">{moves}</div>
          </div>
        </div>

        <button
          onClick={() => planner.removeStage(stage.id)}
          disabled={plan.stages.length <= 1}
          className="flex w-full items-center justify-center gap-1 rounded border border-rose-500/20 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400/80 hover:bg-rose-500/10 disabled:opacity-30"
        >
          <Trash2 className="h-3 w-3" /> Delete stage
        </button>
      </div>

    </div>
  )
}

function Toggle({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded px-1 py-1 text-[10px] text-slate-400 hover:bg-white/5">
      <span className={value ? 'text-amber-400/80' : 'text-slate-600'}>{icon}</span>
      <span>{label}</span>
      <span className="ml-auto">{value ? <Eye className="h-3 w-3 text-slate-500" /> : <EyeOff className="h-3 w-3 text-slate-700" />}</span>
    </button>
  )
}

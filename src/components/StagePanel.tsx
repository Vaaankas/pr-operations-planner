import { useEffect, useState } from 'react'
import { Clock, Flag, Pencil, Route as RouteIcon, Shield, Tag, Trash2, Truck, Type } from 'lucide-react'
import type { LayerData, Plan, Stage, StageVisibility } from '../types'
import { usePlanner, useUI } from '../store'
import { DEFAULT_STAGE_VISIBILITY, formatTime, parseTime } from '../lib/utils'

const VISIBILITY_OPTIONS: Array<{
  key: keyof StageVisibility
  label: string
  description: string
  icon: typeof Truck
}> = [
  { key: 'showVehicles', label: 'Vehicles', description: 'Spawns and moves', icon: Truck },
  { key: 'showEnemy', label: 'Enemy assets', description: 'Hostile markers', icon: Shield },
  { key: 'showFlags', label: 'Flags & radii', description: 'Capture points', icon: Flag },
  { key: 'showDrawings', label: 'Drawings', description: 'Lines, zones and labels', icon: Pencil },
  { key: 'showLabels', label: 'Map labels', description: 'Flag and place names', icon: Tag },
  { key: 'showVehicleNames', label: 'Vehicle names', description: 'Names and timers', icon: Type },
  { key: 'showVehiclePaths', label: 'Vehicle paths', description: 'Movement trails', icon: RouteIcon },
]

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
  const visibility = { ...DEFAULT_STAGE_VISIBILITY, ...(stage.visibility ?? {}) }


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

        <button
          onClick={() => planner.removeStage(stage.id)}
          disabled={plan.stages.length <= 1}
          className="flex w-full items-center justify-center gap-1 rounded border border-rose-500/20 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400/80 hover:bg-rose-500/10 disabled:opacity-30"
        >
          <Trash2 className="h-3 w-3" /> Delete stage
        </button>
      </div>

      <div className="h-1/4 min-h-[165px] shrink-0 border-t border-white/10 bg-black/20 p-2">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Stage visibility</div>
        <div className="grid h-[calc(100%-18px)] grid-cols-2 gap-1">
          {VISIBILITY_OPTIONS.map(({ key, label, description, icon: Icon }) => {
            const active = visibility[key]
            return (
              <button
                key={key}
                onClick={() => planner.toggleStageVisibility(key)}
                className={`flex min-h-0 items-center gap-1.5 rounded border px-1.5 py-1 text-left ${
                  active
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                    : 'border-white/10 bg-black/20 text-slate-500 hover:border-white/20 hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                  <span className="block truncate text-[8px] text-slate-500">{description}</span>
                </span>
              </button>
            )
          })}
          <div className="flex min-h-0 flex-col justify-center rounded border border-white/10 bg-black/20 px-1.5 py-1">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
              <span>Icon scale</span>
              <span className="text-slate-300">{ui.iconSize.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={ui.iconSize}
              onChange={(e) => ui.setIconSize(Number(e.target.value))}
              className="icon-scale-slider mt-1 h-1 w-full rounded-full bg-white/15 accent-amber-400"
              title="Map icon scale"
            />
          </div>
        </div>
      </div>

    </div>
  )
}



import { useEffect, useState } from 'react'
import { Ban, Boxes, Clock, Crop, Flag, MapPin, Pencil, Route as RouteIcon, Shield, Swords, Tag, Trash2, Truck, Type } from 'lucide-react'
import type { LayerData, Plan, Stage, StageVisibility } from '../types'
import { usePlanner } from '../store'
import { DEFAULT_STAGE_VISIBILITY, formatTime, parseTime } from '../lib/utils'
import { OrdersEditor } from './OrdersEditor'

const VISIBILITY_OPTIONS: Array<{
  key: keyof StageVisibility
  label: string
  icon: typeof Truck
}> = [
  { key: 'showVehicles', label: 'Vehicles', icon: Truck },
  { key: 'showEnemy', label: 'Enemy vehicles', icon: Swords },
  { key: 'showAssets', label: 'Static assets', icon: Boxes },
  { key: 'showFlags', label: 'Flags', icon: Flag },
  { key: 'showMarkers', label: 'Markers', icon: MapPin },
  { key: 'showProtection', label: 'Base protection', icon: Shield },
  { key: 'showRestricted', label: 'Restricted areas', icon: Ban },
  { key: 'showDrawings', label: 'Drawings', icon: Pencil },
  { key: 'showLabels', label: 'Flag labels', icon: Tag },
  { key: 'showVehicleNames', label: 'Vehicle names', icon: Type },
  { key: 'showVehiclePaths', label: 'Vehicle paths', icon: RouteIcon },
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
  const [time, setTime] = useState(formatTime(stage.time))
  const [notes, setNotes] = useState(stage.notes)
  useEffect(() => setTime(formatTime(stage.time)), [stage.time])
  useEffect(() => setNotes(stage.notes), [stage.notes])
  const visibility = { ...DEFAULT_STAGE_VISIBILITY, ...(stage.visibility ?? {}) }
  const timeEnabled = stage.timeEnabled !== false


  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-3 pt-3">
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Stage name</label>
          <div className="flex items-stretch gap-1.5">
            <CommitInput
              value={stage.name}
              onCommit={(v) => planner.updateStage(stage.id, { name: v || 'Untitled stage' })}
              className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] font-semibold text-slate-100 outline-none focus:border-amber-400/50"
            />
            <button
              onClick={() => planner.updateStage(stage.id, { frame: { x: 0, y: 0, size: 1 } })}
              title="Reset export frame to the full map"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded border border-white/10 text-slate-400 hover:border-amber-400/40 hover:text-amber-300"
            >
              <Crop className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete stage "${stage.name}"? Its drawings and vehicle moves will be removed.`)) {
                  planner.removeStage(stage.id)
                }
              }}
              disabled={plan.stages.length <= 1}
              title="Delete stage"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded border border-rose-500/20 text-rose-400/80 hover:bg-rose-500/10 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
            <Clock className="h-3 w-3" /> Mission clock
            <button
              type="button"
              onClick={() => planner.updateStage(stage.id, { timeEnabled: !timeEnabled })}
              aria-pressed={timeEnabled}
              title={timeEnabled ? 'Disable mission clock' : 'Enable mission clock'}
              className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider ${
                timeEnabled ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-500 hover:text-slate-300'
              }`}
            >
              {timeEnabled ? 'On' : 'Off'}
            </button>
          </label>
          <input
            value={timeEnabled ? time : '--:--'}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => timeEnabled && planner.updateStage(stage.id, { time: parseTime(time) })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={!timeEnabled}
            placeholder="00:00"
            className="w-28 rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[13px] text-slate-100 outline-none focus:border-amber-400/50 disabled:cursor-not-allowed disabled:text-slate-600"
          />
          <span className="ml-2 text-[10px] text-slate-600">{timeEnabled ? 'mm:ss from round start' : 'Optional — omitted from exports'}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3">
        <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">ORDERS</label>
        <OrdersEditor
          key={stage.id}
          value={notes}
          stageId={stage.id}
          plan={plan}
          onChange={setNotes}
          onCommit={(next) => planner.updateStage(stage.id, { notes: next })}
        />
      </div>

      <div className="h-1/4 min-h-[165px] shrink-0 border-t border-white/10 bg-black/20 p-2">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Stage visibility</div>
        <div className="grid h-[calc(100%-18px)] grid-cols-2 gap-1">
          {VISIBILITY_OPTIONS.map(({ key, label, icon: Icon }) => {
            const active = visibility[key]
            return (
              <button
                key={key}
                onClick={() => planner.toggleStageVisibility(key)}
                aria-pressed={active}
                className="flex min-h-0 items-center gap-1.5 rounded border border-white/10 bg-black/20 px-1.5 py-1 text-left text-slate-400 hover:border-white/20 hover:text-slate-300"
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-amber-300' : 'text-slate-600'}`} />
                <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              </button>
            )
          })}
          <div className="flex min-h-0 flex-col justify-center rounded border border-white/10 bg-black/20 px-1.5 py-1">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
              <span>Icon scale</span>
              <span className="text-slate-300">{(stage.iconSize ?? 1).toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={stage.iconSize ?? 1}
              onChange={(e) => planner.setStageIconSize(Number(e.target.value))}
              className="icon-scale-slider mt-1 h-1 w-full rounded-full bg-white/15 accent-amber-400"
              title="Map icon scale"
            />
          </div>
        </div>
      </div>

    </div>
  )
}



import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, GripVertical, Plus } from 'lucide-react'
import type { Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { stageTimeLabel } from '../lib/utils'

export function Timeline({ plan, stage }: { plan: Plan; stage: Stage }) {
  const planner = usePlanner()
  const stages = useMemo(() => plan.stages, [plan.stages])
  const index = stages.findIndex((s) => s.id === stage.id)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const go = (dir: number) => {
    const next = stages[Math.min(stages.length - 1, Math.max(0, index + dir))]
    if (next) planner.setActiveStage(next.id)
  }

  return (
    <div className="flex h-[60px] shrink-0 border-t border-white/10 bg-[#080d0a]">
      <div className="flex w-[100px] shrink-0 flex-col justify-center border-r border-white/10 px-2">
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => go(-1)} disabled={index <= 0} className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Previous stage" aria-label="Previous stage">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => go(1)} disabled={index >= stages.length - 1} className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Next stage" aria-label="Next stage">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3">
        {stages.map((s, i) => {
          const active = s.id === stage.id
          return (
            <button
              key={s.id}
              draggable
              onClick={() => {
                planner.setActiveStage(s.id)
                useUI.getState().setRightTab('stage')
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/pr-stage', s.id)
                e.dataTransfer.effectAllowed = 'move'
                setDraggingId(s.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setOverId(s.id)
              }}
              onDragLeave={() => setOverId((current) => current === s.id ? null : current)}
              onDrop={(e) => {
                e.preventDefault()
                const fromId = e.dataTransfer.getData('text/pr-stage') || draggingId
                if (fromId && fromId !== s.id) planner.reorderStages(fromId, s.id)
                setDraggingId(null)
                setOverId(null)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setOverId(null)
              }}
              title="Click to edit · drag to reorder"
              className={`relative z-10 h-10 w-auto min-w-[120px] max-w-[280px] shrink-0 cursor-grab rounded border px-2 py-0 text-left transition active:cursor-grabbing ${
                active ? 'border-amber-400/70 bg-[#221b07]' : overId === s.id ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-[#0c130f] hover:border-white/25'
              } ${draggingId === s.id ? 'opacity-50' : ''}`}
            >
              <span className="flex h-full min-w-0 items-center gap-1.5">
                <GripVertical className={`h-3 w-3 shrink-0 ${active ? 'text-amber-400/70' : 'text-slate-600'}`} />
                <span className={`shrink-0 font-mono text-[11px] leading-none tabular-nums ${active ? 'text-amber-200' : 'text-slate-400'}`}>{stageTimeLabel(s)}</span>
                <span className="min-w-0 truncate whitespace-nowrap text-[12px] font-semibold leading-none text-slate-200">{s.name}</span>
              </span>
              {active && <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-amber-400" />}
            </button>
          )
        })}
        <button
          onClick={() => planner.addStage()}
          className="relative z-10 flex h-10 w-[80px] shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-white/15 text-slate-500 hover:border-amber-400/50 hover:text-amber-300"
          title="Add stage — copies current drawings and vehicle positions"
        >
          <Plus className="h-4 w-4" />
          <span className="font-mono text-[8px] uppercase tracking-wider">Stage</span>
        </button>
      </div>
    </div>
  )
}

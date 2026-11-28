import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react'
import type { Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { formatTime } from '../lib/utils'

export function Timeline({ plan, stage }: { plan: Plan; stage: Stage }) {
  const planner = usePlanner()
  const [playing, setPlaying] = useState(false)
  const stages = useMemo(() => [...plan.stages].sort((a, b) => a.time - b.time), [plan.stages])
  const index = stages.findIndex((s) => s.id === stage.id)

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      const current = usePlanner.getState().plan
      if (!current) return
      const sorted = [...current.stages].sort((a, b) => a.time - b.time)
      const at = sorted.findIndex((s) => s.id === current.activeStageId)
      if (at < sorted.length - 1) {
        usePlanner.getState().setActiveStage(sorted[at + 1].id)
      } else {
        setPlaying(false)
      }
    }, 3200)
    return () => clearInterval(timer)
  }, [playing])

  const go = (dir: number) => {
    const next = stages[Math.min(stages.length - 1, Math.max(0, index + dir))]
    if (next) planner.setActiveStage(next.id)
  }

  return (
    <div className="flex h-[72px] shrink-0 border-t border-white/10 bg-[#080d0a]">
      <div className="flex w-[148px] shrink-0 flex-col justify-center gap-1.5 border-r border-white/10 px-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPlaying(!playing)}
            className={`flex h-7 w-7 items-center justify-center rounded ${playing ? 'bg-amber-400 text-black' : 'bg-white/10 text-slate-200 hover:bg-white/15'}`}
            title="Play stage sequence"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => go(-1)} disabled={index <= 0} className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Previous stage">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => go(1)} disabled={index >= stages.length - 1} className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Next stage">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3">
        {stages.map((s, i) => {
          const active = s.id === stage.id
          return (
            <button
              key={s.id}
              onClick={() => {
                planner.setActiveStage(s.id)
                useUI.getState().setRightTab('stage')
              }}
              className={`relative z-10 h-12 shrink-0 rounded border px-2.5 py-0 text-left transition ${
                active ? 'border-amber-400/70 bg-[#221b07]' : 'border-white/10 bg-[#0c130f] hover:border-white/25'
              }`}
              style={{ width: Math.min(280, Math.max(132, 86 + s.name.length * 7.5)) }}
            >
              <span className="grid h-full min-w-0 grid-cols-[43px_minmax(0,1fr)] items-center gap-1.5">
                <span className={`font-mono text-[11px] leading-none tabular-nums ${active ? 'text-amber-200' : 'text-slate-400'}`}>{formatTime(s.time)}</span>
                <span className="truncate text-[12px] font-semibold leading-none text-slate-200">{s.name}</span>
              </span>
              {active && <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-amber-400" />}
            </button>
          )
        })}
        <button
          onClick={() => planner.addStage()}
          className="relative z-10 flex h-12 w-[80px] shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-white/15 text-slate-500 hover:border-amber-400/50 hover:text-amber-300"
          title="Add stage — copies current drawings and vehicle positions"
        >
          <Plus className="h-4 w-4" />
          <span className="font-mono text-[8px] uppercase tracking-wider">Stage</span>
        </button>
      </div>
    </div>
  )
}

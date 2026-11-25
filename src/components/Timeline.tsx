import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react'
import type { Plan, Stage } from '../types'
import { usePlanner } from '../store'
import { formatTime } from '../lib/utils'

export function Timeline({ plan, stage }: { plan: Plan; stage: Stage }) {
  const planner = usePlanner()
  const [playing, setPlaying] = useState(false)
  const stages = useMemo(() => [...plan.stages].sort((a, b) => a.time - b.time), [plan.stages])
  const index = stages.findIndex((s) => s.id === stage.id)
  const maxTime = Math.max(0, ...stages.map((s) => s.time))

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
    <div className="flex h-[92px] shrink-0 border-t border-white/10 bg-[#080d0a]">
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
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
          {stages.length} stages · {formatTime(maxTime)}
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3">
        <div className="pointer-events-none absolute left-3 right-3 top-[38px] h-px bg-white/10" />
        {stages.map((s, i) => {
          const active = s.id === stage.id
          return (
            <button
              key={s.id}
              onClick={() => planner.setActiveStage(s.id)}
              className={`relative z-10 flex h-[64px] w-[168px] shrink-0 flex-col justify-center rounded border px-2 text-left transition ${
                active ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-[#0c130f] hover:border-white/25'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`font-mono text-[10px] font-bold ${active ? 'text-amber-300' : 'text-slate-500'}`}>{String(i + 1).padStart(2, '0')}</span>
                <span className={`font-mono text-[11px] ${active ? 'text-amber-200' : 'text-slate-400'}`}>{formatTime(s.time)}</span>
                {s.time === 0 && <span className="rounded bg-white/10 px-1 font-mono text-[8px] uppercase text-slate-400">start</span>}
              </div>
              <div className="mt-1 truncate text-[12px] font-semibold text-slate-200">{s.name}</div>
              <div className="font-mono text-[8px] uppercase tracking-wider text-slate-600">
                {s.elements.length} marks · {Object.keys(s.moves).length} moves
              </div>
              {active && <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-amber-400" />}
            </button>
          )
        })}
        <button
          onClick={() => planner.addStage()}
          className="relative z-10 flex h-[64px] w-[92px] shrink-0 flex-col items-center justify-center gap-1 rounded border border-dashed border-white/15 text-slate-500 hover:border-amber-400/50 hover:text-amber-300"
          title="Add stage"
        >
          <Plus className="h-4 w-4" />
          <span className="font-mono text-[8px] uppercase tracking-wider">Stage</span>
        </button>
      </div>
    </div>
  )
}

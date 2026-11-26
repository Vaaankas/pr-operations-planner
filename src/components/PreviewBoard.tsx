import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { useAssets } from '../lib/assets'
import { renderStageCanvas } from '../lib/render'
import { formatTime } from '../lib/utils'

interface Props {
  map: MapMeta
  layer: LayerData
  plan: Plan
  stage: Stage
}

export function PreviewBoard({ map, layer, plan, stage }: Props) {
  const assets = useAssets()
  const ui = useUI()
  const planner = usePlanner()
  const stages = [...plan.stages].sort((a, b) => a.time - b.time)
  const stageIndex = stages.findIndex((item) => item.id === stage.id)
  const hostRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    renderStageCanvas(plan, layer, stage, map, {
      size: 2048,
      showFlags: true,
      showVehicles: true,
      showEnemy: true,
      showAssets: false,
      showLabels: true,
      showSpawnMarks: true,
      assets,
      visibleRoutes: ui.visibleRoutes,
      hiddenCps: ui.hiddenCps,
      frame: stage.frame,
      detailScale: stage.frame?.size ?? 1,
    }).then((canvas) => {
      if (cancelled) return
      canvas.style.maxWidth = '100%'
      canvas.style.maxHeight = '100%'
      canvas.style.width = 'auto'
      canvas.style.height = 'auto'
      canvas.style.display = 'block'
      const host = hostRef.current
      if (host) {
        host.replaceChildren(canvas)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [assets, layer, map, plan, stage, ui.hiddenCps, ui.visibleRoutes])

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#070b08] p-4">
      <div
        ref={hostRef}
        className="flex h-full w-full items-center justify-center"
        style={{ filter: loading ? 'blur(2px)' : undefined, opacity: loading ? 0.35 : 1 }}
      />
      {loading && (
        <div className="absolute font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Rendering preview
        </div>
      )}

      {stages.length > 1 && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded border border-white/15 bg-[#080d0a]/90 px-2 py-1.5 shadow-2xl">
          <button
            onClick={() => stageIndex > 0 && planner.setActiveStage(stages[stageIndex - 1].id)}
            disabled={stageIndex <= 0}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 disabled:opacity-25"
            title="Previous stage"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-48 text-center">
            <div className="text-[12px] font-semibold text-slate-100">{stage.name}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
              {stageIndex + 1} / {stages.length} · {formatTime(stage.time)}
            </div>
          </div>
          <button
            onClick={() => stageIndex < stages.length - 1 && planner.setActiveStage(stages[stageIndex + 1].id)}
            disabled={stageIndex >= stages.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 disabled:opacity-25"
            title="Next stage"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

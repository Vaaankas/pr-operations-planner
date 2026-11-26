import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { usePlanner } from '../store'
import { formatTime } from '../lib/utils'
import { captureStageDataUrl } from '../lib/konvaExport'

interface Props {
  map: MapMeta
  layer: LayerData
  plan: Plan
  stage: Stage
}

export function PreviewBoard({ map, layer, plan, stage }: Props) {
  const planner = usePlanner()
  const stages = [...plan.stages].sort((a, b) => a.time - b.time)
  const stageIndex = stages.findIndex((item) => item.id === stage.id)
  const [images, setImages] = useState<Record<string, string>>({})
  const pending = useRef(new Set<string>())
  const cacheKey = `${stage.id}:${plan.updatedAt}:${map.id}:${layer.id}`

  useEffect(() => {
    if (images[cacheKey] || pending.current.has(cacheKey)) return
    pending.current.add(cacheKey)
    captureStageDataUrl({ map, layer, plan }, stage, 2048, 'png')
      .then((src) => {
        setImages((current) => ({ ...current, [cacheKey]: src }))
      })
      .catch((err) => console.error(err))
      .finally(() => {
        pending.current.delete(cacheKey)
      })
  }, [cacheKey, images, layer, map, plan, stage])

  const src = images[cacheKey]

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#070b08] p-4">
      {src ? (
        <img src={src} alt={`${stage.name} preview`} className="block max-h-full max-w-full object-contain" draggable={false} />
      ) : (
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Capturing frame
        </div>
      )}

      {stages.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded border border-white/15 bg-[#080d0a]/90 px-2 py-1.5 shadow-2xl">
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

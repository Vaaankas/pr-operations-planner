import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { useAssets } from '../lib/assets'
import { formatTime } from '../lib/utils'
import { stageSlideData } from '../lib/slide'
import { getStagePreview, setStagePreview, stagePreviewKey } from '../lib/previewCache'
import { captureStageDataUrl } from '../lib/konvaExport'

interface Props {
  map: MapMeta
  layer: LayerData
  plan: Plan
  stage: Stage
}

export function PreviewBoard({ map, layer, plan, stage }: Props) {
  const planner = usePlanner()
  const ui = useUI()
  const assets = useAssets()
  const stages = [...plan.stages].sort((a, b) => a.time - b.time)
  const stageIndex = stages.findIndex((item) => item.id === stage.id)
  const cacheKey = stagePreviewKey(plan, map, layer, stage, ui)
  const [images, setImages] = useState<Record<string, string>>({})
  const pending = useRef(new Set<string>())
  const wheelAt = useRef(0)

  useEffect(() => {
    const cached = getStagePreview(cacheKey)
    if (cached) {
      setImages((current) => (current[cacheKey] === cached ? current : { ...current, [cacheKey]: cached }))
      return
    }
    if (pending.current.has(cacheKey)) return
    pending.current.add(cacheKey)
    captureStageDataUrl({ map, layer, plan, assets }, stage, 2048, 'png')
      .then((src) => {
        setStagePreview(cacheKey, src)
        setImages((current) => ({ ...current, [cacheKey]: src }))
      })
      .catch((err) => console.error(err))
      .finally(() => {
        pending.current.delete(cacheKey)
      })
  }, [assets, cacheKey, layer, map, plan, stage])

  const src = images[cacheKey] ?? getStagePreview(cacheKey)
  const slide = stageSlideData(plan, map, layer, stage)

  const switchStage = (direction: -1 | 1) => {
    if (stages.length < 2 || stageIndex < 0) return
    const next = (stageIndex + direction + stages.length) % stages.length
    planner.setActiveStage(stages[next].id)
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#070b08] p-4"
      onWheel={(e) => {
        if (stages.length < 2) return
        e.preventDefault()
        const now = performance.now()
        if (now - wheelAt.current < 350) return
        wheelAt.current = now
        switchStage(e.deltaY > 0 ? 1 : -1)
      }}
    >
      <div className="relative aspect-video w-full max-w-[1280px] overflow-hidden bg-[#f8fafc] shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-[0.8%] bg-amber-400" />

        <div className="absolute left-[3.4%] top-[4.3%] w-[35%]">
          <div className="font-semibold leading-none text-[#0f172a]" style={{ fontSize: 'clamp(18px, 2.4vw, 32px)' }}>
            {slide.title}
          </div>
          <div className="mt-[4%] font-mono font-bold text-[#b45309]" style={{ fontSize: 'clamp(10px, 1.05vw, 15px)' }}>
            {slide.timeLabel}
          </div>
          <div className="mt-[3%] text-[#64748b]" style={{ fontSize: 'clamp(8px, 0.8vw, 12px)' }}>
            {slide.meta}
          </div>
        </div>

        <div className="absolute left-[3.4%] top-[24%] w-[35%] whitespace-pre-wrap text-[#334155]" style={{ fontSize: 'clamp(10px, 0.98vw, 15px)', lineHeight: 1.55 }}>
          {slide.notes || <span className="italic text-slate-400">No stage notes.</span>}
        </div>

        <div className="absolute bottom-[2.5%] left-[3.4%] font-mono text-[#94a3b8]" style={{ fontSize: 'clamp(7px, 0.62vw, 9px)' }}>
          {slide.footer}
        </div>

        {src ? (
          <img
            src={src}
            alt={`${stage.name} preview`}
            draggable={false}
            className="pointer-events-none absolute right-[2.6%] top-[5%] aspect-square w-[49.5%] select-none object-contain"
          />
        ) : (
          <div className="absolute right-[2.6%] top-[5%] flex aspect-square w-[49.5%] items-center justify-center bg-[#eef2f1] font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">
            Rendering preview
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded border border-white/15 bg-[#080d0a]/90 px-2 py-1.5 shadow-2xl">
          <button
            onClick={() => switchStage(-1)}
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
            onClick={() => switchStage(1)}
            disabled={stageIndex >= stages.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 disabled:opacity-25"
            title="Next stage"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
    </div>
  )
}

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

function slideTextColor(color: string): string {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return '#f8fafc'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0f172a' : '#f8fafc'
}

function RosterSlide({ plan, map, layer }: { plan: Plan; map: MapMeta; layer: LayerData }) {
  const squads = plan.roster.squads.slice(0, 9)
  const side = layer.factions[String(plan.side)]
  const rows = 9
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-0 top-0 h-[0.8%] bg-amber-400" />
      <div className="absolute left-[3.4%] top-[4.3%]">
        <div className="font-semibold leading-none text-[#0f172a]" style={{ fontSize: 'clamp(18px, 2.2vw, 30px)' }}>Roster</div>
        <div className="mt-[4%] text-[#64748b]" style={{ fontSize: 'clamp(8px, 0.8vw, 12px)' }}>
          {map.name} · {layer.displayName} · {side?.name ?? `Team ${plan.side}`}
        </div>
      </div>

      <div
        className="absolute bottom-[7%] left-[3.4%] right-[3.4%] top-[18%] grid overflow-hidden border border-[#cbd5e1]"
        style={{ gridTemplateColumns: `0.72fr repeat(${Math.max(1, squads.length)}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${rows}, minmax(0, 1fr))` }}
      >
        <div className="flex items-center justify-center bg-[#111827] px-1 font-mono text-[9px] font-bold text-[#fde68a]">CMD</div>
        {squads.map((squad, index) => (
          <div
            key={squad.id}
            className="flex min-w-0 items-center gap-1 border-l border-white/20 px-1 font-mono text-[9px] font-bold"
            style={{ background: squad.color, color: slideTextColor(squad.color) }}
          >
            {squad.name.toUpperCase()}
            <span className="ml-auto opacity-70">{squad.members.length}/9</span>
          </div>
        ))}
        {Array.from({ length: rows }).map((_, row) => (
          <div key={`row-${row}`} className="contents">
            <div className="flex items-center justify-center border-t border-[#e2e8f0] px-1 text-center text-[9px] text-[#0f172a]">
              {row === 0 ? plan.roster.commander?.name ?? '—' : ''}
            </div>
            {squads.map((squad) => (
              <div key={`${squad.id}-${row}`} className={`flex min-w-0 items-center border-l border-t border-[#e2e8f0] px-1 text-[9px] text-[#0f172a] ${row % 2 ? 'bg-[#f1f5f9]' : 'bg-white'}`}>
                <span className="truncate">{squad.members[row]?.name ?? ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="absolute bottom-[2.5%] left-[3.4%] font-mono text-[#94a3b8]" style={{ fontSize: 'clamp(7px, 0.62vw, 9px)' }}>
        {plan.operation} · roster
      </div>
    </div>
  )
}

function StageSlideType({ slide, src }: { slide: ReturnType<typeof stageSlideData>; src?: string }) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-0 top-0 h-[0.8%] bg-amber-400" />
      <div className="absolute left-[3.4%] top-[4.3%] w-[35%]">
        <div className="font-semibold leading-none text-[#0f172a]" style={{ fontSize: 'clamp(18px, 2.4vw, 32px)' }}>{slide.title}</div>
        <div className="mt-[4%] font-mono font-bold text-[#b45309]" style={{ fontSize: 'clamp(10px, 1.05vw, 15px)' }}>{slide.timeLabel}</div>
        <div className="mt-[3%] text-[#64748b]" style={{ fontSize: 'clamp(8px, 0.8vw, 12px)' }}>{slide.meta}</div>
      </div>
      <div className="absolute left-[3.4%] top-[24%] w-[35%] whitespace-pre-wrap text-[#334155]" style={{ fontSize: 'clamp(10px, 0.98vw, 15px)', lineHeight: 1.55 }}>
        {slide.notes || <span className="italic text-slate-400">No stage notes.</span>}
      </div>
      <div className="absolute bottom-[2.5%] left-[3.4%] font-mono text-[#94a3b8]" style={{ fontSize: 'clamp(7px, 0.62vw, 9px)' }}>{slide.footer}</div>
      {src ? (
        <img src={src} alt={`${slide.title} preview`} draggable={false} className="pointer-events-none absolute right-[2.6%] top-[5%] aspect-square w-[49.5%] select-none object-contain" />
      ) : (
        <div className="absolute right-[2.6%] top-[5%] flex aspect-square w-[49.5%] items-center justify-center bg-[#eef2f1] font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">
          Rendering preview
        </div>
      )}
    </div>
  )
}

export function PreviewBoard({ map, layer, plan, stage }: Props) {
  const planner = usePlanner()
  const ui = useUI()
  const assets = useAssets()
  const stages = [...plan.stages].sort((a, b) => a.time - b.time)
  const stageIndex = stages.findIndex((item) => item.id === stage.id)
  const stagePage = stageIndex + 1
  const [page, setPage] = useState(stagePage)
  const cacheKey = stagePreviewKey(plan, map, layer, stage, ui)
  const [images, setImages] = useState<Record<string, string>>({})
  const pending = useRef(new Set<string>())
  const wheelAt = useRef(0)

  useEffect(() => {
    setPage(stageIndex + 1)
  }, [stage.id])

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
  const pageCount = stages.length + 1

  const switchPage = (direction: -1 | 1) => {
    const next = Math.max(0, Math.min(pageCount - 1, page + direction))
    setPage(next)
    if (next > 0) planner.setActiveStage(stages[next - 1].id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      e.preventDefault()
      switchPage(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, stages])

  const pageName = page === 0 ? 'Roster' : stages[page - 1]?.name ?? stage.name
  const pageSub = page === 0
    ? `0 / ${stages.length}`
    : `${page} / ${stages.length} · ${formatTime(stages[page - 1]?.time ?? stage.time)}`

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#070b08] p-4"
      onWheel={(e) => {
        if (pageCount < 2) return
        e.preventDefault()
        const now = performance.now()
        if (now - wheelAt.current < 350) return
        wheelAt.current = now
        switchPage(e.deltaY > 0 ? 1 : -1)
      }}
    >
      <div className="relative aspect-video w-full max-w-[1280px] overflow-hidden bg-[#f8fafc] shadow-2xl">
        {page === 0 ? (
          <RosterSlide plan={plan} map={map} layer={layer} />
        ) : (
          <StageSlideType slide={slide} src={src} />
        )}
      </div>

      <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded border border-white/15 bg-[#080d0a]/90 px-2 py-1.5 shadow-2xl">
        <button
          onClick={() => switchPage(-1)}
          disabled={page <= 0}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 disabled:opacity-25"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-48 text-center">
          <div className="text-[12px] font-semibold text-slate-100">{pageName}</div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{pageSub}</div>
        </div>
        <button
          onClick={() => switchPage(1)}
          disabled={page >= pageCount - 1}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 disabled:opacity-25"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

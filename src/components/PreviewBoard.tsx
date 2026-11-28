import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { useAssets } from '../lib/assets'
import { GameIcon } from '../lib/gameIcons'
import { formatTime } from '../lib/utils'
import { stageSlideData } from '../lib/slide'
import { parseOrders } from '../lib/orders'
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
  const assignments = plan.roster.specialistAssignments ?? {}
  const kitCounts = Object.values(assignments)
    .flatMap((value) => (Array.isArray(value) ? value : [value as unknown as string]))
    .reduce<Record<string, number>>((acc, kit) => {
      acc[kit] = (acc[kit] ?? 0) + 1
      return acc
    }, {})
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-0 top-0 h-[0.8%] bg-amber-400" />
      <div className="absolute left-[3.4%] top-[3%]">
        <div className="font-semibold leading-none text-[#0f172a]" style={{ fontSize: 'clamp(16px, 1.9vw, 26px)' }}>Roster</div>
        <div className="mt-[3%] text-[#64748b]" style={{ fontSize: 'clamp(7px, 0.68vw, 10px)' }}>
          {map.name} · {layer.displayName} · {side?.name ?? `Team ${plan.side}`} · CMD {plan.roster.commander?.name ?? '—'}
        </div>
      </div>

      <div className="absolute bottom-[6%] left-[3.4%] right-[3.4%] top-[16%] grid grid-cols-5 grid-rows-2 gap-1.5">
        {Array.from({ length: 10 }).map((_, slot) => {
          if (slot === 9) {
            return (
              <div key="specialists" className="flex min-h-0 flex-col overflow-hidden rounded border border-[#cbd5e1] bg-white">
                <div className="bg-[#111827] px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-[#fde68a]">Specialist kits</div>
                <div className="flex min-h-0 flex-1 flex-col justify-center px-1 py-0.5">
                  {Object.entries(kitCounts).map(([kit, count]) => (
                    <div key={kit} className="flex justify-between font-mono text-[7px] text-[#334155]">
                      <span className="truncate">{kit.toUpperCase()}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                  {Object.keys(kitCounts).length === 0 && <span className="text-[7px] italic text-slate-400">None assigned</span>}
                </div>
              </div>
            )
          }
          const squad = squads[slot]
          if (!squad) return <div key={`empty-${slot}`} />
          return (
            <div key={squad.id} className="flex min-h-0 flex-col overflow-hidden rounded border border-[#cbd5e1] bg-white">
              <div
                className="flex items-center gap-1 px-1 py-0.5 font-mono text-[8px] font-bold"
                style={{ background: squad.color, color: slideTextColor(squad.color) }}
              >
                <span className="truncate">{squad.name.toUpperCase()}</span>
                <span className="ml-auto opacity-70">{squad.members.length}/8</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-1 py-0.5">
                {squad.members.map((member, index) => (
                  <div key={member.id} className="flex min-w-0 items-center gap-1 text-[7px] leading-[1.35] text-[#0f172a]">
                    {(index === 0 || index === 1) && (
                      <span className="shrink-0 rounded border border-[#cbd5e1] px-0.5 font-mono text-[6px] font-bold text-[#475569]">
                        {index === 0 ? 'SL' : '2IC'}
                      </span>
                    )}
                    <span className="truncate">{member.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-[2%] left-[3.4%] font-mono text-[#94a3b8]" style={{ fontSize: 'clamp(7px, 0.62vw, 9px)' }}>
        {plan.operation} · roster
      </div>
    </div>
  )
}

function OrdersText({ text, plan, assets }: { text: string; plan: Plan; assets: ReturnType<typeof useAssets> }) {
  return (
    <>
      {parseOrders(text).map((segment, index) => {
        if (segment.type === 'text') return <span key={index}>{segment.text}</span>
        if (segment.type === 'cmd') {
          return (
            <span
              key={index}
              title="Commander"
              className="mx-0.5 inline-flex h-[1.35em] w-[1.35em] -translate-y-[0.15em] items-center justify-center align-middle"
            >
              {assets.commander && <GameIcon path={assets.commander} size={16} />}
            </span>
          )
        }
        const squadIndex = plan.roster.squads.findIndex((squad) => squad.id === segment.squadId)
        const squad = plan.roster.squads[squadIndex]
        if (!squad) return <span key={index}>SQUAD</span>
        return (
          <span
            key={index}
            title={squad.name}
            className="mx-0.5 inline-flex h-[1.35em] w-[1.35em] -translate-y-[0.15em] items-center justify-center align-middle"
          >
            {assets.squads[String(squadIndex + 1)] && (
              <GameIcon path={assets.squads[String(squadIndex + 1)]} tint={squad.color} size={16} />
            )}
          </span>
        )
      })}
    </>
  )
}

function StageSlideType({ slide, src, plan, assets }: {
  slide: ReturnType<typeof stageSlideData>
  src?: string
  plan: Plan
  assets: ReturnType<typeof useAssets>
}) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-0 top-0 h-[0.8%] bg-amber-400" />
      <div className="absolute left-[3.4%] top-[4.3%] w-[35%]">
        <div className="font-semibold leading-none text-[#0f172a]" style={{ fontSize: 'clamp(18px, 2.4vw, 32px)' }}>{slide.title}</div>
        <div className="mt-[4%] font-mono font-bold text-[#b45309]" style={{ fontSize: 'clamp(10px, 1.05vw, 15px)' }}>{slide.timeLabel}</div>
        <div className="mt-[3%] text-[#64748b]" style={{ fontSize: 'clamp(8px, 0.8vw, 12px)' }}>{slide.meta}</div>
      </div>
      <div className="absolute left-[3.4%] top-[24%] max-h-[64%] w-[35%] overflow-hidden whitespace-pre-wrap break-words pr-2 text-[#334155]" style={{ fontSize: 'clamp(10px, 0.98vw, 15px)', lineHeight: 1.55 }}>
        {slide.notes ? <OrdersText text={slide.notes} plan={plan} assets={assets} /> : <span className="italic text-slate-400">No stage notes.</span>}
      </div>
      <div className="absolute bottom-[2.5%] left-[3.4%] font-mono text-[#94a3b8]" style={{ fontSize: 'clamp(7px, 0.62vw, 9px)' }}>{slide.footer}</div>
      {src ? (
        <img src={src} alt={`${slide.title} preview`} draggable={false} className="pointer-events-none absolute right-[1.3%] top-[2%] aspect-square w-[53%] select-none object-contain" />
      ) : (
        <div className="absolute right-[1.3%] top-[2%] flex aspect-square w-[53%] items-center justify-center bg-[#eef2f1] font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">
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
  const [preview, setPreview] = useState<{ key: string; data: string } | null>(null)
  const pending = useRef(new Set<string>())
  const wheelAt = useRef(0)

  useEffect(() => {
    setPage(stageIndex + 1)
  }, [stage.id])

  useEffect(() => {
    const cached = getStagePreview(cacheKey)
    if (cached) {
      setPreview({ key: cacheKey, data: cached })
      return
    }
    if (pending.current.has(cacheKey)) return
    pending.current.add(cacheKey)
    captureStageDataUrl({ map, layer, plan, assets }, stage, 2048, 'png')
      .then((src) => {
        setStagePreview(cacheKey, src)
        setPreview({ key: cacheKey, data: src })
      })
      .catch((err) => console.error(err))
      .finally(() => {
        pending.current.delete(cacheKey)
      })
  }, [assets, cacheKey, layer, map, plan, stage])

  const src = preview?.key === cacheKey ? preview.data : getStagePreview(cacheKey)
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
          <StageSlideType slide={slide} src={src} plan={plan} assets={assets} />
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

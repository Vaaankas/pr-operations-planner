import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { useAssets } from '../lib/assets'
import { GameIcon } from '../lib/gameIcons'
import { formatTime } from '../lib/utils'
import { layerDisplayName } from '../lib/layerLabels'
import { stageSlideData } from '../lib/slide'
import { buildRosterView, type RosterViewMember, type RosterViewSquad } from '../lib/rosterView'
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

function RosterMemberLine({ member }: { member: RosterViewMember }) {
  const status = member.state === 'confirmed'
    ? <span className="text-[9px] font-bold text-emerald-600">✓</span>
    : member.state === 'uncertain'
      ? <span className="text-[9px] font-bold text-amber-600">?</span>
      : <span className="w-[8px]" />
  return (
    <div className="flex min-w-0 items-center gap-1 border-t border-[#e2e8f0] px-1 py-[2px] text-[10px] leading-[1.3]">
      <span className="flex w-[19px] shrink-0 justify-center border border-[#cbd5e1] font-mono text-[7px] font-bold text-[#475569]">
        {member.role ?? ''}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-[#0f172a]" title={member.name}>{member.name}</span>
      {member.kit && <span className="shrink-0 border border-[#cbd5e1] px-0.5 font-mono text-[7px] font-bold text-[#475569]" title={member.kitName}>{member.kit}</span>}
      {status}
    </div>
  )
}

function RosterSquadCard({ squad }: { squad: RosterViewSquad }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden border border-[#cbd5e1] bg-white">
      <div
        className="flex items-center gap-1 px-1 py-1.5 font-mono text-[10px] font-bold"
        style={{ background: squad.color, color: slideTextColor(squad.color) }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center border border-current/40 text-[8px]">{squad.number}</span>
        <span className="min-w-0 flex-1 truncate">{squad.name}</span>
        {squad.kits.length > 0 && <span className="shrink-0 text-[7px] opacity-75">{squad.kits.join(" ")}</span>}
        <span className="shrink-0 text-[8px] opacity-80">{squad.type}</span>
        <span className={`shrink-0 text-[9px] ${squad.members.length > 8 ? 'text-amber-200' : 'opacity-80'}`}>
          {squad.members.length}{squad.hiddenMembers ? `+${squad.hiddenMembers}` : ''}/8
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {squad.members.map((member) => <RosterMemberLine key={member.id} member={member} />)}
        {squad.members.length === 0 && <div className="px-1 py-1 text-[9px] italic text-[#94a3b8]">Empty squad</div>}
        {squad.vehicles.slice(0, 2).map((vehicle) => (
          <div key={vehicle.id} className="flex min-w-0 items-center gap-1 border-t border-[#e2e8f0] px-1 py-[1px] text-[7.5px] text-[#475569]">
            <span className="shrink-0 font-bold">▣</span>
            <span className="min-w-0 flex-1 truncate">{vehicle.label}</span>
            {vehicle.crew.length > 0 && <span className="max-w-[42%] truncate text-[#64748b]">{vehicle.crew.join(', ')}</span>}
          </div>
        ))}
        {squad.vehicles.length > 2 && <div className="px-1 text-[7.5px] text-[#64748b]">+{squad.vehicles.length - 2} more assets</div>}
      </div>
    </div>
  )
}

function RosterSlide({ plan, map, layer }: { plan: Plan; map: MapMeta; layer: LayerData }) {
  const view = buildRosterView(plan, map, layer)
  const reserves = view.reserves.slice(0, 14)
  return (
    <div className="relative h-full w-full bg-white">
      <div className="absolute inset-x-0 top-0 h-[0.8%] bg-amber-400" />
      <div className="absolute left-[3.4%] top-[3%] w-[64%]">
        <div className="font-semibold leading-none text-[#0f172a]" style={{ fontSize: 'clamp(20px, 2.1vw, 30px)' }}>Roster</div>
        <div className="mt-[2%] text-[#64748b]" style={{ fontSize: 'clamp(8px, 0.72vw, 10px)' }}>{view.meta}</div>
      </div>
      <div className="absolute right-[3.4%] top-[3.2%] text-right font-mono text-[#475569]" style={{ fontSize: 'clamp(8px, 0.72vw, 10px)' }}>
        <div><span className="font-bold text-[#0f172a]">{view.total}</span>/50 players</div>
        <div className="mt-0.5"><span className="font-bold text-emerald-600">{view.confirmed}</span> confirmed · <span className="font-bold text-amber-600">{view.uncertain}</span> uncertain</div>
      </div>

      <div className="absolute bottom-[6%] left-[3.4%] right-[30.5%] top-[16%] grid grid-cols-3 grid-rows-3 gap-1.5">
        {view.squads.map((squad) => <RosterSquadCard key={squad.id} squad={squad} />)}
      </div>

      <div className="absolute bottom-[6%] left-[71%] right-[3.4%] top-[16%] flex flex-col gap-1.5">
        <div className="shrink-0 border border-[#cbd5e1] bg-white">
          <div className="bg-[#111827] px-1.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#fde68a]">Commander</div>
          {view.commander ? (
            <div className="px-1.5 py-1">
              <div className="flex items-center gap-1 text-[12px] font-semibold text-[#0f172a]">
                <span className="min-w-0 flex-1 truncate">{view.commander.name}</span>
                {view.commander.kit && <span className="border border-[#cbd5e1] px-0.5 font-mono text-[7.5px] text-[#475569]">{view.commander.kit}</span>}
                {view.commander.state === 'confirmed' && <span className="text-[9px] font-bold text-emerald-600">✓</span>}
                {view.commander.state === 'uncertain' && <span className="text-[9px] font-bold text-amber-600">?</span>}
              </div>
              <div className="mt-0.5 font-mono text-[8px] text-[#64748b]">CMD</div>
            </div>
          ) : <div className="px-1.5 py-2 text-[9px] italic text-[#94a3b8]">Not assigned</div>}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[#cbd5e1] bg-white">
          <div className="shrink-0 bg-[#111827] px-1.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#fde68a]">Specialist kits</div>
          <div className="min-h-0 flex-1 overflow-hidden px-1.5 py-1">
            {view.kits.map((kit) => (
              <div key={kit.id} className="flex items-center gap-1 border-b border-[#e2e8f0] py-[1.5px] font-mono text-[9px] text-[#334155]">
                <span className="min-w-0 flex-1 truncate">{kit.name}</span>
                <span className={kit.count > kit.limit ? 'font-bold text-rose-600' : kit.count ? 'font-bold text-amber-600' : 'text-[#94a3b8]'}>{kit.count}/{kit.limit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[#cbd5e1] bg-white">
          <div className="flex shrink-0 items-center bg-[#111827] px-1.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#fde68a]">
            <span>Reserves</span><span className="ml-auto">{view.reserves.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-1.5 py-1">
            {reserves.map((member) => (
              <div key={member.id} className="flex items-center gap-1 border-b border-[#e2e8f0] py-[1.5px] text-[10px] text-[#334155]">
                <span className="min-w-0 flex-1 truncate">{member.name}</span>
                {member.kit && <span className="font-mono text-[8px] text-[#64748b]">{member.kit}</span>}
              </div>
            ))}
            {view.reserves.length === 0 && <div className="py-1 text-[9px] italic text-[#94a3b8]">None</div>}
            {view.reserves.length > reserves.length && <div className="pt-1 font-mono text-[7px] text-[#64748b]">+{view.reserves.length - reserves.length} more</div>}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2%] left-[3.4%] right-[3.4%] flex items-center justify-between font-mono text-[#94a3b8]" style={{ fontSize: 'clamp(7px, 0.62vw, 9px)' }}>
        <span>{plan.operation} · roster</span>
        <span>{view.extraSquads ? `+${view.extraSquads} squads not shown` : 'PR Operations Planner'}</span>
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

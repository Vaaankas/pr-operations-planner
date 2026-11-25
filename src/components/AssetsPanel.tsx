import { useMemo, useState } from 'react'
import { Crosshair, Eye, EyeOff, RotateCcw, Search } from 'lucide-react'
import type { LayerData, Plan, Stage } from '../types'
import { usePlanner, useUI } from '../store'
import { formatTime } from '../lib/utils'
import { vehicleColor } from '../lib/render'
import { cpFlag, useAssets } from '../lib/assets'
import { GameIcon } from '../lib/gameIcons'

interface Props {
  layer: LayerData
  plan: Plan
  stage: Stage
}

const ORDER = [
  'mbt', 'ifv', 'apc', 'recon', 'jeep', 'logistics', 'aa', 'artillery',
  'transport_heli', 'attack_heli', 'jet', 'bomber', 'boat', 'carrier',
  'emplacement', 'asset', 'crate', 'other',
]

export function AssetsPanel({ layer, plan, stage }: Props) {
  const planner = usePlanner()
  const ui = useUI()
  const assets = useAssets()
  const [query, setQuery] = useState('')
  const [startOnly, setStartOnly] = useState(false)

  const vehicles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return layer.vehicles
      .filter((v) => (startOnly ? v.atStart : true))
      .filter((v) => (ui.showAssets ? true : !['asset', 'crate', 'emplacement'].includes(v.category)))
      .filter((v) => (ui.showEnemy ? true : v.team === plan.side || v.team === null))
      .filter((v) => !q || `${v.label} ${v.template} ${v.category}`.toLowerCase().includes(q))
      .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))
  }, [layer.vehicles, query, startOnly, ui.showAssets, ui.showEnemy, plan.side])

  const teamGroups = useMemo(() => {
    const order = [plan.side, null, plan.side === 1 ? 2 : 1] as (number | null)[]
    return order
      .map((team) => ({
        team,
        list: vehicles
          .filter((v) => (team === null ? v.team === null : v.team === team))
          .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category)),
      }))
      .filter((g) => g.list.length > 0)
  }, [vehicles, plan.side])

  const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))
  const startCount = layer.vehicles.filter((v) => v.atStart).length

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">Asset manifest</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">{startCount} at start</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter assets…"
              className="w-full rounded border border-white/10 bg-black/30 py-1 pl-7 pr-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={() => setStartOnly(!startOnly)}
            className={`rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${startOnly ? 'border-amber-400/50 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-500'}`}
            title="Only assets present at round start"
          >
            Start
          </button>
          <button onClick={() => ui.toggle('showAssets')} className={`rounded border p-1 ${ui.showAssets ? 'border-white/20 text-slate-300' : 'border-white/10 text-slate-600'}`} title="Show static assets and emplacements">
            {ui.showAssets ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {teamGroups.map(({ team, list }, groupIndex) => {
          const faction = team ? layer.factions[String(team)] : null
          const flag = cpFlag(assets, faction?.key)
          const label = team === plan.side ? 'Friendly' : team ? 'Enemy' : 'Neutral'
          const color = team === plan.side ? '#38bdf8' : team ? '#f87171' : '#fbbf24'
          return (
          <div key={`${team ?? 'neutral'}-${groupIndex}`} className="mb-3">
            <div className="mb-1 flex items-center gap-1.5 border-b border-white/10 px-1 pb-1">
              {flag ? <img src={`./data/${flag}`} alt="" className="h-3 w-4 object-contain" /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color }}>{label}</span>
              {faction && <span className="text-[10px] text-slate-500">{faction.name}</span>}
              <span className="ml-auto font-mono text-[10px] text-slate-600">{list.length}</span>
            </div>
            <div className="space-y-0.5">
              {list.map((v) => {
                const selected = ui.selectedId === `veh_${v.id}`
                const color = vehicleColor(v, plan, squadColors)
                const moved = Boolean(stage.moves[v.id])
                const squadId = plan.claims[v.id] ?? ''
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      if (ui.tool !== 'select') ui.setTool('select')
                      ui.setSelected(`veh_${v.id}`, 'vehicle')
                      ui.setRightTab('assets')
                    }}
                    className={`group flex cursor-pointer items-center gap-1.5 rounded border px-1.5 py-1 ${selected ? 'border-amber-400/60 bg-amber-400/10' : 'border-transparent hover:border-white/10 hover:bg-white/5'}`}
                    title={v.template}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-black/40" style={{ border: `1px solid ${color}66` }}>
                      <GameIcon path={assets.vehicles[v.icon] ?? assets.vehicles[v.category]} tint={color} size={24} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[12.5px] font-medium text-slate-200">{v.label}</span>
                        {!v.atStart && <span className="shrink-0 rounded bg-black/50 px-1 font-mono text-[9px] text-slate-400">{formatTime(v.respawn ?? 0)}</span>}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-slate-500">
                        <span>{v.team === plan.side ? 'friendly' : v.team ? 'enemy' : 'neutral'}</span>
                        {moved && (
                          <span className="flex items-center gap-0.5 text-amber-400/80">
                            <button
                              onClick={(e) => { e.stopPropagation(); ui.toggleVehiclePath(v.id) }}
                              className="text-slate-500 hover:text-amber-300"
                              title={ui.hiddenVehiclePaths.includes(v.id) ? 'Show vehicle path' : 'Hide vehicle path'}
                            >
                              {ui.hiddenVehiclePaths.includes(v.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                            <span>moved</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); planner.clearVehicleMove(v.id) }}
                              className="text-slate-500 hover:text-amber-300"
                              title="Return to previous stage (first stage: spawn)"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    {v.team === plan.side && (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Squad:</span>
                        <select
                          value={squadId}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => planner.claimVehicle(v.id, e.target.value || null)}
                          className="max-w-[86px] rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-slate-300 outline-none"
                          title="Assign to squad"
                        >
                          <option value="">—</option>
                          {plan.roster.squads.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          </div>
          )
        })}
        {teamGroups.length === 0 && <div className="mt-10 text-center text-xs text-slate-600">No assets match.</div>}
      </div>
    </div>
  )
}

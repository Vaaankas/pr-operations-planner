import { Eye, EyeOff } from 'lucide-react'
import { usePlanner, useUI } from '../store'
import type { LayerData, Plan } from '../types'
import { factionFlag, useAssets } from '../lib/assets'
import { captureTeam, isCapturable, teamName } from '../lib/flags'
import { groupRoute } from '../lib/routes'
import { dataUrl } from '../lib/utils'

export const ROUTE_COLORS = ['#38bdf8', '#fb923c', '#a78bfa', '#34d399', '#f472b6', '#facc15']

export function routeColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length]
}

export function RoutesPanel({ layer, plan }: { layer: LayerData; plan: Plan }) {
  const ui = useUI()
  const planner = usePlanner()
  const assets = useAssets()
  const routes = layer.routes ?? []
  const visible = routes.filter((r) => ui.visibleRoutes.includes(r.id))
  const allVisible = routes.length > 0 && visible.length === routes.length

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-1">
          {routes.map((r, i) => {
            const color = routeColor(i)
            const checked = ui.visibleRoutes.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => ui.toggleRoute(r.id)}
                className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-left ${
                  checked ? 'border-white/25 bg-white/5' : 'border-white/5 hover:border-white/15'
                }`}
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center"
                  style={{ color: checked ? color : undefined }}
                  title={checked ? 'Hide route' : 'Show route'}
                >
                  {checked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-slate-600" />}
                </span>
                <span className="h-0.5 w-6 rounded" style={{ background: color }} />
                <span className={`text-[12px] font-medium ${checked ? 'text-slate-100' : 'text-slate-400'}`}>{r.label}</span>
                <span className="ml-auto font-mono text-[10px] text-slate-500">{r.cps.length} flags</span>
              </button>
            )
          })}
          {routes.length > 1 && (
            <button
              onClick={() => ui.setAllRoutes(routes.map((r) => r.id), !allVisible)}
              className="mt-1 w-full rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400 hover:border-white/20 hover:text-slate-200"
            >
              {allVisible ? 'Hide all routes' : 'Show all routes'}
            </button>
          )}
        </div>

        {visible.map((r) => {
          const index = routes.findIndex((x) => x.id === r.id)
          return (
            <div key={r.id} className="mt-4">
              <div className="mb-1.5 flex items-center gap-2 pl-2 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                {r.label}
              </div>
              <div className="space-y-1">
                {groupRoute(layer, r).flatMap((group) =>
                  group.cps.map((cp) => {
                    const id = cp.id
                    const shown = !ui.hiddenCps.includes(id)
                    const team = captureTeam(plan, cp)
                    const faction = team ? layer.factions[String(team)] : null
                    const flag = factionFlag(assets, faction?.key)
                    const capturable = isCapturable(cp)
                    return (
                      <div key={`${r.id}-${id}-${group.number}`} className="flex items-center gap-1.5 pl-5 text-[11px] text-slate-400">
                        <button
                          type="button"
                          onClick={() => ui.toggleCp(id)}
                          className="flex h-4 w-4 shrink-0 items-center justify-center"
                          style={{ color: shown ? routeColor(index) : undefined }}
                          title={shown ? 'Hide this flag' : 'Show this flag'}
                        >
                          {shown ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-slate-600" />}
                        </button>
                        <span className="w-4 shrink-0 text-right font-mono text-[10px] text-slate-600">{group.number}</span>
                        <span className={`max-w-[128px] truncate ${shown ? '' : 'line-through opacity-40'}`}>{cp.name}</span>
                        {cp.radius > 0 && <span className="shrink-0 font-mono text-[9px] text-slate-500">{Math.round(cp.radius)}m</span>}
                        {capturable ? (
                          <button
                            onClick={() => planner.cycleFlagTeam(cp.id, team)}
                            className="ml-auto flex shrink-0 items-center gap-1 rounded border border-white/10 px-1 py-0.5 text-[9px] text-slate-400 hover:border-amber-400/40 hover:text-amber-300"
                            title={`${cp.name}: ${teamName(layer, team)}. Capture loss ${layer.tickets?.loss ?? 30} tickets. Click to cycle neutral/faction.`}
                          >
                            {flag ? <img src={dataUrl(flag)} alt="" className="h-3 w-4 object-fill" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />}
                            <span className="max-w-14 truncate">{faction?.short ?? 'NEU'}</span>
                          </button>
                        ) : (
                          <span
                            className="ml-auto flex shrink-0 items-center gap-1 rounded border border-white/5 px-1 py-0.5 text-[9px] text-slate-500"
                            title={`${cp.name}: deployment flag, uncapturable`}
                          >
                            {flag ? <img src={dataUrl(flag)} alt="" className="h-3 w-4 object-fill" /> : null}
                            <span className="max-w-14 truncate">FIXED</span>
                          </span>
                        )}
                      </div>
                    )
                  }),
                )}
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}

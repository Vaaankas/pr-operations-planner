import { useUI } from '../store'
import type { LayerData } from '../types'
import { Eye, EyeOff, Route } from 'lucide-react'

export const ROUTE_COLORS = ['#38bdf8', '#fb923c', '#a78bfa', '#34d399', '#f472b6', '#facc15']

export function routeColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length]
}

export function RoutesPanel({ layer }: { layer: LayerData }) {
  const ui = useUI()
  const routes = layer.routes ?? []
  const cps = new Map(layer.controlPoints.map((c) => [c.id, c]))
  const visible = routes.filter((r) => ui.visibleRoutes.includes(r.id))
  const allVisible = routes.length > 0 && visible.length === routes.length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Route className="h-3.5 w-3.5 text-amber-400" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">Attack routes</span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{visible.length}/{routes.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {routes.map((r, i) => {
            const color = routeColor(i)
            const checked = ui.visibleRoutes.includes(r.id)
            return (
              <label
                key={r.id}
                className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-2 ${
                  checked ? 'border-white/25 bg-white/5' : 'border-white/5 hover:border-white/15'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => ui.toggleRoute(r.id)}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                <span className="h-0.5 w-6 rounded" style={{ background: color }} />
                <span className={`text-[12px] font-medium ${checked ? 'text-slate-100' : 'text-slate-400'}`}>{r.label}</span>
                <span className="ml-auto font-mono text-[10px] text-slate-500">{r.cps.length} flags</span>
              </label>
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
              <div className="mb-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: routeColor(index) }} />
                {r.label}
              </div>
              <div className="space-y-1">
                {r.cps.map((id, i) => {
                  const cp = cps.get(id)
                  if (!cp) return null
                  const shown = !ui.hiddenCps.includes(id)
                  return (
                    <label key={`${r.id}-${id}-${i}`} className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={shown}
                        onChange={() => ui.toggleCp(id)}
                        className="h-3 w-3 accent-amber-400"
                        title="Render this flag on the map"
                      />
                      <span className="w-4 text-right font-mono text-[10px] text-slate-600">{i + 1}</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: routeColor(index) }} />
                      <span className={`truncate ${shown ? '' : 'line-through opacity-40'}`}>{cp.name}</span>
                      {cp.radius > 0 && <span className="ml-auto font-mono text-[9px] text-slate-600">{Math.round(cp.radius)}m</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="mt-4">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Map layers</div>
          <div className="space-y-1">
            <LayerToggle label="Vehicles" value={ui.showVehicles} onClick={() => ui.toggle('showVehicles')} />
            <LayerToggle label="Enemy assets" value={ui.showEnemy} onClick={() => ui.toggle('showEnemy')} />
            <LayerToggle label="Flags" value={ui.showFlags} onClick={() => ui.toggle('showFlags')} />
            <LayerToggle label="Static assets" value={ui.showAssets} onClick={() => ui.toggle('showAssets')} />
            <LayerToggle label="Labels" value={ui.showLabels} onClick={() => ui.toggle('showLabels')} />
          </div>
        </div>
      </div>
    </div>
  )
}

function LayerToggle({ label, value, onClick }: { label: string; value: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded px-1 py-1 text-[10px] text-slate-400 hover:bg-white/5">
      <span>{label}</span>
      <span className="ml-auto">{value ? <Eye className="h-3 w-3 text-slate-500" /> : <EyeOff className="h-3 w-3 text-slate-700" />}</span>
    </button>
  )
}

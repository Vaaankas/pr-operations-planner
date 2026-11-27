import { useCallback, useEffect, useRef, useState } from 'react'
import { Boxes, Crosshair, Loader2, Map as MapIcon, AlertTriangle, Route as RouteIcon } from 'lucide-react'
import type { AssetManifest, LayerData, LayerRef, MapIndex, MapMeta, Team } from './types'
import { makePlan, loadStoredPlan, storePlan, usePlanner, useUI } from './store'
import { dataUrl, DEFAULT_STAGE_VISIBILITY } from './lib/utils'
import { AssetProvider } from './lib/assets'
import { Picker } from './components/Picker'
import { Header } from './components/Header'
import { ToolbarRail, ToolbarHistory, OptionsBar, useToolHotkeys } from './components/Toolbar'
import { MapBoard } from './components/MapBoard'
import { PreviewBoard } from './components/PreviewBoard'
import { RosterBoard } from './components/RosterBoard'
import { AssetsPanel } from './components/AssetsPanel'
import { StagePanel } from './components/StagePanel'
import { RoutesPanel } from './components/RoutesPanel'
import { Timeline } from './components/Timeline'
import { ExportDialog } from './components/ExportDialog'
import { HelpDialog } from './components/HelpDialog'

const EMPTY_ASSETS: AssetManifest = { factionFlags: {}, cpFlags: {}, scoreFlags: {}, vehicles: {}, squads: {}, commander: '', markers: {}, orders: {} }

export function App() {
  const [assets, setAssets] = useState<AssetManifest>(EMPTY_ASSETS)
  useEffect(() => {
    fetch(dataUrl('assets.json'))
      .then((r) => (r.ok ? r.json() : EMPTY_ASSETS))
      .then(setAssets)
      .catch(() => setAssets(EMPTY_ASSETS))
  }, [])
  return (
    <AssetProvider value={assets}>
      <AppInner />
    </AssetProvider>
  )
}

function AppInner() {
  const [index, setIndex] = useState<MapIndex | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [layer, setLayer] = useState<LayerData | null>(null)
  const [layerLoading, setLayerLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const plan = usePlanner((s) => s.plan)
  const ui = useUI()
  const cache = useRef(new Map<string, LayerData>())

  useEffect(() => {
    if (!plan || ui.view !== 'plan' || ui.mode === 'preview' || ui.exportOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      const stages = [...plan.stages].sort((a, b) => a.time - b.time)
      if (stages.length < 2) return
      const index = stages.findIndex((item) => item.id === plan.activeStageId)
      if (index < 0) return
      const next = e.key === 'ArrowRight'
        ? (index + 1) % stages.length
        : (index - 1 + stages.length) % stages.length
      e.preventDefault()
      usePlanner.getState().setActiveStage(stages[next].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plan, ui.exportOpen, ui.mode, ui.view])
  const booted = useRef(false)

  useToolHotkeys()

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const stored = loadStoredPlan()
    if (stored) usePlanner.getState().setPlan(stored)
  }, [])

  useEffect(() => {
    fetch(dataUrl('index.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`index.json ${r.status}`)
        return r.json()
      })
      .then(setIndex)
      .catch((err) => setLoadError(`Map data could not be loaded. ${err instanceof Error ? err.message : ''}`))
  }, [])

  const map = index && plan ? index.maps.find((m) => m.id === plan.mapId) ?? null : null

  useEffect(() => {
    if (!index || !plan) return
    const entry = index.maps.find((m) => m.id === plan.mapId)
    if (!entry) {
      setLoadError(`Map "${plan.mapId}" is not in this build.`)
      return
    }
    const ref = entry.layers.find((l) => l.id === plan.layerId)
    if (!ref?.file) {
      setLoadError(`Layer "${plan.layerId}" is not in this build.`)
      return
    }
    const applyLayer = (data: LayerData) => {
      setLayer(data)
      useUI.getState().setVisibleRoutes((data.routes ?? []).map((route) => route.id))
      useUI.setState({ hiddenCps: [] })
    }
    if (cache.current.has(plan.layerId)) {
      applyLayer(cache.current.get(plan.layerId)!)
      return
    }
    setLayerLoading(true)
    fetch(dataUrl(`layers/${ref.file}`))
      .then((r) => {
        if (!r.ok) throw new Error(`layer ${r.status}`)
        return r.json()
      })
      .then((data: LayerData) => {
        cache.current.set(data.id, data)
        applyLayer(data)
        setLayerLoading(false)
      })
      .catch((err) => {
        setLayerLoading(false)
        setLoadError(`Layer data could not be loaded. ${err instanceof Error ? err.message : ''}`)
      })
  }, [index, plan?.mapId, plan?.layerId])

  useEffect(() => {
    if (!plan) return
    const timer = setTimeout(() => storePlan(plan), 350)
    const flush = () => {
      const current = usePlanner.getState().plan
      if (current) storePlan(current)
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [plan])

  useEffect(() => {
    if (!plan) return
    if (!plan.stages.some((s) => s.id === plan.activeStageId) && plan.stages[0]) {
      usePlanner.getState().setActiveStage(plan.stages[0].id)
    }
  }, [plan])

  useEffect(() => {
    if (!plan) return
    const active = plan.stages.find((s) => s.id === plan.activeStageId)
    const visibility = { ...DEFAULT_STAGE_VISIBILITY, ...(active?.visibility ?? {}) }
    useUI.setState({
      showVehicles: visibility.showVehicles,
      showEnemy: visibility.showEnemy,
      showFlags: visibility.showFlags,
      showLabels: visibility.showLabels,
      showDrawings: visibility.showDrawings,
      showVehicleNames: visibility.showVehicleNames,
      showVehiclePaths: visibility.showVehiclePaths,
      iconSize: active?.iconSize ?? 1,
      visibleRoutes: active?.visibleRoutes ?? (layer?.routes ?? []).map((route) => route.id),
      hiddenCps: active?.hiddenCps ?? [],
      startingOnly: active?.startingOnly ?? false,
    })
  }, [plan?.activeStageId, plan?.stages, layer?.id, layer?.routes])

  const startPlan = useCallback(async (nextMap: MapMeta, ref: LayerRef, side: Team) => {
    if (plan) {
      const ok = window.confirm(`Start a new operation on ${nextMap.name}? The current plan "${plan.operation}" will be replaced.`)
      if (!ok) return
    }
    if (!ref.file) return
    try {
      let data = cache.current.get(ref.id)
      if (!data) {
        const res = await fetch(dataUrl(`layers/${ref.file}`))
        if (!res.ok) throw new Error(`layer ${res.status}`)
        data = (await res.json()) as LayerData
        cache.current.set(data.id, data)
      }
      const next = makePlan(nextMap, data, side)
      setLayer(data)
      useUI.getState().setVisibleRoutes((data.routes ?? []).map((route) => route.id))
      useUI.setState({ hiddenCps: [] })
      useUI.getState().setView('plan')
      usePlanner.getState().setPlan(next)
      setPickerOpen(false)
      setLoadError(null)
    } catch (err) {
      setLoadError(`Could not open ${nextMap.name}. ${err instanceof Error ? err.message : ''}`)
    }
  }, [plan])

  const reset = () => {
    if (!window.confirm('Discard the current operation? This removes it from this browser.')) return
    usePlanner.getState().resetAll()
    setLayer(null)
    setPickerOpen(false)
  }

  if (loadError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#070b08] p-6">
        <div className="max-w-lg rounded-lg border border-rose-500/30 bg-rose-500/5 p-6">
          <div className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest">Load failure</span>
          </div>
          <p className="mt-3 text-sm text-slate-300">{loadError}</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => window.location.reload()} className="rounded bg-amber-400 px-3 py-1.5 text-xs font-bold text-black">Reload</button>
            <button
              onClick={() => {
                usePlanner.getState().setPlan(null)
                setLoadError(null)
              }}
              className="rounded border border-white/15 px-3 py-1.5 text-xs text-slate-300"
            >
              Dismiss plan
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!index) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#070b08]">
        <Crosshair className="h-8 w-8 animate-pulse text-amber-400" />
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-500">Loading theatre data</div>
        <div className="h-0.5 w-40 overflow-hidden rounded bg-white/10">
          <div className="scanline h-full w-1/2 bg-amber-400" />
        </div>
      </div>
    )
  }

  if (!plan) {
    return <Picker index={index} onStart={startPlan} />
  }

  if (!map) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <div className="text-sm text-slate-400">Map data missing. <button className="text-amber-400 underline" onClick={reset}>Discard plan</button></div>
      </div>
    )
  }

  if (layerLoading || !layer) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-[#070b08]">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Loading {map.name} layer</div>
      </div>
    )
  }

  const stage = plan.stages.find((s) => s.id === plan.activeStageId) ?? plan.stages[0]

  return (
    <div className="flex h-full min-w-[960px] flex-col bg-[#070b08]">
      <Header
        plan={plan}
        map={map}
        layer={layer}
        onOpenPicker={() => setPickerOpen(true)}
        onExport={() => ui.setExportOpen(true)}
        onHelp={() => setHelpOpen(true)}
      />

      {ui.view === 'roster' ? (
        <RosterBoard layer={layer} />
      ) : ui.mode === 'preview' ? (
        <PreviewBoard key={`preview:${map.id}:${layer.id}:${stage.id}`} map={map} layer={layer} plan={plan} stage={stage} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-12 shrink-0 flex-col">
            <ToolbarRail />
            <ToolbarHistory />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <OptionsBar />
            <div className="min-h-0 flex-1">
              <MapBoard key={`${map.id}:${layer.id}`} map={map} layer={layer} plan={plan} stage={stage} />
            </div>
            <Timeline plan={plan} stage={stage} />
          </div>

          <aside className="flex w-[422.4px] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#080d0a]">
            <div
              className="flex flex-col"
              style={{ zoom: 1.2, width: '100%', height: '100%' }}
            >
            <div className="relative flex h-[33.333px] shrink-0 items-center border-b border-white/10">
              {([
                { id: 'stage' as const, label: 'Stages', icon: MapIcon },
                { id: 'assets' as const, label: 'Assets', icon: Boxes },
                { id: 'routes' as const, label: 'Routes', icon: RouteIcon },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => ui.setRightTab(id)}
                  className={`relative flex h-full flex-1 items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                    ui.rightTab === id ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                  {ui.rightTab === id && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-amber-400" />}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {ui.rightTab === 'assets' && <AssetsPanel layer={layer} plan={plan} stage={stage} />}
              {ui.rightTab === 'stage' && <StagePanel layer={layer} plan={plan} stage={stage} />}
              {ui.rightTab === 'routes' && <RoutesPanel layer={layer} plan={plan} />}
            </div>
            </div>
          </aside>
        </div>
      )}

      {pickerOpen && (
        <Picker
          index={index}
          currentMapId={plan.mapId}
          currentLayerId={plan.layerId}
          onStart={startPlan}
          onClose={() => setPickerOpen(false)}
          onDiscard={reset}
        />
      )}

      {ui.exportOpen && <ExportDialog plan={plan} map={map} layer={layer} />}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  )
}



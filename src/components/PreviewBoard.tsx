import { useEffect, useRef, useState } from 'react'
import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { useUI } from '../store'
import { useAssets } from '../lib/assets'
import { renderStageCanvas } from '../lib/render'

interface Props {
  map: MapMeta
  layer: LayerData
  plan: Plan
  stage: Stage
}

export function PreviewBoard({ map, layer, plan, stage }: Props) {
  const assets = useAssets()
  const ui = useUI()
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
    </div>
  )
}

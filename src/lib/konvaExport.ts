import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { AssetManifest, LayerData, MapMeta, Plan, Stage } from '../types'
import { AssetProvider } from './assets'
import { DEFAULT_STAGE_VISIBILITY } from './utils'
import { MapBoard } from '../components/MapBoard'

export interface CaptureSource {
  map: MapMeta
  layer: LayerData
  plan: Plan
  assets: AssetManifest
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function captureStageDataUrl(
  src: CaptureSource,
  stage: Stage,
  resolution: number,
  format: 'png' | 'jpeg',
): Promise<string> {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-30000px'
  host.style.top = '0'
  host.style.width = `${resolution}px`
  host.style.height = `${resolution}px`
  host.style.overflow = 'hidden'
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    const visibility = { ...DEFAULT_STAGE_VISIBILITY, ...(stage.visibility ?? {}) }
    const board = createElement(MapBoard, {
      preview: true,
      map: src.map,
      layer: src.layer,
      plan: src.plan,
      stage,
      screenScale: resolution / 900,
      iconSize: stage.iconSize ?? 1,
      uiOverride: {
        ...visibility,
        iconSize: stage.iconSize ?? 1,
        visibleRoutes: stage.visibleRoutes ?? (src.layer.routes ?? []).map((route) => route.id),
        hiddenCps: stage.hiddenCps ?? [],
        startingOnly: stage.startingOnly ?? false,
      },
    })
    root.render(createElement(AssetProvider, { value: src.assets, children: board }))

    let canvases: HTMLCanvasElement[] = []
    for (let i = 0; i < 60; i++) {
      await wait(50)
      canvases = Array.from(host.querySelectorAll('canvas')) as HTMLCanvasElement[]
      if (canvases.length > 1) break
    }
    if (canvases.length === 0) throw new Error('Export canvas unavailable')
    await wait(900)
    canvases = Array.from(host.querySelectorAll('canvas')) as HTMLCanvasElement[]

    const out = document.createElement('canvas')
    out.width = resolution
    out.height = resolution
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('Export canvas unavailable')
    ctx.fillStyle = '#080c0a'
    ctx.fillRect(0, 0, resolution, resolution)
    for (const canvas of canvases) {
      ctx.drawImage(canvas, 0, 0, resolution, resolution)
    }
    return out.toDataURL(`image/${format}`, format === 'jpeg' ? 0.92 : undefined)
  } finally {
    root.unmount()
    host.remove()
  }
}

import { useEffect, useState } from 'react'
import { dataUrl } from './utils'

const imageCache = new Map<string, HTMLImageElement>()
const tintCache = new Map<string, HTMLImageElement>()
const srcCache = new Map<string, string>()

export function assetImage(path: string): HTMLImageElement {
  const hit = imageCache.get(path)
  if (hit) return hit
  const img = new Image()
  img.src = dataUrl(path)
  imageCache.set(path, img)
  return img
}

function tintCanvas(base: HTMLImageElement, color: string): HTMLCanvasElement {
  const size = Math.max(base.naturalWidth || 32, base.naturalHeight || 32)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(base, 0, 0, size, size)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, size, size)
  }
  return canvas
}

export function tintedAssetImage(path: string, color: string): HTMLImageElement {
  const key = `${path}|${color}`
  const hit = tintCache.get(key)
  if (hit) return hit
  const out = new Image()
  tintCache.set(key, out)
  const base = assetImage(path)
  const apply = () => {
    out.src = tintCanvas(base, color).toDataURL('image/png')
  }
  if (base.complete) apply()
  else base.addEventListener('load', apply, { once: true })
  return out
}

export function tintedAssetSrc(path: string, color: string): string | undefined {
  const key = `${path}|${color}`
  if (srcCache.has(key)) return srcCache.get(key)
  const base = assetImage(path)
  if (!base.complete) return undefined
  const src = tintCanvas(base, color).toDataURL('image/png')
  srcCache.set(key, src)
  return src
}

export function preloadAsset(path: string, tint?: string): Promise<void> {
  if (tint) {
    const img = tintedAssetImage(path, tint)
    if (img.complete && img.naturalWidth) return Promise.resolve()
    return new Promise((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true })
      img.addEventListener('error', () => resolve(), { once: true })
    })
  }
  const img = assetImage(path)
  if (img.complete) return img.decode?.().catch(() => undefined) ?? Promise.resolve()
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => resolve(), { once: true })
  })
}

export function useTintedSrc(path: string | undefined, color?: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(() => {
    if (!path) return undefined
    if (!color) return dataUrl(path)
    return tintedAssetSrc(path, color)
  })
  useEffect(() => {
    if (!path) return
    let alive = true
    if (!color) {
      setSrc(dataUrl(path))
      return
    }
    const base = assetImage(path)
    const apply = () => {
      if (!alive) return
      setSrc(tintCanvas(base, color).toDataURL('image/png'))
    }
    if (base.complete) apply()
    else base.addEventListener('load', apply, { once: true })
    return () => {
      alive = false
    }
  }, [path, color])
  return src
}

export function GameIcon({
  path,
  tint,
  size = 24,
  className,
  alt = '',
}: {
  path: string | undefined
  tint?: string
  size?: number
  className?: string
  alt?: string
}) {
  const src = useTintedSrc(path, tint)
  if (!src) return <span className={className} style={{ width: size, height: size }} />
  return <img src={src} alt={alt} className={className} style={{ width: size, height: size, objectFit: 'contain' }} draggable={false} />
}

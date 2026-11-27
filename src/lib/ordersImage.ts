import type { AssetManifest, Plan, Stage } from '../types'
import { preloadAsset, tintedAssetSrc } from './gameIcons'
import { parseOrders } from './orders'

async function loadIcon(path: string | undefined, tint: string): Promise<HTMLImageElement | null> {
  if (!path) return null
  await preloadAsset(path, tint)
  const src = tintedAssetSrc(path, tint)
  if (!src) return null
  const image = new Image()
  image.src = src
  await image.decode().catch(() => undefined)
  return image.complete ? image : null
}

export async function renderOrdersImage(plan: Plan, stage: Stage, assets: AssetManifest, width = 920, height = 980): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Orders canvas unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const fontSize = 26
  const lineHeight = 38
  const padding = 10
  const iconSize = 28
  const font = 'Inter, "Segoe UI", sans-serif'
  ctx.font = `${fontSize}px ${font}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#334155'

  const icons = new Map<string, HTMLImageElement | null>()
  for (const segment of parseOrders(stage.notes)) {
    if (segment.type === 'cmd') {
      const key = 'cmd'
      if (!icons.has(key)) icons.set(key, await loadIcon(assets.commander, '#f8fafc'))
    } else if (segment.type === 'squad') {
      const index = plan.roster.squads.findIndex((squad) => squad.id === segment.squadId)
      const squad = plan.roster.squads[index]
      const key = `squad:${segment.squadId}`
      if (!icons.has(key)) icons.set(key, await loadIcon(assets.squads[String(index + 1)], squad?.color ?? '#f8fafc'))
    }
  }

  let x = padding
  let baseline = padding + fontSize
  const newLine = () => {
    x = padding
    baseline += lineHeight
  }
  const fit = (advance: number) => {
    if (x + advance > width - padding) newLine()
  }

  for (const segment of parseOrders(stage.notes)) {
    if (segment.type === 'text') {
      const units = segment.text.match(/\n| +|[^ \n]+/g) ?? []
      for (const unit of units) {
        if (unit === '\n') {
          newLine()
          continue
        }
        if (unit.startsWith(' ')) {
          x += ctx.measureText(unit).width
          continue
        }
        const advance = ctx.measureText(unit).width
        fit(advance)
        ctx.fillText(unit, x, baseline)
        x += advance
      }
      continue
    }

    fit(iconSize + 4)
    const image = icons.get(segment.type === 'cmd' ? 'cmd' : `squad:${segment.squadId}`) ?? null
    if (segment.type === 'cmd') {
      ctx.beginPath()
      ctx.arc(x + iconSize / 2, baseline - fontSize * 0.32, iconSize / 2, 0, Math.PI * 2)
      ctx.fillStyle = '#2563eb'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#0b110d'
      ctx.stroke()
    }
    if (image) {
      ctx.drawImage(image, x, baseline - fontSize * 0.82, iconSize, iconSize)
    } else {
      ctx.font = `${fontSize * 0.64}px ${font}`
      ctx.fillStyle = '#64748b'
      ctx.fillText(segment.type === 'cmd' ? 'CMD' : 'SQ', x, baseline)
      ctx.font = `${fontSize}px ${font}`
    }
    ctx.fillStyle = '#334155'
    x += iconSize + 4
  }

  return canvas.toDataURL('image/png')
}

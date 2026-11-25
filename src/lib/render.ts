import type { ControlPoint, DrawElement, LayerData, MapMeta, Plan, Stage, VehicleSpawn } from '../types'
import { affiliationColor, dataUrl, formatTime } from './utils'
import { iconImage, glyphFor } from '../icons'

export function normPoint(p: { x: number; y: number }, size: number): [number, number] {
  return [p.x * size, p.y * size]
}

export function worldToNorm(x: number, z: number, world: number): { x: number; y: number } {
  return { x: (x + world / 2) / world, y: (z + world / 2) / world }
}

export function normToWorld(p: { x: number; y: number }, world: number): { x: number; z: number } {
  return { x: p.x * world - world / 2, z: p.y * world - world / 2 }
}

export function vehicleColor(v: VehicleSpawn, plan: Plan, squads: { id: string; color: string }[]): string {
  if (v.team !== null && v.team !== plan.side) return '#f87171'
  const claim = plan.claims[v.id]
  if (claim) {
    const squad = squads.find((s) => s.id === claim)
    if (squad) return squad.color
  }
  return '#38bdf8'
}

export function stageVehiclePos(v: VehicleSpawn, stage: Stage): { x: number; z: number; rotation: number } {
  const move = stage.moves[v.id]
  return move ? { x: move.x, z: move.z, rotation: move.rotation } : { x: v.x, z: v.z, rotation: v.rotation }
}

export interface RenderOptions {
  size: number
  showFlags: boolean
  showVehicles: boolean
  showEnemy: boolean
  showAssets: boolean
  showLabels: boolean
  showSpawnMarks: boolean
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await img.decode()
  return img
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-size, size * 0.48)
  ctx.lineTo(-size * 0.72, 0)
  ctx.lineTo(-size, -size * 0.48)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawElement(ctx: CanvasRenderingContext2D, el: DrawElement, size: number): void {
  const lw = Math.max(1, (el.width * size) / 1000)
  ctx.save()
  ctx.globalAlpha = el.opacity
  ctx.strokeStyle = el.color
  ctx.fillStyle = el.color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (el.dash) ctx.setLineDash([lw * 3.2, lw * 2.4])
  switch (el.type) {
    case 'pen': {
      if (el.points.length < 2) break
      ctx.beginPath()
      const [x0, y0] = normPoint(el.points[0], size)
      ctx.moveTo(x0, y0)
      for (let i = 1; i < el.points.length - 1; i++) {
        const [x1, y1] = normPoint(el.points[i], size)
        const [x2, y2] = normPoint(el.points[i + 1], size)
        ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2)
      }
      const [xn, yn] = normPoint(el.points[el.points.length - 1], size)
      ctx.lineTo(xn, yn)
      ctx.stroke()
      break
    }
    case 'line': {
      const [x1, y1] = normPoint(el.a, size)
      const [x2, y2] = normPoint(el.b, size)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      const angle = Math.atan2(y2 - y1, x2 - x1)
      if (el.arrow === 'end' || el.arrow === 'both') drawArrowHead(ctx, x2, y2, angle, lw * 5.5, el.color)
      if (el.arrow === 'both') drawArrowHead(ctx, x1, y1, angle + Math.PI, lw * 5.5, el.color)
      break
    }
    case 'rect': {
      const [x1, y1] = normPoint(el.a, size)
      const [x2, y2] = normPoint(el.b, size)
      if (el.fill) {
        ctx.globalAlpha = el.opacity * 0.16
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
        ctx.globalAlpha = el.opacity
      }
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      break
    }
    case 'ellipse': {
      const [x1, y1] = normPoint(el.a, size)
      const [x2, y2] = normPoint(el.b, size)
      ctx.beginPath()
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2)
      if (el.fill) {
        ctx.globalAlpha = el.opacity * 0.16
        ctx.fill()
        ctx.globalAlpha = el.opacity
      }
      ctx.stroke()
      break
    }
    case 'polygon': {
      if (el.points.length < 2) break
      ctx.beginPath()
      const [x0, y0] = normPoint(el.points[0], size)
      ctx.moveTo(x0, y0)
      for (const p of el.points.slice(1)) {
        const [x, y] = normPoint(p, size)
        ctx.lineTo(x, y)
      }
      ctx.closePath()
      if (el.fill) {
        ctx.globalAlpha = el.opacity * 0.16
        ctx.fill()
        ctx.globalAlpha = el.opacity
      }
      ctx.stroke()
      break
    }
    case 'text': {
      const [x, y] = normPoint(el.at, size)
      const f = Math.max(9, el.fontSize * size)
      ctx.font = `600 ${f}px "Inter", "Segoe UI", sans-serif`
      ctx.textBaseline = 'middle'
      ctx.lineWidth = Math.max(2, f * 0.12)
      ctx.strokeStyle = 'rgba(3,7,5,0.82)'
      ctx.setLineDash([])
      ctx.strokeText(el.text, x, y)
      ctx.fillStyle = el.color
      ctx.fillText(el.text, x, y)
      break
    }
    case 'icon': {
      const [x, y] = normPoint(el.at, size)
      const s = Math.max(10, el.size * size)
      const img = iconImage(glyphFor('marker', el.icon), el.color)
      ctx.translate(x, y)
      ctx.rotate((el.rotation * Math.PI) / 180)
      if (img.complete) ctx.drawImage(img, -s / 2, -s / 2, s, s)
      break
    }
    case 'unit': {
      const [x, y] = normPoint(el.at, size)
      const s = Math.max(10, el.size * size)
      const color = affiliationColor(el.affiliation)
      const img = iconImage(glyphFor('marker', el.unit), color)
      if (el.affiliation === 'hostile') {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.PI / 4)
        if (img.complete) ctx.drawImage(img, -s / 2, -s / 2, s, s)
        ctx.restore()
      } else if (img.complete) {
        ctx.drawImage(img, x - s / 2, y - s / 2, s, s)
      }
      break
    }
  }
  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#f1f5f9') {
  const f = Math.max(9, size)
  ctx.save()
  ctx.font = `600 ${f}px "Inter", "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineWidth = Math.max(2, f * 0.28)
  ctx.strokeStyle = 'rgba(2,6,4,0.9)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawFlag(ctx: CanvasRenderingContext2D, cp: ControlPoint, world: number, size: number, showLabel: boolean) {
  const x = ((cp.x + world / 2) / world) * size
  const y = ((cp.z + world / 2) / world) * size
  const s = size * 0.019
  const img = iconImage('flag', '#fbbf24')
  if (img.complete) ctx.drawImage(img, x - s / 2, y - s / 2, s, s)
  if (showLabel) label(ctx, cp.name.toUpperCase(), x, y + s * 0.62, size * 0.0125, '#fde68a')
}

export async function renderStageCanvas(
  plan: Plan,
  layer: LayerData,
  stage: Stage,
  map: MapMeta,
  opts: RenderOptions,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  const size = opts.size
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  ctx.fillStyle = '#0a0f0c'
  ctx.fillRect(0, 0, size, size)

  // Make sure every glyph drawn below has finished decoding before the
  // synchronous canvas pass; otherwise early exports can miss icons.
  const glyphs: { name: string; color: string }[] = [{ name: 'flag', color: '#fbbf24' }]
  for (const v of layer.vehicles) {
    const color = vehicleColor(v, plan, plan.roster.squads.map((s) => ({ id: s.id, color: s.color })))
    glyphs.push({ name: glyphFor('vehicle', v.category), color })
  }
  for (const el of stage.elements) {
    if (el.type === 'icon') glyphs.push({ name: glyphFor('marker', el.icon), color: el.color })
    if (el.type === 'unit') glyphs.push({ name: glyphFor('marker', el.unit), color: affiliationColor(el.affiliation) })
  }
  const uniqueGlyphs = [...new Map(glyphs.map((g) => [`${g.name}|${g.color}`, g])).values()]
  await Promise.all(
    uniqueGlyphs.map(({ name, color }) => {
      const img = iconImage(name, color)
      if (img.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )

  if (map.images) {
    try {
      const img = await loadImage(dataUrl(`maps/${map.images.image}`))
      ctx.drawImage(img, 0, 0, size, size)
    } catch {
      // map image missing: keep the dark board
    }
  }

  if (opts.showFlags) for (const cp of layer.controlPoints) drawFlag(ctx, cp, layer.world, size, opts.showLabels)

  if (opts.showVehicles) {
    const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))
    for (const v of layer.vehicles) {
      if (v.team === null) {
        if (!opts.showAssets) continue
      } else if (v.team !== plan.side && !opts.showEnemy) continue
      if (['asset', 'crate', 'emplacement'].includes(v.category) && !opts.showAssets) continue
      const pos = stageVehiclePos(v, stage)
      const x = ((pos.x + layer.world / 2) / layer.world) * size
      const y = ((pos.z + layer.world / 2) / layer.world) * size
      const color = vehicleColor(v, plan, squadColors)
      const moved = Boolean(stage.moves[v.id])
      if (moved && opts.showSpawnMarks) {
        const ox = ((v.x + layer.world / 2) / layer.world) * size
        const oy = ((v.z + layer.world / 2) / layer.world) * size
        ctx.save()
        ctx.globalAlpha = 0.8
        ctx.strokeStyle = 'rgba(226,232,240,0.7)'
        ctx.setLineDash([size * 0.006, size * 0.004])
        ctx.lineWidth = Math.max(1, size * 0.0012)
        ctx.beginPath()
        ctx.moveTo(ox, oy)
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(ox, oy, size * 0.008, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      const s = size * (v.category === 'mbt' ? 0.026 : v.category === 'boat' || v.category === 'carrier' ? 0.03 : 0.021)
      const img = iconImage(glyphFor('vehicle', v.category), color)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate((pos.rotation * Math.PI) / 180)
      if (img.complete) ctx.drawImage(img, -s / 2, -s / 2, s, s)
      ctx.restore()
      const squadId = plan.claims[v.id]
      const squad = plan.roster.squads.find((sq) => sq.id === squadId)
      if (squad) {
        const r = size * 0.0075
        ctx.save()
        ctx.beginPath()
        ctx.arc(x + s * 0.34, y - s * 0.34, r, 0, Math.PI * 2)
        ctx.fillStyle = squad.color
        ctx.fill()
        ctx.lineWidth = size * 0.0014
        ctx.strokeStyle = '#08110c'
        ctx.stroke()
        ctx.fillStyle = '#07110a'
        ctx.font = `700 ${size * 0.009}px "Inter", "Segoe UI", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(squad.name, x + s * 0.34, y - s * 0.34)
        ctx.restore()
      }
    }
  }

  for (const el of stage.elements) drawElement(ctx, el, size)

  // footer
  const bar = size * 0.036
  ctx.save()
  ctx.fillStyle = 'rgba(4,8,6,0.72)'
  ctx.fillRect(0, size - bar, size, bar)
  ctx.fillStyle = '#e2e8f0'
  ctx.font = `600 ${size * 0.0125}px "Inter", "Segoe UI", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillText(`${stage.name.toUpperCase()}  ·  T+${formatTime(stage.time)}  ·  ${plan.operation}`, size * 0.014, size - bar / 2)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#94a3b8'
  ctx.font = `500 ${size * 0.0105}px "Inter", "Segoe UI", sans-serif`
  const side = layer.factions[String(plan.side)]
  ctx.fillText(`${map.name}  ·  ${layer.name}  ·  ${side ? side.name : `Team ${plan.side}`}`, size - size * 0.014, size - bar / 2)
  ctx.restore()

  return canvas
}

export function canvasPng(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

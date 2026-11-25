import type { AssetManifest, ControlPoint, DrawElement, LayerData, MapMeta, Plan, Stage, VehicleSpawn } from '../types'
import { affiliationColor, dataUrl, formatTime } from './utils'
import { iconImage, glyphFor } from '../icons'
import { cpFlag } from './assets'
import { assetImage, preloadAsset, tintedAssetImage } from './gameIcons'
import { displayRotation, mirrorNorm, unmirrorNorm, worldToDisplayNorm } from './coords'
import { routeSegments } from './routes'

export function normPoint(p: { x: number; y: number }, size: number): [number, number] {
  const r = mirrorNorm(p)
  return [r.x * size, r.y * size]
}

export function worldToNorm(x: number, z: number, world: number): { x: number; y: number } {
  return worldToDisplayNorm(x, z, world)
}

export function normToWorld(p: { x: number; y: number }, world: number): { x: number; z: number } {
  const w = unmirrorNorm(p)
  return { x: w.x * world - world / 2, z: w.y * world - world / 2 }
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
  assets: AssetManifest
  visibleRoutes: string[]
  hiddenCps: number[]
}

const LANE_COLORS = ['#38bdf8', '#fb923c', '#a78bfa', '#34d399', '#f472b6', '#facc15']

function laneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length]
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

export function drawElement(ctx: CanvasRenderingContext2D, el: DrawElement, size: number, assets?: AssetManifest, world?: number): void {
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
    case 'ruler': {
      const [x1, y1] = normPoint(el.a, size)
      const [x2, y2] = normPoint(el.b, size)
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.hypot(dx, dy) || 1
      const nx = (-dy / len) * lw * 4
      const ny = (dx / len) * lw * 4
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x1 - nx, y1 - ny)
      ctx.lineTo(x1 + nx, y1 + ny)
      ctx.moveTo(x2 - nx, y2 - ny)
      ctx.lineTo(x2 + nx, y2 + ny)
      ctx.stroke()
      const meters = Math.round(Math.hypot(el.b.x - el.a.x, el.b.y - el.a.y) * (world ?? 0))
      label(ctx, `${meters} m`, (x1 + x2) / 2, (y1 + y2) / 2 - lw * 6, Math.max(11, lw * 3), el.color)
      break
    }
    case 'rect': {
      const [ax, ay] = normPoint(el.a, size)
      const [bx, by] = normPoint(el.b, size)
      const x1 = Math.min(ax, bx)
      const y1 = Math.min(ay, by)
      const w = Math.abs(bx - ax)
      const h = Math.abs(by - ay)
      if (el.fill) {
        ctx.globalAlpha = el.fillOpacity ?? 0.18
        ctx.fillRect(x1, y1, w, h)
        ctx.globalAlpha = el.opacity
      }
      ctx.strokeRect(x1, y1, w, h)
      break
    }
    case 'ellipse': {
      const [x1, y1] = normPoint(el.a, size)
      const [x2, y2] = normPoint(el.b, size)
      ctx.beginPath()
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2)
      if (el.fill) {
        ctx.globalAlpha = el.fillOpacity ?? 0.18
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
        ctx.globalAlpha = el.fillOpacity ?? 0.18
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
      const path = el.icon.startsWith('order_') ? assets?.orders[el.icon.slice(6)] : assets?.markers[el.icon]
      const img = path ? assetImage(path) : iconImage(glyphFor('marker', el.icon), el.color)
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

function drawFlag(
  ctx: CanvasRenderingContext2D,
  cp: ControlPoint,
  layer: LayerData,
  size: number,
  showLabel: boolean,
  assets: AssetManifest,
  color: string,
  team: number,
) {
  const p = worldToDisplayNorm(cp.x, cp.z, layer.world)
  const x = p.x * size
  const y = p.y * size
  const w = size * 0.034
  const radius = (cp.radius / layer.world) * size
  const key = team ? layer.factions[String(team)]?.key : undefined
  const flagPath = cpFlag(assets, key)
  const img = flagPath ? assetImage(flagPath) : null
  const ratio = img && img.width && img.height ? img.height / img.width : 1
  const h = w * Math.min(1, Math.max(0.4, ratio))
  if (radius > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = `${color}14`
    ctx.fill()
    ctx.strokeStyle = `${color}70`
    ctx.lineWidth = size * 0.0012
    ctx.stroke()
    ctx.restore()
  }
  if (img?.complete) {
    ctx.save()
    ctx.shadowColor = 'rgba(2,6,4,0.85)'
    ctx.shadowBlur = size * 0.004
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h)
    ctx.restore()
  }
  if (showLabel) label(ctx, cp.name, x, y + h / 2 + size * 0.003, size * 0.015, '#f8fafc')
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

  const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))
  const jobs: Promise<void>[] = []
  for (const faction of Object.values(layer.factions)) {
    const path = cpFlag(opts.assets, faction.key)
    if (path) jobs.push(preloadAsset(path))
  }
  const neutralFlag = cpFlag(opts.assets, undefined)
  if (neutralFlag) jobs.push(preloadAsset(neutralFlag))
  for (const v of layer.vehicles) {
    const path = opts.assets.vehicles[v.icon] ?? opts.assets.vehicles[v.category] ?? opts.assets.vehicles.other
    if (!path) continue
    jobs.push(preloadAsset(path))
    jobs.push(preloadAsset(path, vehicleColor(v, plan, squadColors)))
  }
  for (const path of Object.values(opts.assets.markers)) jobs.push(preloadAsset(path))
  for (const path of Object.values(opts.assets.orders)) jobs.push(preloadAsset(path))
  for (const el of stage.elements) {
    if (el.type === 'icon') {
      const path = el.icon.startsWith('order_') ? opts.assets.orders[el.icon.slice(6)] : opts.assets.markers[el.icon]
      if (path) jobs.push(preloadAsset(path))
    }
    if (el.type === 'unit') {
      const img = iconImage(glyphFor('marker', el.unit), affiliationColor(el.affiliation))
      jobs.push(
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            }),
      )
    }
  }
  await Promise.all(jobs)

  if (map.images) {
    try {
      const img = await loadImage(dataUrl(`maps/${map.images.image}`))
      ctx.drawImage(img, 0, 0, size, size)
    } catch {
      // map image missing: keep the dark board
    }
  }

  const routes = layer.routes ?? []
  const visibleRoutes = routes.filter((r) => opts.visibleRoutes.includes(r.id))
  const cpsById = new Map(layer.controlPoints.map((cp) => [cp.id, cp]))
  if (opts.showFlags) {
    for (const route of visibleRoutes) {
      const index = routes.findIndex((r) => r.id === route.id)
      ctx.save()
      ctx.strokeStyle = laneColor(index)
      ctx.globalAlpha = 0.45
      ctx.lineWidth = size * 0.002
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      for (const [from, to] of routeSegments(layer, route)) {
        const a = worldToDisplayNorm(from.x, from.z, layer.world)
        const b = worldToDisplayNorm(to.x, to.z, layer.world)
        ctx.beginPath()
        ctx.moveTo(a.x * size, a.y * size)
        ctx.lineTo(b.x * size, b.y * size)
        ctx.stroke()
      }
      ctx.restore()
    }
    const visibleIds = [...new Set(visibleRoutes.flatMap((r) => r.cps))]
    for (const id of visibleIds) {
      const cp = cpsById.get(id)
      if (!cp || opts.hiddenCps.includes(id)) continue
      const routeIndex = Math.max(0, visibleRoutes.findIndex((r) => r.cps.includes(id)))
      const team = plan.flagTeams?.[String(id)] ?? cp.team
      drawFlag(ctx, cp, layer, size, opts.showLabels, opts.assets, laneColor(routeIndex), team)
    }
  }

  if (opts.showVehicles) {
    const stageIndex = plan.stages.findIndex((s) => s.id === stage.id)
    const basePos = (v: VehicleSpawn) => {
      for (let i = stageIndex - 1; i >= 0; i--) {
        const move = plan.stages[i].moves[v.id]
        if (move) return move
      }
      return { x: v.x, z: v.z, rotation: v.rotation }
    }
    for (const v of layer.vehicles) {
      if (v.team === null) {
        if (!opts.showAssets) continue
      } else if (v.team !== plan.side && !opts.showEnemy) continue
      if (['asset', 'crate', 'emplacement'].includes(v.category) && !opts.showAssets) continue
      const move = stage.moves[v.id]
      const pos = move ?? basePos(v)
      const p = worldToDisplayNorm(pos.x, pos.z, layer.world)
      const x = p.x * size
      const y = p.y * size
      const color = vehicleColor(v, plan, squadColors)
      if (move) {
        const turns = stage.turns?.[v.id] ?? []
        const path = [basePos(v), ...turns, move].map((q) => worldToDisplayNorm(q.x, q.z, layer.world))
        if (path.length > 1) {
          ctx.save()
          ctx.globalAlpha = 0.82
          ctx.strokeStyle = color
          ctx.lineWidth = size * 0.0022
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(path[0].x * size, path[0].y * size)
          for (const pt of path.slice(1)) ctx.lineTo(pt.x * size, pt.y * size)
          ctx.stroke()
          ctx.restore()
        }
      }
      const s = size * (v.category === 'mbt' ? 0.032 : v.category === 'boat' || v.category === 'carrier' ? 0.034 : 0.028)
      const iconPath = opts.assets.vehicles[v.icon] ?? opts.assets.vehicles[v.category] ?? opts.assets.vehicles.other
      const img = iconPath ? tintedAssetImage(iconPath, color) : iconImage(glyphFor('vehicle', v.category), color)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(((displayRotation(pos.rotation) + 90) * Math.PI) / 180)
      if (img.complete) ctx.drawImage(img, -s / 2, -s / 2, s, s)
      ctx.restore()
      const squadId = plan.claims[v.id]
      const squad = plan.roster.squads.find((sq) => sq.id === squadId)
      if (squad) {
        ctx.save()
        const bx = x + s * 0.26
        const by = y - s * 0.44
        const bw = size * 0.016
        const bh = size * 0.011
        ctx.fillStyle = squad.color
        ctx.fillRect(bx, by, bw, bh)
        ctx.strokeStyle = '#08110c'
        ctx.lineWidth = size * 0.0014
        ctx.strokeRect(bx, by, bw, bh)
        ctx.fillStyle = '#07110a'
        ctx.font = `700 ${size * 0.008}px "Inter", "Segoe UI", sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(squad.name, bx + size * 0.002, by + bh / 2)
        ctx.restore()
      }
    }
  }

  for (const el of stage.elements) drawElement(ctx, el, size, opts.assets, layer.world)

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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Lock } from 'lucide-react'
import { Stage, Layer, Image as KonvaImage, Line, Rect, Ellipse, Text, Group, Arrow, Circle } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ControlPoint, DrawElement, LayerData, MapMeta, Plan, Point, Stage as PlanStage, StageFrame, VehicleSpawn } from '../types'
import { usePlanner, useUI } from '../store'
import { affiliationColor, clamp, dataUrl, formatTime, isHiddenVehicle, SQUAD_COLORS, vehicleDelayRemaining, vehicleReady } from '../lib/utils'
import { glyphFor, iconImage } from '../icons'
import { vehicleColor } from '../lib/render'
import { cpFlag, useAssets, vehicleIconPath } from '../lib/assets'
import { captureTeam, isCapturable, teamName } from '../lib/flags'
import { displayNormToWorld, mirrorNorm, unmirrorNorm, vehicleSpriteOffset, vehicleSpriteRotation, worldToDisplayNorm } from '../lib/coords'
import { assetImage, GameIcon, preloadAsset, tintedAssetImage } from '../lib/gameIcons'
import { routeColor } from './RoutesPanel'
import { groupRoute } from '../lib/routes'
import { CACHE_ICON_PX, FLAG_ICON_PX, MAP_TEXT_FILL, MAP_TEXT_OUTLINE, MAP_TEXT_OUTLINE_PX, SQUAD_ICON_PX, VEHICLE_ICON_SCALE, VEHICLE_TEXT_SCALE, vehicleIconPx } from '../lib/mapStyle'
import { assignedKits } from '../lib/kits'

interface Props {
  map: MapMeta
  layer: LayerData
  plan: Plan
  stage: PlanStage
  preview?: boolean
  screenScale?: number
  iconSize?: number
}

const isIconElement = (el: DrawElement) => el.type === 'icon' || el.type === 'unit' || el.type === 'squad'

interface Draft {
  kind: 'pen' | 'line' | 'rect' | 'ellipse'
  points: Point[]
}

type ShapeKind = 'line' | 'ruler' | 'rect' | 'ellipse'

interface ShapeDraft {
  kind: ShapeKind
  points: Point[]
}

function useMapImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.src = url
    let alive = true
    img.onload = () => alive && setImage(img)
    return () => {
      alive = false
    }
  }, [url])
  return image
}

function IconGlyph({
  icon, color, size, x, y, rotation = 0,
}: { icon: string; color: string; size: number; x: number; y: number; rotation?: number }) {
  const img = iconImage(glyphFor('marker', icon), color)
  return <KonvaImage image={img} x={x - size / 2} y={y - size / 2} width={size} height={size} rotation={rotation} offsetX={0} offsetY={0} listening={false} />
}

function MarkerGlyph({ icon, size, color }: { icon: string; size: number; color: string }) {
  const assets = useAssets()
  const path = icon.startsWith('order_') ? assets.orders[icon.slice(6)] : assets.markers[icon]
  if (path) {
    return <KonvaImage image={assetImage(path)} x={-size / 2} y={-size / 2} width={size} height={size} listening={false} />
  }
  return <IconGlyph icon={glyphFor('marker', icon)} color={color} size={size} x={0} y={0} />
}

const PENCIL = '#f8fafc'
const FLAG_ANCHOR_X = 0.148
const FLAG_ANCHOR_Y = 0.727

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return color
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function aasPickCount(sgid: number): number | null {
  const text = String(sgid)
  if (text.length < 2) return null
  const pick = Number(text[1])
  return pick > 0 ? pick : null
}

export function MapBoard({ map, layer, plan, stage, preview = false, screenScale = 1, iconSize: iconSizeOverride }: Props) {
  const ui = useUI()
  const assets = useAssets()
  const planner = usePlanner()
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [previewRotation, setPreviewRotation] = useState<number | null>(null)
  const [dragVehicle, setDragVehicle] = useState<{ id: string; x: number; z: number; screenX: number; screenY: number } | null>(null)
  const [dragTurn, setDragTurn] = useState<{ vehicleId: string; index: number; x: number; z: number } | null>(null)
  const [frameDraft, setFrameDraft] = useState<StageFrame>(stage.frame ?? { x: 0, y: 0, size: 1 })
  const frameDraftRef = useRef<StageFrame>(stage.frame ?? { x: 0, y: 0, size: 1 })
  const [frameDrag, setFrameDrag] = useState<{ mode: string; startX: number; startY: number; frame: StageFrame } | null>(null)
  const [frameSelected, setFrameSelected] = useState(false)
  const rotateStart = useRef<{ angle: number; rotation: number } | null>(null)
  const [box, setBox] = useState({ w: 800, h: 600 })
  const [view, setView] = useState({ scale: 0.4, x: 0, y: 0 })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, setPending] = useState<ShapeDraft | null>(null)
  const pendingRef = useRef<ShapeDraft | null>(null)
  const setPendingShape = (value: ShapeDraft | null) => {
    pendingRef.current = value
    setPending(value)
  }
  const pointerDown = useRef(false)
  const panStart = useRef<{ px: number; py: number; wx: number; wy: number } | null>(null)
  const panMoved = useRef(false)
  const panMiddle = useRef(false)
  const [panning, setPanning] = useState(false)
  const [polygon, setPolygon] = useState<Point[]>([])
  const polygonRef = useRef<Point[]>([])
  const pendingText = useRef<Point | null>(null)
  const pendingTextBox = useRef(false)
  const [textAt, setTextAt] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')
  const [textBoxMode, setTextBoxMode] = useState(false)
  const [tick, setTick] = useState(0)
  const [hoverFlag, setHoverFlag] = useState<{ cp: ControlPoint; x: number; y: number } | null>(null)
  const [hoverVehicleId, setHoverVehicleId] = useState<string | null>(null)
  const [hoverCrew, setHoverCrew] = useState<{ id: string; x: number; y: number } | null>(null)
  const [hoverSquad, setHoverSquad] = useState<{ id: string; x: number; y: number } | null>(null)
  const [pinnedSquadId, setPinnedSquadId] = useState<string | null>(null)
  const fitted = useRef<string>('')

  const routes = layer.routes ?? []
  const visibleRoutes = routes.filter((r) => ui.visibleRoutes.includes(r.id))
  const cpsById = new Map(layer.controlPoints.map((cp) => [cp.id, cp]))
  const visibleCps = visibleRoutes.flatMap((r) => r.cps)
  const activeCps = [...new Set(visibleCps)].map((id) => cpsById.get(id)).filter(Boolean)

  const imageUrl = map.images ? dataUrl(`maps/${map.images.image}`) : null
  const image = useMapImage(imageUrl)
  const mapW = map.images?.width ?? 2048
  const mapH = map.images?.height ?? 2048
  const stageFrame = stage.frame ?? { x: 0, y: 0, size: 1 }
  const frameView = (frame: StageFrame) => {
    const size = clamp(frame.size, 0.03, 1)
    const scale = Math.min(box.w / (mapW * size), box.h / (mapH * size)) * (preview ? 1 : 0.94)
    return {
      scale,
      x: box.w / 2 - (frame.x + size / 2) * mapW * scale,
      y: box.h / 2 - (frame.y + size / 2) * mapH * scale,
    }
  }
  const fullMapFit = Math.min(box.w / mapW, box.h / mapH) * 0.94
  const minZoom = Math.max(0.02, fullMapFit * 0.4)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setBox({ w: Math.max(320, r.width), h: Math.max(240, r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const key = `${map.id}:${stage.id}:${box.w}x${box.h}:${preview ? 'preview' : 'edit'}`
    if (fitted.current === key) return
    fitted.current = key
    setView(frameView(stage.frame ?? { x: 0, y: 0, size: 1 }))
  }, [box, map.id, mapW, mapH, stage.id])

  // Warm the game-icon cache used by this layer and plan.
  useEffect(() => {
    const jobs: Promise<void>[] = []
    const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))
    for (const faction of Object.values(layer.factions)) {
      const path = cpFlag(assets, faction.key)
      if (path) jobs.push(preloadAsset(path))
    }
    const neutralFlag = cpFlag(assets, undefined)
    if (neutralFlag) jobs.push(preloadAsset(neutralFlag))
    for (const v of layer.vehicles) {
      const path = vehicleIconPath(assets, v)
      if (!path) continue
      jobs.push(preloadAsset(path))
      jobs.push(preloadAsset(path, vehicleColor(v, plan, squadColors)))
    }
    if (assets.commander) {
      jobs.push(preloadAsset(assets.commander))
    }
    if (assets.markers.cache_objective) {
      jobs.push(preloadAsset(assets.markers.cache_objective, '#07110a'))
      jobs.push(preloadAsset(assets.markers.cache_objective, '#ef4444'))
    }
    plan.roster.squads.forEach((squad, index) => {
      const icon = assets.squads[String(index + 1)]
      if (icon) jobs.push(preloadAsset(icon, squad.color))
    })
    for (const path of Object.values(assets.markers)) jobs.push(preloadAsset(path))
    for (const path of Object.values(assets.orders)) jobs.push(preloadAsset(path))
    for (const el of stage.elements) {
      if (el.type === 'icon') {
        const path = el.icon.startsWith('order_') ? assets.orders[el.icon.slice(6)] : assets.markers[el.icon]
        if (path) jobs.push(preloadAsset(path))
      }
    }
    let alive = true
    Promise.all(jobs).then(() => alive && setTick((t) => t + 1))
    return () => {
      alive = false
    }
  }, [assets, layer, plan, stage.elements])

  const mapCoords = useCallback((clientX?: number, clientY?: number) => {
    const st = stageRef.current
    if (!st) return { x: 0, y: 0 }
    let p = st.getPointerPosition()
    if (clientX !== undefined && clientY !== undefined) {
      const rect = st.container().getBoundingClientRect()
      p = { x: clientX - rect.left, y: clientY - rect.top }
    }
    if (!p) return { x: 0, y: 0 }
    return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale }
  }, [view])

  // Screen-normalized pointer -> world-normalized plan coordinate.
  const toNorm = useCallback((p: { x: number; y: number }): Point => unmirrorNorm({ x: p.x / mapW, y: p.y / mapH }), [mapW, mapH])
  const normToScreen = useCallback((p: Point): Point => {
    const r = mirrorNorm(p)
    return { x: r.x * mapW, y: r.y * mapH }
  }, [mapW, mapH])

  const clientToFrameNorm = useCallback((clientX: number, clientY: number): Point => {
    const p = mapCoords(clientX, clientY)
    return { x: p.x / mapW, y: p.y / mapH }
  }, [mapCoords, mapW, mapH])

  useEffect(() => {
    const next = stage.frame ?? { x: 0, y: 0, size: 1 }
    frameDraftRef.current = next
    setFrameDraft(next)
  }, [stage.id, stage.frame?.x, stage.frame?.y, stage.frame?.size])

  useEffect(() => {
    if (!frameDrag) return
    const move = (e: PointerEvent) => {
      const p = clientToFrameNorm(e.clientX, e.clientY)
      const s = frameDrag.frame
      const dx = p.x - frameDrag.startX
      const dy = p.y - frameDrag.startY
      const min = 0.03
      let x = s.x
      let y = s.y
      let size = s.size
      const right = s.x + s.size
      const bottom = s.y + s.size
      if (frameDrag.mode === 'move') {
        x = clamp(s.x + dx, 0, 1 - s.size)
        y = clamp(s.y + dy, 0, 1 - s.size)
      } else if (frameDrag.mode === 'e') {
        size = clamp(s.size + dx, min, 1 - s.x)
      } else if (frameDrag.mode === 'w') {
        x = clamp(s.x + dx, 0, right - min)
        size = right - x
      } else if (frameDrag.mode === 's') {
        size = clamp(s.size + dy, min, 1 - s.y)
      } else if (frameDrag.mode === 'n') {
        y = clamp(s.y + dy, 0, bottom - min)
        size = bottom - y
      } else if (frameDrag.mode === 'se') {
        size = clamp(s.size + Math.max(dx, dy), min, Math.min(1 - s.x, 1 - s.y))
      } else if (frameDrag.mode === 'nw') {
        size = clamp(s.size + Math.max(-dx, -dy), min, Math.min(right, bottom))
        x = right - size
        y = bottom - size
      } else if (frameDrag.mode === 'ne') {
        size = clamp(s.size + Math.max(dx, -dy), min, Math.min(1 - s.x, bottom))
        y = bottom - size
      } else if (frameDrag.mode === 'sw') {
        size = clamp(s.size + Math.max(-dx, dy), min, Math.min(right, 1 - s.y))
        x = right - size
      }
      const next = { x, y, size }
      frameDraftRef.current = next
      setFrameDraft(next)
    }
    const up = () => {
      planner.updateStage(stage.id, { frame: frameDraftRef.current })
      setFrameDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [frameDrag, clientToFrameNorm, planner, stage.id])

  const commit = useCallback((el: DrawElement) => {
    planner.addElement(el)
    useUI.getState().setSelected(null, null)
  }, [planner])

  const base = useCallback(() => {
    const state = useUI.getState()
    return {
      id: `el_${Math.random().toString(36).slice(2, 9)}`,
      color: state.color,
      width: state.width,
      opacity: state.opacity,
      dash: state.dash,
      fillOpacity: state.fillOpacity,
    }
  }, [])

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const st = stageRef.current
    if (!st) return
    const pointer = st.getPointerPosition()
    if (!pointer) return
    const dir = e.evt.deltaY > 0 ? 0.9 : 1.1
    setView((current) => {
      const old = current.scale
      const next = clamp(old * dir, minZoom, 20)
      const wx = (pointer.x - current.x) / old
      const wy = (pointer.y - current.y) / old
      return { scale: next, x: pointer.x - wx * next, y: pointer.y - wy * next }
    })
  }

  const zoomBy = (factor: number) => {
    const old = view.scale
    const next = clamp(old * factor, minZoom, 20)
    const cx = box.w / 2
    const cy = box.h / 2
    const wx = (cx - view.x) / old
    const wy = (cy - view.y) / old
    setView({ scale: next, x: cx - wx * next, y: cy - wy * next })
  }

  const resetView = () => {
    setView(frameView(stage.frame ?? { x: 0, y: 0, size: 1 }))
  }

  const commitShape = (kind: ShapeKind, a: Point, b: Point) => {
    const state = useUI.getState()
    if (kind === 'ruler') {
      commit({ ...base(), type: 'ruler', a, b } as DrawElement)
    } else if (kind === 'line') {
      commit({
        ...base(),
        type: 'line',
        a,
        b,
        arrow: state.tool === 'arrow' ? (state.arrowBoth ? 'both' : 'end') : 'none',
        dash: state.dash,
      } as DrawElement)
    } else {
      commit({
        ...base(),
        type: kind,
        a,
        b,
        fill: state.fillShapes,
        fillOpacity: state.fillOpacity,
      } as DrawElement)
    }
  }

  const onStageDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) return
    const st = stageRef.current
    if (!st) return
    if (e.evt.button === 1) {
      e.evt.preventDefault()
      const p = st.getPointerPosition()
      if (!p) return
      panStart.current = { px: p.x, py: p.y, wx: (p.x - view.x) / view.scale, wy: (p.y - view.y) / view.scale }
      panMoved.current = false
      panMiddle.current = true
      setPanning(false)
      return
    }
    const state = useUI.getState()
    const tool = state.tool
    if (tool === 'select') {
      if (e.target !== st) return
      const p = st.getPointerPosition()
      if (!p) return
      panStart.current = { px: p.x, py: p.y, wx: (p.x - view.x) / view.scale, wy: (p.y - view.y) / view.scale }
      panMoved.current = false
      setPanning(false)
      return
    }
    if (tool === 'erase') {
      if (e.target === st) state.setSelected(null, null)
      return
    }
    const pos = mapCoords()
    if (tool === 'text' || tool === 'textbox') {
      pendingText.current = toNorm(pos)
      pendingTextBox.current = tool === 'textbox'
      return
    }
    if (tool === 'marker') {
      commit({ ...base(), type: 'icon', at: toNorm(pos), icon: state.markerIcon, rotation: 0, size: 0.022 } as DrawElement)
      return
    }
    if (tool === 'polygon') {
      if (e.evt.detail > 1) return
      const n = toNorm(pos)
      const current = polygonRef.current
      if (current.length > 2) {
        const first = current[0]
        if (Math.hypot(first.x - n.x, first.y - n.y) < 0.012) {
          finishPolygon()
          return
        }
      }
      const next = [...current, n]
      polygonRef.current = next
      setPolygon(next)
      return
    }
    if (tool === 'pen') {
      setDraft({ kind: 'pen', points: [toNorm(pos)] })
      pointerDown.current = true
      return
    }
    if (['line', 'arrow', 'ruler', 'rect', 'ellipse'].includes(tool)) {
      const kind: ShapeKind = tool === 'rect' ? 'rect' : tool === 'ellipse' ? 'ellipse' : tool === 'ruler' ? 'ruler' : 'line'
      const current = pendingRef.current
      if (current) {
        const a = current.points[0]
        const b = toNorm(pos)
        commitShape(current.kind, a, b)
        setPendingShape(null)
        setDraft(null)
        pointerDown.current = false
        return
      }
      const start = toNorm(pos)
      setPendingShape({ kind, points: [start, start] })
      pointerDown.current = true
    }
  }

  const onStageMove = (e: KonvaEventObject<MouseEvent>) => {
    if (panStart.current) {
      const st = stageRef.current
      const p = st?.getPointerPosition()
      if (!st || !p) return
      const dx = p.x - panStart.current.px
      const dy = p.y - panStart.current.py
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        panMoved.current = true
        setPanning(true)
      }
      setView((v) => ({
        ...v,
        x: p.x - panStart.current!.wx * v.scale,
        y: p.y - panStart.current!.wy * v.scale,
      }))
      return
    }
    if (pendingRef.current) {
      const current = pendingRef.current
      const n = toNorm(mapCoords())
      let end = n
      if (e.evt.shiftKey) {
        const start = current.points[0]
        const dx = n.x - start.x
        const dy = n.y - start.y
        if (current.kind === 'rect' || current.kind === 'ellipse') {
          const size = Math.max(Math.abs(dx), Math.abs(dy))
          end = {
            x: start.x + (dx < 0 ? -size : size),
            y: start.y + (dy < 0 ? -size : size),
          }
        } else {
          const length = Math.hypot(dx, dy)
          const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
          end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
        }
      }
      setPendingShape({ ...current, points: [current.points[0], end] })
      return
    }
    if (!draft) return
    const n = toNorm(mapCoords())
    if (draft.kind === 'pen' && pointerDown.current) {
      const last = draft.points[draft.points.length - 1]
      const minStep = 1.2 / (mapW * view.scale)
      if (Math.hypot(n.x - last.x, n.y - last.y) > minStep) {
        setDraft({ ...draft, points: [...draft.points, n] })
      }
    }
  }

  const onStageUp = () => {
    if (panStart.current) {
      const moved = panMoved.current
      const middle = panMiddle.current
      panStart.current = null
      panMoved.current = false
      panMiddle.current = false
      setPanning(false)
      if (!moved && !middle) useUI.getState().setSelected(null, null)
      return
    }
    if (pendingText.current && ['text', 'textbox'].includes(useUI.getState().tool)) {
      const pos = pendingText.current
      pendingText.current = null
      setTextAt(pos)
      setTextValue('')
      setTextBoxMode(pendingTextBox.current)
      return
    }
    if (pendingRef.current) {
      const current = pendingRef.current
      const [a, b] = current.points
      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.006) {
        commitShape(current.kind, a, b)
        setPendingShape(null)
        setDraft(null)
      }
      pointerDown.current = false
      return
    }
    if (!draft) return
    if (draft.kind === 'pen' && draft.points.length > 2) {
      commit({ ...base(), type: 'pen', points: draft.points } as DrawElement)
    }
    setDraft(null)
    pointerDown.current = false
  }

  const finishPolygon = () => {
    const points = polygonRef.current
    if (points.length > 2) {
      commit({ ...base(), type: 'polygon', points, fill: ui.fillShapes } as DrawElement)
    }
    polygonRef.current = []
    setPolygon([])
  }

  const addingText = useRef(false)
  const addText = () => {
    if (addingText.current) return
    addingText.current = true
    if (!textAt || !textValue.trim()) {
      setTextAt(null)
      addingText.current = false
      return
    }
    commit({ ...base(), type: 'text', at: textAt, text: textValue.trim(), fontSize: 0.021, box: textBoxMode } as DrawElement)
    setTextAt(null)
    setTextValue('')
    setTextBoxMode(false)
    setTimeout(() => { addingText.current = false }, 50)
  }

  useEffect(() => {
    setPendingShape(null)
    setDraft(null)
    pointerDown.current = false
    if (ui.tool !== 'polygon' && polygonRef.current.length) {
      polygonRef.current = []
      setPolygon([])
    }
    if (ui.tool !== 'text' && ui.tool !== 'textbox') {
      pendingText.current = null
      setTextAt(null)
      setTextBoxMode(false)
    }
  }, [ui.tool])

  useEffect(() => {
    setDraft(null)
    setPendingShape(null)
    pointerDown.current = false
    polygonRef.current = []
    setPolygon([])
    pendingText.current = null
    setTextAt(null)
  }, [stage.id])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (typing) return
      if (e.key === 'Escape') {
        setDraft(null)
        setPendingShape(null)
        pointerDown.current = false
        polygonRef.current = []
        setPolygon([])
        pendingText.current = null
        setTextAt(null)
        useUI.getState().setSelected(null, null)
      }
      if (e.key === 'Enter' && ui.tool === 'polygon') finishPolygon()
      if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedId) {
        if (ui.selectedKind === 'element') {
          planner.removeElement(ui.selectedId)
          useUI.getState().setSelected(null, null)
        } else if (ui.selectedKind === 'vehicle') {
          const plan = usePlanner.getState().plan
          const current = plan?.stages.find((s) => s.id === plan.activeStageId)
          const vehicleId = ui.selectedId.replace(/^veh_/, '')
          const turns = current?.turns?.[vehicleId] ?? []
          if (turns.length) planner.setVehicleTurns(vehicleId, turns.slice(0, -1))
          else {
            planner.clearVehicleMove(vehicleId)
            useUI.getState().setSelected(null, null)
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) planner.redo()
        else planner.undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        planner.redo()
      }
    }
    window.addEventListener('keydown', down)
    return () => {
      window.removeEventListener('keydown', down)
    }
  }, [ui.tool, ui.selectedId, ui.selectedKind, planner, polygon])

  const stageIndex = plan.stages.findIndex((s) => s.id === stage.id)
  const baseVehiclePos = (v: VehicleSpawn) => {
    for (let i = stageIndex - 1; i >= 0; i--) {
      const move = plan.stages[i].moves[v.id]
      if (move) return move
    }
    return { x: v.x, z: v.z, rotation: v.rotation }
  }
  const vehiclePosition = (v: VehicleSpawn) => stage.moves[v.id] ?? baseVehiclePos(v)

  const selectedVehicle = useMemo(() => {
    if (ui.selectedKind !== 'vehicle') return null
    return layer.vehicles.find((v) => `veh_${v.id}` === ui.selectedId) ?? null
  }, [layer.vehicles, ui.selectedId, ui.selectedKind])

  const selectedSquadId = useMemo(() => {
    if (ui.selectedKind !== 'element') return null
    const element = stage.elements.find(
      (item): item is Extract<DrawElement, { type: 'squad' }> => item.id === ui.selectedId && item.type === 'squad',
    )
    return element?.squadId ?? null
  }, [stage.elements, ui.selectedId, ui.selectedKind])

  const selectedVehiclePos = selectedVehicle ? vehiclePosition(selectedVehicle) : null

  const selectedScreen = selectedVehiclePos
    ? (() => {
        const p = worldToDisplayNorm(selectedVehiclePos.x, selectedVehiclePos.z, layer.world)
        return { x: p.x * mapW * view.scale + view.x, y: p.y * mapH * view.scale + view.y }
      })()
    : null

  const pointerAngle = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current
    if (!el || !selectedVehiclePos) return 0
    const rect = el.getBoundingClientRect()
    const p = worldToDisplayNorm(selectedVehiclePos.x, selectedVehiclePos.z, layer.world)
    // The app shell is CSS-scaled; convert internal view coordinates to client pixels.
    const k = rect.width / (el.clientWidth || rect.width)
    const cx = rect.left + (p.x * mapW * view.scale + view.x) * k
    const cy = rect.top + (p.y * mapH * view.scale + view.y) * k
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90
  }, [selectedVehiclePos, layer.world, mapW, mapH, view])

  const rotateFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!selectedVehicle || !selectedVehiclePos || !rotateStart.current) return
    let delta = pointerAngle(clientX, clientY) - rotateStart.current.angle
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    const rotation = (rotateStart.current.rotation - delta + 720) % 360
    setPreviewRotation(rotation)
    planner.moveVehicle(selectedVehicle.id, {
      x: selectedVehiclePos.x,
      z: selectedVehiclePos.z,
      rotation,
    })
  }, [selectedVehicle, selectedVehiclePos, pointerAngle, planner])

  const vehicleVisible = (v: VehicleSpawn) => {
    if (isHiddenVehicle(v.template)) return false
    if (v.team !== null && v.team !== plan.side && !ui.showEnemy) return false
    if (['asset', 'crate', 'emplacement'].includes(v.category) && !ui.showAssets) return false
    return ui.showVehicles
  }

  const iconSize = iconSizeOverride ?? ui.iconSize
  const iconScale = (1 / view.scale) * screenScale
  const stageCursor = panning ? 'grabbing' : ui.tool === 'select' ? 'default' : 'crosshair'

  const drawElementNode = (el: DrawElement) => {
    const selected = !preview && ui.selectedId === el.id
    const color = selected ? '#fbbf24' : el.color
    const sw = Math.max(0.25, el.width * iconScale)
    const common = {
      id: el.id,
      draggable: ui.tool === 'select',
      listening: ui.tool === 'select' || ui.tool === 'erase' || (ui.tool === 'marker' && el.type === 'icon'),
      opacity: el.opacity,
      onMouseDown: (e: KonvaEventObject<MouseEvent>) => {
        if (ui.tool === 'marker' && el.type === 'icon') e.cancelBubble = true
      },
      onContextMenu: (e: KonvaEventObject<MouseEvent>) => {
        if (ui.tool === 'marker' && el.type === 'icon') {
          e.evt.preventDefault()
          e.cancelBubble = true
          planner.removeElement(el.id)
        }
      },
      onClick: (e: KonvaEventObject<MouseEvent>) => {
        if (ui.tool !== 'select' && ui.tool !== 'erase') return
        e.cancelBubble = true
        if (ui.tool === 'erase') {
          planner.removeElement(el.id)
          useUI.getState().setSelected(null, null)
        } else {
          useUI.getState().setSelected(el.id, 'element')
        }
      },
      onDragStart: () => planner.checkpoint(),
      onDragEnd: (e: KonvaEventObject<DragEvent>) => {
        const node = e.target
        let dx = node.x() / mapW
        let dy = node.y() / mapH
        if (el.type === 'text' || el.type === 'icon' || el.type === 'unit' || el.type === 'squad') {
          const at = normToScreen(el.at)
          dx = (node.x() - at.x) / mapW
          dy = (node.y() - at.y) / mapH
        } else if (el.type === 'rect') {
          const a = normToScreen(el.a)
          const b = normToScreen(el.b)
          dx = (node.x() - Math.min(a.x, b.x)) / mapW
          dy = (node.y() - Math.min(a.y, b.y)) / mapH
        } else if (el.type === 'ellipse') {
          const a = normToScreen(el.a)
          const b = normToScreen(el.b)
          dx = (node.x() - (a.x + b.x) / 2) / mapW
          dy = (node.y() - (a.y + b.y) / 2) / mapH
        }
        const worldDx = dx
        const worldDy = -dy
        const patch = (() => {
          if (el.type === 'text' || el.type === 'icon' || el.type === 'unit' || el.type === 'squad') {
            return { at: { x: el.at.x + worldDx, y: el.at.y + worldDy } }
          }
          if (el.type === 'line' || el.type === 'ruler' || el.type === 'rect' || el.type === 'ellipse') {
            return {
              a: { x: el.a.x + worldDx, y: el.a.y + worldDy },
              b: { x: el.b.x + worldDx, y: el.b.y + worldDy },
            }
          }
          if (el.type === 'pen' || el.type === 'polygon') {
            return { points: el.points.map((p) => ({ x: p.x + worldDx, y: p.y + worldDy })) }
          }
          return {}
        })()
        node.position({ x: 0, y: 0 })
        planner.updateElement(el.id, patch)
      },
    }

    switch (el.type) {
      case 'pen':
        return (
          <Line
            key={el.id}
            {...common}
            points={el.points.flatMap((p) => { const s = normToScreen(p); return [s.x, s.y] })}
            stroke={color}
            strokeWidth={sw}
            lineCap="round"
            lineJoin="round"
            tension={0.35}
            hitStrokeWidth={14}
          />
        )
      case 'line': {
        const a = normToScreen(el.a)
        const b = normToScreen(el.b)
        return (
          <Arrow
            key={el.id}
            {...common}
            points={[a.x, a.y, b.x, b.y]}
            stroke={color}
            fill={color}
            strokeWidth={sw}
            pointerLength={el.arrow === 'none' ? 0 : Math.max(8, sw * 5)}
            pointerWidth={el.arrow === 'none' ? 0 : Math.max(8, sw * 4.4)}
            pointerAtBeginning={el.arrow === 'both'}
            pointerAtEnding={el.arrow !== 'none'}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            hitStrokeWidth={16}
          />
        )
      }
      case 'ruler': {
        const a = normToScreen(el.a)
        const b = normToScreen(el.b)
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const nx = (-dy / len) * 7
        const ny = (dx / len) * 7
        const meters = Math.round(Math.hypot(el.b.x - el.a.x, el.b.y - el.a.y) * layer.world)
        return (
          <Group key={el.id} {...common}>
            <Line points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={Math.max(1, sw * 0.8)} />
            <Line points={[a.x - nx, a.y - ny, a.x + nx, a.y + ny]} stroke={color} strokeWidth={sw} />
            <Line points={[b.x - nx, b.y - ny, b.x + nx, b.y + ny]} stroke={color} strokeWidth={sw} />
            <Text
              x={(a.x + b.x) / 2 - 50 * iconScale}
              y={(a.y + b.y) / 2 - 18 * iconScale}
              width={100 * iconScale}
              align="center"
              text={`${meters} m`}
              fontSize={10 * iconScale}
              fontFamily="Inter, Segoe UI, sans-serif"
              fontStyle="bold"
              fill={color}
              stroke="rgba(2,6,4,0.92)"
              strokeWidth={3 * iconScale}
              fillAfterStrokeEnabled
              listening={false}
            />
          </Group>
        )
      }
      case 'rect': {
        const a = normToScreen(el.a)
        const b = normToScreen(el.b)
        return (
          <Rect
            key={el.id}
            {...common}
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            stroke={color}
            strokeWidth={sw}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            fill={el.fill ? color : undefined}
            fillOpacity={el.fill ? (el.fillOpacity ?? 1) : 1}
          />
        )
      }
      case 'ellipse': {
        const a = normToScreen(el.a)
        const b = normToScreen(el.b)
        return (
          <Ellipse
            key={el.id}
            {...common}
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2}
            radiusX={Math.abs(b.x - a.x) / 2}
            radiusY={Math.abs(b.y - a.y) / 2}
            stroke={color}
            strokeWidth={sw}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            fill={el.fill ? color : undefined}
            fillOpacity={el.fill ? (el.fillOpacity ?? 1) : 1}
          />
        )
      }
      case 'polygon':
        return (
          <Line
            key={el.id}
            {...common}
            points={el.points.flatMap((p) => { const s = normToScreen(p); return [s.x, s.y] })}
            closed
            stroke={color}
            strokeWidth={sw}
            fill={el.fill ? color : undefined}
            fillOpacity={el.fill ? (el.fillOpacity ?? 1) : 1}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            hitStrokeWidth={14}
          />
        )
      case 'text': {
        const at = normToScreen(el.at)
        const fontSize = Math.max(10, el.fontSize * mapW)
        if (el.box) {
          const boxW = Math.max(120, el.text.length * fontSize * 0.62 + 18)
          const boxH = fontSize * 2
          return (
            <Group key={el.id} {...common} x={at.x} y={at.y - boxH / 2}>
              <Rect
                width={boxW}
                height={boxH}
                fill={el.color}
                fillOpacity={0.16}
                stroke={el.color}
                strokeWidth={sw}
                cornerRadius={3}
              />
              <Text
                x={9}
                y={boxH / 2}
                width={boxW - 18}
                text={el.text}
                fontSize={fontSize}
                fontFamily="Inter, Segoe UI, sans-serif"
                fontStyle="bold"
                fill={el.color}
                offsetY={fontSize / 2}
                perfectDrawEnabled={false}
              />
            </Group>
          )
        }
        return (
          <Text
            key={el.id}
            {...common}
            x={at.x}
            y={at.y}
            text={el.text}
            fontSize={fontSize}
            fontFamily="Inter, Segoe UI, sans-serif"
            fontStyle="bold"
            fill={color}
            stroke="rgba(3,7,5,0.85)"
            strokeWidth={Math.max(2, el.fontSize * mapW * 0.12)}
            fillAfterStrokeEnabled
            offsetY={(el.fontSize * mapW) / 2}
            perfectDrawEnabled={false}
          />
        )
      }
      case 'squad': {
        const at = normToScreen(el.at)
        const r = (SQUAD_ICON_PX / 2) * iconScale * iconSize
        const commander = el.squadNumber === 0
        const icon = commander ? assets.commander : assets.squads[String(el.squadNumber)]
        return (
          <Group
            key={el.id}
            {...common}
            x={at.x}
            y={at.y}
            onMouseEnter={() => setHoverSquad({ id: el.squadId, x: at.x, y: at.y })}
            onMouseMove={() => {
              const pointer = stageRef.current?.getPointerPosition()
              if (pointer) setHoverSquad({ id: el.squadId, x: pointer.x, y: pointer.y })
            }}
            onMouseLeave={() => setHoverSquad(null)}
          >
            <Circle radius={r} fill="rgba(0,0,0,0.001)" />
            {!(commander && icon) && (
              <Circle
                radius={r * 0.82}
                fill={commander ? '#2563eb' : '#07110a'}
                stroke="#07110a"
                strokeWidth={1.2 * iconScale}
                listening={false}
              />
            )}
            {icon ? (
              commander ? (
                <KonvaImage image={assetImage(icon)} x={-r} y={-r} width={r * 2} height={r * 2} listening={false} />
              ) : (
                <KonvaImage image={tintedAssetImage(icon, el.squadColor)} x={-r} y={-r} width={r * 2} height={r * 2} listening={false} />
              )
            ) : (
              <Text
                text={commander ? '★' : String(el.squadNumber)}
                x={-r}
                y={-r * 0.66}
                width={r * 2}
                align="center"
                fontSize={r * 1.1}
                fontFamily="Inter, Segoe UI, sans-serif"
                fontStyle="bold"
                fill={commander ? '#facc15' : '#f8fafc'}
                listening={false}
              />
            )}
            {selected && (
              <Circle radius={r} stroke="#fbbf24" strokeWidth={3 * iconScale} listening={false} />
            )}
          </Group>
        )
      }
      case 'icon': {
        const at = normToScreen(el.at)
        return (
          <Group
            key={el.id}
            {...common}
            x={at.x}
            y={at.y}
            rotation={el.rotation}
            onTransformEnd={(e) => {
              const node = e.target
              const rotation = node.rotation()
              node.rotation(0)
              node.scaleX(1)
              node.scaleY(1)
              planner.updateElement(el.id, { rotation })
            }}
          >
            <Circle radius={el.size * mapW * 0.62} fill="rgba(0,0,0,0.001)" />
            <MarkerGlyph icon={el.icon} color={color} size={el.size * mapW} />
          </Group>
        )
      }
      case 'unit': {
        const uColor = selected ? '#fbbf24' : affiliationColor(el.affiliation)
        const at = normToScreen(el.at)
        return (
          <Group key={el.id} {...common} x={at.x} y={at.y} rotation={el.affiliation === 'hostile' ? 45 : 0}>
            <Circle radius={el.size * mapW * 0.62} fill="rgba(0,0,0,0.001)" />
            <IconGlyph icon={glyphFor('marker', el.unit)} color={uColor} size={el.size * mapW} x={0} y={0} />
          </Group>
        )
      }
      default:
        return null
    }
  }

  const draftNode = () => {
    if (!draft) return null
    const sw = Math.max(0.25, ui.width * iconScale)
    if (draft.kind === 'pen') {
      return (
        <Line
          points={draft.points.flatMap((p) => { const s = normToScreen(p); return [s.x, s.y] })}
          stroke={ui.color}
          strokeWidth={sw}
          lineCap="round"
          tension={0.35}
          opacity={0.85}
        />
      )
    }
    if (draft.points.length < 2) return null
    const [a0, b0] = draft.points
    const a = normToScreen(a0)
    const b = normToScreen(b0)
    if (draft.kind === 'line') {
      return (
        <Arrow
          points={[a.x, a.y, b.x, b.y]}
          stroke={ui.color}
          fill={ui.color}
          strokeWidth={sw}
          pointerLength={ui.tool === 'arrow' ? 12 : 0}
          pointerWidth={ui.tool === 'arrow' ? 10 : 0}
          pointerAtBeginning={ui.tool === 'arrow' && ui.arrowBoth}
          dash={ui.dash ? [sw * 3, sw * 2] : undefined}
          opacity={0.85}
        />
      )
    }
    if (draft.kind === 'rect') {
      return (
        <Rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          stroke={ui.color}
          strokeWidth={sw}
          dash={[6, 4]}
          opacity={0.85}
        />
      )
    }
    return (
      <Ellipse
        x={(a.x + b.x) / 2}
        y={(a.y + b.y) / 2}
        radiusX={Math.abs(b.x - a.x) / 2}
        radiusY={Math.abs(b.y - a.y) / 2}
        stroke={ui.color}
        strokeWidth={sw}
        dash={[6, 4]}
        opacity={0.85}
      />
    )
  }

  const pendingNode = () => {
    if (!pending) return null
    const [a0, b0] = pending.points
    const a = normToScreen(a0)
    const b = normToScreen(b0)
    const sw = Math.max(0.25, ui.width * iconScale)
    if (pending.kind === 'line') {
      return (
        <Arrow
          points={[a.x, a.y, b.x, b.y]}
          stroke={ui.color}
          fill={ui.color}
          strokeWidth={sw}
          pointerLength={ui.tool === 'arrow' ? 12 : 0}
          pointerWidth={ui.tool === 'arrow' ? 10 : 0}
          pointerAtBeginning={ui.tool === 'arrow' && ui.arrowBoth}
          dash={ui.dash ? [sw * 3, sw * 2] : undefined}
          opacity={0.85}
          listening={false}
        />
      )
    }
    if (pending.kind === 'ruler') {
      return (
        <Group listening={false}>
          <Line points={[a.x, a.y, b.x, b.y]} stroke={ui.color} strokeWidth={sw} opacity={0.85} />
          <Text
            x={(a.x + b.x) / 2 - 50 * iconScale}
            y={(a.y + b.y) / 2 - 18 * iconScale}
            width={100 * iconScale}
            align="center"
            text={`${Math.round(Math.hypot(b0.x - a0.x, b0.y - a0.y) * layer.world)} m`}
            fontSize={10 * iconScale}
            fontFamily="Inter, Segoe UI, sans-serif"
            fontStyle="bold"
            fill={ui.color}
            listening={false}
          />
        </Group>
      )
    }
    if (pending.kind === 'rect') {
      return (
        <Rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          stroke={ui.color}
          fill={ui.fillShapes ? ui.color : undefined}
          fillOpacity={ui.fillShapes ? ui.fillOpacity : 1}
          strokeWidth={sw}
          dash={[6, 4]}
          opacity={0.85}
          listening={false}
        />
      )
    }
    return (
      <Ellipse
        x={(a.x + b.x) / 2}
        y={(a.y + b.y) / 2}
        radiusX={Math.abs(b.x - a.x) / 2}
        radiusY={Math.abs(b.y - a.y) / 2}
        stroke={ui.color}
        fill={ui.fillShapes ? ui.color : undefined}
        fillOpacity={ui.fillShapes ? ui.fillOpacity : 1}
        strokeWidth={sw}
        dash={[6, 4]}
        opacity={0.85}
        listening={false}
      />
    )
  }

  const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))


  const addVehicleTurn = (vehicle: VehicleSpawn, world: { x: number; z: number }) => {
    const move = stage.moves[vehicle.id]
    if (!move) return
    const existing = stage.turns?.[vehicle.id] ?? []
    const path = [baseVehiclePos(vehicle), ...existing, move]
    let bestIndex = existing.length
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]
      const b = path[i + 1]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const lengthSq = dx * dx + dz * dz || 1
      const t = Math.max(0, Math.min(1, ((world.x - a.x) * dx + (world.z - a.z) * dz) / lengthSq))
      const px = a.x + t * dx
      const pz = a.z + t * dz
      const distance = Math.hypot(world.x - px, world.z - pz)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
    planner.checkpoint()
    planner.setVehicleTurns(vehicle.id, [
      ...existing.slice(0, bestIndex),
      world,
      ...existing.slice(bestIndex),
    ])
  }

  const updateVehicleTurn = (vehicleId: string, index: number, world: { x: number; z: number }) => {
    const existing = [...(stage.turns?.[vehicleId] ?? [])]
    existing[index] = world
    planner.setVehicleTurns(vehicleId, existing)
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[#080c0a]"
      style={{ cursor: preview ? 'default' : stageCursor, pointerEvents: preview ? 'none' : undefined }}
      onPointerDown={() => {
        setFrameSelected(false)
        setPinnedSquadId(null)
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/pr-squad')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        const squadId = e.dataTransfer.getData('text/pr-squad')
        if (!squadId) return
        e.preventDefault()
        const st = stageRef.current
        const commander = squadId === 'commander'
        const index = plan.roster.squads.findIndex((s) => s.id === squadId)
        const squad = commander ? null : plan.roster.squads[index]
        if (!st || (!commander && !squad)) return
        st.setPointersPositions(e.nativeEvent)
        const pointer = st.getPointerPosition()
        if (!pointer) return
        const norm = toNorm({
          x: (pointer.x - view.x) / view.scale,
          y: (pointer.y - view.y) / view.scale,
        })
        const el = {
          ...base(),
          type: 'squad',
          at: norm,
          squadId,
          squadNumber: commander ? 0 : index + 1,
          squadColor: commander ? '#2563eb' : squad!.color,
          size: 0.012,
        } as DrawElement
        planner.addElement(el)
        useUI.getState().setSelected(el.id, 'element')
      }}
    >
      <Stage
        ref={stageRef}
        width={box.w}
        height={box.h}
        listening={!preview}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onWheel={onWheel}
        onMouseDown={onStageDown}
        onMouseMove={(e) => onStageMove(e)}
        onMouseUp={onStageUp}
        onDblClick={() => {
          if (ui.tool === 'polygon') finishPolygon()
        }}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        <Layer listening={false}>
          {image ? (
            <KonvaImage image={image} width={mapW} height={mapH} />
          ) : (
            <Rect width={mapW} height={mapH} fill="#0d1410" />
          )}
        </Layer>

        <Layer>
          {ui.showDrawings && stage.elements.filter((el) => !isIconElement(el)).map(drawElementNode)}
          {polygon.length > 0 && (
            <Line
              points={polygon.flatMap((p) => { const s = normToScreen(p); return [s.x, s.y] })}
              stroke={ui.color}
              strokeWidth={Math.max(0.25, ui.width * iconScale)}
              dash={[8, 5]}
              closed={false}
              listening={false}
            />
          )}
          {draftNode()}
          {pendingNode()}
        </Layer>

        <Layer listening={ui.tool === 'select'}>
          {ui.showFlags && layer.mode !== 'gpm_insurgency' && visibleRoutes.flatMap((route) => {
            const routeIndex = routes.findIndex((item) => item.id === route.id)
            const color = routeColor(routeIndex)
            const groups = groupRoute(layer, route)
              .map((group) => group.cps.filter((cp) => !ui.hiddenCps.includes(cp.id)))
              .filter((group) => group.length > 0)
            const points = groups.map((group) => group.length === 1
              ? group[0]
              : {
                  x: group.reduce((sum, cp) => sum + cp.x, 0) / group.length,
                  z: group.reduce((sum, cp) => sum + cp.z, 0) / group.length,
                })
            const lines: React.ReactNode[] = []
            for (let i = 1; i < points.length; i++) {
              const a = worldToDisplayNorm(points[i - 1].x, points[i - 1].z, layer.world)
              const b = worldToDisplayNorm(points[i].x, points[i].z, layer.world)
              lines.push(
                <Line
                  key={`lane-${route.id}-${i}`}
                  points={[a.x * mapW, a.y * mapH, b.x * mapW, b.y * mapH]}
                  stroke={color}
                  strokeWidth={2.5 * iconScale}
                  opacity={0.45}
                  lineJoin="round"
                  lineCap="round"
                  listening={false}
                />,
              )
            }
            if (layer.mode === 'gpm_cq') {
              groups.forEach((group, groupIndex) => {
                if (group.length < 2) return
                const picks = group.map((cp) => aasPickCount(cp.sgid)).filter((value): value is number => value !== null)
                const alternatives = picks.length > 0 && Math.min(...picks) < group.length
                if (alternatives) {
                  const hub = points[groupIndex]
                  const b = worldToDisplayNorm(hub.x, hub.z, layer.world)
                  group.forEach((cp) => {
                    const a = worldToDisplayNorm(cp.x, cp.z, layer.world)
                    lines.push(
                      <Line
                        key={`alternative-${route.id}-${groupIndex}-${cp.id}`}
                        points={[a.x * mapW, a.y * mapH, b.x * mapW, b.y * mapH]}
                        stroke={color}
                        strokeWidth={1.5 * iconScale}
                        opacity={0.85}
                        dash={[6 * iconScale, 4 * iconScale]}
                        lineCap="round"
                        listening={false}
                      />,
                    )
                  })
                } else {
                  for (let i = 1; i < group.length; i++) {
                    const a = worldToDisplayNorm(group[i - 1].x, group[i - 1].z, layer.world)
                    const b = worldToDisplayNorm(group[i].x, group[i].z, layer.world)
                    lines.push(
                      <Line
                        key={`parallel-${route.id}-${groupIndex}-${i}`}
                        points={[a.x * mapW, a.y * mapH, b.x * mapW, b.y * mapH]}
                        stroke="#f8fafc"
                        strokeWidth={1.5 * iconScale}
                        opacity={0.85}
                        lineCap="round"
                        listening={false}
                      />,
                    )
                  }
                }
              })
            }
            return lines
          })}
          {ui.showFlags && (layer.caches ?? []).map((cache, i) => {
            const icon = assets.markers.cache_objective
            if (!icon) return null
            const p = worldToDisplayNorm(cache.x, cache.z, layer.world)
            const size = CACHE_ICON_PX * iconScale * iconSize
            const outline = size + 4 * iconScale
            return (
              <Group key={`cache-${i}`} x={p.x * mapW} y={p.y * mapH} listening={false}>
                <KonvaImage
                  image={tintedAssetImage(icon, '#07110a')}
                  x={-outline / 2}
                  y={-outline / 2}
                  width={outline}
                  height={outline}
                />
                <KonvaImage
                  image={tintedAssetImage(icon, '#ef4444')}
                  x={-size / 2}
                  y={-size / 2}
                  width={size}
                  height={size}
                />
              </Group>
            )
          })}
          {ui.showFlags && activeCps.map((cp) => {
            if (!cp || ui.hiddenCps.includes(cp.id)) return null
            const p = worldToDisplayNorm(cp.x, cp.z, layer.world)
            const radius = (cp.radius / layer.world) * mapW
            const team = captureTeam(plan, cp)
            const key = team ? layer.factions[String(team)]?.key : undefined
            const flagPath = cpFlag(assets, key)
            const img = flagPath ? assetImage(flagPath) : null
            const w = FLAG_ICON_PX * iconScale * iconSize
            const ratio = img && img.width && img.height ? img.height / img.width : 1
            const h = w * Math.min(1, Math.max(0.4, ratio))
            const index = routes.findIndex((route) => route.cps.includes(cp.id))
            const color = routeColor(Math.max(0, index))
            return (
              <Group
                key={cp.id}
                x={p.x * mapW}
                y={p.y * mapH}
                onClick={(e) => {
                  if (ui.tool !== 'select' || !isCapturable(cp)) return
                  e.cancelBubble = true
                  planner.cycleFlagTeam(cp.id, team)
                }}
                onMouseEnter={() => {
                  setHoverFlag({
                    cp,
                    x: p.x * mapW * view.scale + view.x,
                    y: p.y * mapH * view.scale + view.y,
                  })
                }}
                onMouseLeave={() => setHoverFlag(null)}
              >
                <Circle radius={w * 0.55} fill="rgba(0,0,0,0.001)" />
                {radius > 0 && (
                  <Circle
                    radius={radius}
                    fill={withAlpha(color, 0.16)}
                    stroke={withAlpha(color, 0.85)}
                    strokeWidth={1.5 * iconScale}
                    listening={false}
                  />
                )}
                {img ? (
                  <KonvaImage
                    image={img}
                    x={-w * FLAG_ANCHOR_X}
                    y={-h * FLAG_ANCHOR_Y}
                    width={w}
                    height={h}
                    listening={false}
                    shadowColor="#020604"
                    shadowBlur={3 * iconScale}
                    shadowOpacity={0.85}
                  />
                ) : (
                  <IconGlyph icon="flag" color={color} size={w} x={0} y={0} />
                )}
                {ui.showLabels && (
                  <Text
                    text={cp.name}
                    fontSize={10.5 * iconScale * iconSize}
                    fontFamily="Inter, Segoe UI, sans-serif"
                    fontStyle="bold"
                    fill={MAP_TEXT_FILL}
                    stroke={MAP_TEXT_OUTLINE}
                    strokeWidth={MAP_TEXT_OUTLINE_PX * iconScale * iconSize}
                    fillAfterStrokeEnabled
                    y={h / 2 + 3 * iconScale * iconSize}
                    width={180 * iconScale * iconSize}
                    align="center"
                    x={-90 * iconScale * iconSize}
                    listening={false}
                  />
                )}
              </Group>
            )
          })}
        </Layer>

        <Layer imageSmoothingEnabled={false}>
          {layer.vehicles.filter(vehicleVisible).map((v) => {
            const pos = vehiclePosition(v)
            const p = worldToDisplayNorm(pos.x, pos.z, layer.world)
            const move = stage.moves[v.id]
            const color = vehicleColor(v, plan, squadColors)
            const s = vehicleIconPx(v.category) * iconScale * iconSize * VEHICLE_ICON_SCALE
            const nodeId = `veh_${v.id}`
            const selected = !preview && ui.selectedId === nodeId
            const commanderClaim = plan.claims[v.id] === 'commander'
            const claimIndex = plan.roster.squads.findIndex((q) => q.id === plan.claims[v.id])
            const claimPrefix = commanderClaim ? '[★] ' : claimIndex >= 0 ? `[${claimIndex + 1}] ` : ''
            const turns = stage.turns?.[v.id] ?? []
            const base = baseVehiclePos(v)
            const drag = dragVehicle?.id === v.id ? dragVehicle : null
            const ready = vehicleReady(v, stage.time)
            const delayRemaining = vehicleDelayRemaining(v, stage.time)
            const endpoint = drag ? { x: drag.x, z: drag.z } : move
            const routeTurns = turns.map((turn, index) =>
              dragTurn?.vehicleId === v.id && dragTurn.index === index
                ? { x: dragTurn.x, z: dragTurn.z }
                : turn
            )
            const route = (move || drag) && endpoint
              ? [base, ...routeTurns, endpoint].map((q) => {
                  const d = worldToDisplayNorm(q.x, q.z, layer.world)
                  return [d.x * mapW, d.y * mapH] as [number, number]
                })
              : []
            const dp = drag ? worldToDisplayNorm(drag.x, drag.z, layer.world) : p
            const showName = hoverVehicleId === v.id || (ui.showVehicleNames && (view.scale >= 0.55 || selected || commanderClaim || claimIndex >= 0))
            return (
              <Group
                key={v.id}
                onMouseEnter={() => {
                  setHoverVehicleId(v.id)
                  const pointer = stageRef.current?.getPointerPosition()
                  if (pointer) setHoverCrew({ id: v.id, x: pointer.x, y: pointer.y })
                }}
                onMouseMove={() => {
                  const pointer = stageRef.current?.getPointerPosition()
                  if (pointer) setHoverCrew({ id: v.id, x: pointer.x, y: pointer.y })
                }}
                onMouseLeave={() => {
                  setHoverVehicleId(null)
                  setHoverCrew(null)
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault()
                  e.cancelBubble = true
                  if (!move) return
                  planner.checkpoint()
                  planner.clearVehicleMove(v.id)
                }}
              >
                {route.length > 1 && ui.showVehiclePaths && !ui.hiddenVehiclePaths.includes(v.id) && (
                  <Line
                    points={route.flatMap(([x, y]) => [x, y])}
                    stroke={color}
                    strokeWidth={2 * iconScale}
                    opacity={0.82}
                    lineCap="round"
                    lineJoin="round"
                    hitStrokeWidth={20 * iconScale}
                    listening={ui.tool === 'select' && ready}
                    onClick={(e) => {
                      if (ui.tool !== 'select' || !ready) return
                      e.cancelBubble = true
                      if (!selected) {
                        useUI.getState().setSelected(nodeId, 'vehicle')
                        useUI.getState().setRightTab('assets')
                        return
                      }
                      const m = mapCoords()
                      const world = displayNormToWorld({ x: m.x / mapW, y: m.y / mapH }, layer.world)
                      addVehicleTurn(v, world)
                    }}
                  />
                )}
                {selected && ui.showVehiclePaths && !ui.hiddenVehiclePaths.includes(v.id) && turns.map((turn, i) => {
                  const d = worldToDisplayNorm(turn.x, turn.z, layer.world)
                  return (
                    <Circle
                      key={`turn-${i}`}
                      x={d.x * mapW}
                      y={d.y * mapH}
                      radius={5 * iconScale}
                      fill="#fbbf24"
                      stroke="#07110a"
                      strokeWidth={1.5 * iconScale}
                      draggable={ready}
                      onDragStart={() => planner.checkpoint()}
                      onDragMove={(e) => {
                        const node = e.target
                        const world = displayNormToWorld({ x: node.x() / mapW, y: node.y() / mapH }, layer.world)
                        setDragTurn({ vehicleId: v.id, index: i, x: world.x, z: world.z })
                      }}
                      onDragEnd={(e) => {
                        const node = e.target
                        updateVehicleTurn(v.id, i, displayNormToWorld({ x: node.x() / mapW, y: node.y() / mapH }, layer.world))
                        setDragTurn(null)
                      }}
                      onContextMenu={(e) => {
                        e.evt.preventDefault()
                        e.cancelBubble = true
                        planner.checkpoint()
                        planner.setVehicleTurns(v.id, turns.filter((_, index) => index !== i))
                      }}
                    />
                  )
                })}
                <Group
                  id={nodeId}
                  x={p.x * mapW}
                  y={p.y * mapH}
                  rotation={vehicleSpriteRotation(layer.id, pos.rotation)}
                  draggable={ui.tool === 'select' && ready}
                  listening={ui.tool === 'select' || ui.tool === 'erase'}
                  opacity={1}
                  onClick={(e) => {
                    e.cancelBubble = true
                    if (ui.tool === 'erase') {
                      planner.clearVehicleMove(v.id)
                      return
                    }
                    if (ui.tool === 'select') {
                      useUI.getState().setSelected(nodeId, 'vehicle')
                      useUI.getState().setRightTab('assets')
                    }
                  }}
                  onDragStart={() => planner.checkpoint()}
                  onDragMove={(e) => {
                    const node = e.target
                    const world = displayNormToWorld({ x: node.x() / mapW, y: node.y() / mapH }, layer.world)
                    setDragVehicle({
                      id: v.id,
                      x: world.x,
                      z: world.z,
                      screenX: node.x() * view.scale + view.x,
                      screenY: node.y() * view.scale + view.y,
                    })
                  }}
                  onDragEnd={(e) => {
                    const node = e.target
                    const world = displayNormToWorld({ x: node.x() / mapW, y: node.y() / mapH }, layer.world)
                    planner.moveVehicle(v.id, { x: world.x, z: world.z, rotation: pos.rotation })
                    setDragVehicle(null)
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target
                    const rotation = (180 + vehicleSpriteOffset(layer.id) - node.rotation() + 360) % 360
                    node.rotation(0)
                    node.scaleX(1)
                    node.scaleY(1)
                    planner.moveVehicle(v.id, { x: pos.x, z: pos.z, rotation: (rotation + 360) % 360 })
                  }}
                >
                  <Circle radius={s * 0.5} fill="rgba(0,0,0,0.001)" />
                  {(() => {
                    const iconPath = vehicleIconPath(assets, v)
                    const selectedColor = selected ? (ready ? '#fbbf24' : '#94a3b8') : color
                    if (!iconPath) {
                      return <IconGlyph icon={glyphFor('vehicle', v.category)} color={selectedColor} size={s} x={0} y={0} />
                    }
                    return (
                      <KonvaImage
                        image={tintedAssetImage(iconPath, selectedColor)}
                        x={-s / 2}
                        y={-s / 2}
                        width={s}
                        height={s}
                        listening={false}
                      />
                    )
                  })()}
                </Group>
                {!ready && showName && (
                  <Text
                    text={formatTime(delayRemaining)}
                    fontSize={10 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    fontFamily="Inter, Segoe UI, sans-serif"
                    fontStyle="bold"
                    fill="#94a3b8"
                    stroke="rgba(2,6,4,0.92)"
                    strokeWidth={3 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    fillAfterStrokeEnabled
                    y={dp.y * mapH + s * 0.56 + 11 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    width={100 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    align="center"
                    x={dp.x * mapW - 50 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    listening={false}
                  />
                )}
                {showName && (
                  <Text
                    text={`${claimPrefix}${v.label}`}
                    fontSize={9 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    fontFamily="Inter, Segoe UI, sans-serif"
                    fontStyle="bold"
                    fill={selected ? (ready ? '#fbbf24' : '#94a3b8') : color}
                    stroke={MAP_TEXT_OUTLINE}
                    strokeWidth={MAP_TEXT_OUTLINE_PX * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    fillAfterStrokeEnabled
                    y={dp.y * mapH + s * 0.56}
                    width={240 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    align="center"
                    x={dp.x * mapW - 120 * iconScale * VEHICLE_TEXT_SCALE * iconSize}
                    listening={false}
                  />
                )}
              </Group>
            )
          })}
        </Layer>

        <Layer imageSmoothingEnabled={false}>
          {ui.showDrawings && stage.elements.filter(isIconElement).map(drawElementNode)}
        </Layer>
      </Stage>

      {!preview && (() => {
        const fx = frameDraft.x * mapW * view.scale + view.x
        const fy = frameDraft.y * mapH * view.scale + view.y
        const fw = frameDraft.size * mapW * view.scale
        const fh = frameDraft.size * mapH * view.scale
        const mapX = view.x
        const mapY = view.y
        const mapRight = view.x + mapW * view.scale
        const mapBottom = view.y + mapH * view.scale
        const handles = [
          { mode: 'nw', x: fx, y: fy, cursor: 'nwse-resize' },
          { mode: 'n', x: fx + fw / 2, y: fy, cursor: 'ns-resize' },
          { mode: 'ne', x: fx + fw, y: fy, cursor: 'nesw-resize' },
          { mode: 'e', x: fx + fw, y: fy + fh / 2, cursor: 'ew-resize' },
          { mode: 'se', x: fx + fw, y: fy + fh, cursor: 'nwse-resize' },
          { mode: 's', x: fx + fw / 2, y: fy + fh, cursor: 'ns-resize' },
          { mode: 'sw', x: fx, y: fy + fh, cursor: 'nesw-resize' },
          { mode: 'w', x: fx, y: fy + fh / 2, cursor: 'ew-resize' },
        ]
        return (
          <div className="pointer-events-none absolute inset-0 z-[5]">
            <div className="absolute bg-black/55" style={{ left: mapX, top: mapY, width: Math.max(0, mapRight - mapX), height: Math.max(0, Math.min(fy, mapBottom) - mapY) }} />
            <div className="absolute bg-black/55" style={{ left: mapX, top: Math.min(mapBottom, Math.max(mapY, fy + fh)), width: Math.max(0, mapRight - mapX), height: Math.max(0, mapBottom - Math.max(mapY, fy + fh)) }} />
            <div className="absolute bg-black/55" style={{ left: mapX, top: Math.min(mapBottom, Math.max(mapY, fy)), width: Math.max(0, Math.min(fx, mapRight) - mapX), height: Math.max(0, Math.min(mapBottom, fy + fh) - Math.max(mapY, fy)) }} />
            <div className="absolute bg-black/55" style={{ left: Math.min(mapRight, Math.max(mapX, fx + fw)), top: Math.min(mapBottom, Math.max(mapY, fy)), width: Math.max(0, mapRight - Math.max(mapX, fx + fw)), height: Math.max(0, Math.min(mapBottom, fy + fh) - Math.max(mapY, fy)) }} />
            <div
              className={`absolute border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.8)] ${frameSelected ? 'border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]' : 'border-amber-400/35'}`}
              style={{ left: fx, top: fy, width: fw, height: fh }}
            />
            {([
              { mode: 'n', x: fx, y: fy, w: fw, h: 8, cursor: 'move' },
              { mode: 's', x: fx, y: fy + fh - 8, w: fw, h: 8, cursor: 'move' },
              { mode: 'w', x: fx, y: fy, w: 8, h: fh, cursor: 'move' },
              { mode: 'e', x: fx + fw - 8, y: fy, w: 8, h: fh, cursor: 'move' },
            ] as const).map((edge) => (
              <div
                key={`edge-${edge.mode}`}
                className="pointer-events-auto absolute"
                style={{ left: edge.x, top: edge.y, width: edge.w, height: edge.h, cursor: edge.cursor }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setFrameSelected(true)
                  if (!frameSelected) return
                  planner.checkpoint()
                  const p = clientToFrameNorm(e.clientX, e.clientY)
                  setFrameDrag({ mode: 'move', startX: p.x, startY: p.y, frame: frameDraft })
                }}
              />
            ))}
            {frameSelected && handles.map((h) => {
              const hx = clamp(h.x, 6, box.w - 6)
              const hy = clamp(h.y, 6, box.h - 6)
              return (
                <button
                  key={h.mode}
                  type="button"
                  title="Drag to resize export frame"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setFrameSelected(true)
                    planner.checkpoint()
                    const p = clientToFrameNorm(e.clientX, e.clientY)
                    setFrameDrag({ mode: h.mode, startX: p.x, startY: p.y, frame: frameDraft })
                  }}
                  className="pointer-events-auto absolute h-3 w-3 rounded-sm border border-amber-200 bg-amber-400 shadow"
                  style={{ left: hx, top: hy, transform: 'translate(-50%, -50%)', cursor: h.cursor }}
                />
              )
            })}
          </div>
        )
      })()}

      {!preview && (dragVehicle || selectedScreen) && selectedVehicle && ui.tool === 'select' && (() => {
        const screen = dragVehicle?.id === selectedVehicle.id
          ? { x: dragVehicle.screenX, y: dragVehicle.screenY }
          : selectedScreen!
        const angle = selectedVehiclePos
          ? vehicleSpriteRotation(layer.id, previewRotation ?? selectedVehiclePos.rotation)
          : 0
        const rad = (angle * Math.PI) / 180
        const handleRadius = 42
        const locked = !vehicleReady(selectedVehicle, stage.time)
        return (
          <div className="pointer-events-none absolute z-10" style={{ left: screen.x, top: screen.y }}>
            <div className={`absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed ${locked ? 'border-slate-400/80' : 'border-amber-400/80'}`} />
            {locked && (
              <span className="absolute left-0 top-[-34px] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-400/60 bg-[#0b110d]">
                <Lock className="h-2.5 w-2.5 text-slate-300" />
              </span>
            )}
            {vehicleReady(selectedVehicle, stage.time) && (
            <button
              title="Drag to rotate asset"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                planner.checkpoint()
                e.currentTarget.setPointerCapture(e.pointerId)
                if (selectedVehiclePos) {
                  rotateStart.current = {
                    angle: pointerAngle(e.clientX, e.clientY),
                    rotation: selectedVehiclePos.rotation,
                  }
                  setPreviewRotation(selectedVehiclePos.rotation)
                }
              }}
              onPointerMove={(e) => {
                if (rotateStart.current) rotateFromPointer(e.clientX, e.clientY)
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                }
                rotateStart.current = null
                setPreviewRotation(null)
              }}
              onPointerCancel={() => {
                rotateStart.current = null
                setPreviewRotation(null)
              }}
              style={{
                left: Math.sin(rad) * handleRadius,
                top: -Math.cos(rad) * handleRadius,
                transform: 'translate(-50%, -50%)',
              }}
              className="pointer-events-auto absolute flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-black/70 bg-amber-400 text-black shadow-lg active:cursor-grabbing"
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} style={{ transform: `rotate(${angle}deg)` }} />
            </button>
            )}
          </div>
        )
      })()}

      {!preview && textAt && (() => {
        const at = normToScreen(textAt)
        return (
        <div
          className="absolute z-20"
          style={{
            left: clamp(at.x * view.scale + view.x, 8, box.w - 280),
            top: clamp(at.y * view.scale + view.y - 16, 8, box.h - 80),
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addText()
            }}
            className="flex items-center gap-1 rounded border border-amber-400/50 bg-[#0b110d] p-1 shadow-2xl"
          >
            <input
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={addText}
              placeholder={textBoxMode ? 'Text box content' : 'Label text'}
              className="w-52 bg-transparent px-2 py-1 text-sm text-slate-100 outline-none"
            />
            <button type="submit" className="rounded bg-amber-400 px-2 py-1 text-xs font-bold text-black">OK</button>
          </form>
        </div>
        )
      })()}

      {!preview && (plan.roster.squads.length > 0 || plan.roster.commander) && (
        <div className="absolute bottom-16 right-3 z-20 flex flex-col gap-0.5 rounded border border-white/10 bg-black/65 px-2.5 py-2">
          {plan.roster.commander && (
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/pr-squad', 'commander')
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onMouseEnter={() => setHoverSquad({ id: 'commander', x: 0, y: 0 })}
            onMouseLeave={() => setHoverSquad(null)}
            onClick={() => setPinnedSquadId((current) => current === 'commander' ? null : 'commander')}
            className="flex cursor-grab items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-200 active:cursor-grabbing"
            title="Drag onto the map to place a commander marker"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              {assets.commander ? (
                <GameIcon path={assets.commander} size={24} />
              ) : (
                <span className="text-[13px] font-bold text-[#facc15]">★</span>
              )}
            </span>
            <span>CMD</span>
          </div>
          )}
          {plan.roster.squads.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/pr-squad', s.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onMouseEnter={() => setHoverSquad({ id: s.id, x: 0, y: 0 })}
              onMouseLeave={() => setHoverSquad(null)}
              onClick={() => setPinnedSquadId((current) => current === s.id ? null : s.id)}
              className="flex cursor-grab items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-200 active:cursor-grabbing"
              title="Drag onto the map to place a squad marker"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#07110a]">
                {assets.squads[String(i + 1)] ? (
                  <GameIcon path={assets.squads[String(i + 1)]} tint={s.color} size={24} />
                ) : (
                  <span className="font-mono text-[10px] font-bold text-slate-100">{i + 1}</span>
                )}
              </span>
              <span className="max-w-36 truncate">{(s.name || `SQUAD ${i + 1}`).toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      {!preview && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded border border-white/10 bg-black/70 p-1">
          <button className="h-7 w-7 rounded text-slate-300 hover:bg-white/10" onClick={() => zoomBy(0.8)} title="Zoom out">−</button>
          <button className="h-7 min-w-12 rounded px-1 text-[10px] font-mono text-slate-400 hover:bg-white/10" onClick={resetView} title="Fit map">
            {Math.round(view.scale * 100)}%
          </button>
          <button className="h-7 w-7 rounded text-slate-300 hover:bg-white/10" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
        </div>
      )}

      {!preview && hoverFlag && (() => {
        const team = captureTeam(plan, hoverFlag.cp)
        const capturable = isCapturable(hoverFlag.cp)
        return (
          <div
            className="pointer-events-none absolute right-3 top-3 z-30 w-fit min-w-[7.5rem] max-w-[9rem] rounded border border-white/15 bg-[#0b110d]/95 px-2.5 py-2 text-[10px] shadow-2xl"
          >
            <div className="text-[12px] font-semibold text-slate-100">{hoverFlag.cp.name}</div>
            <div className="mt-1 font-mono uppercase tracking-wider text-slate-500">Owner · {teamName(layer, team)}</div>
            {capturable ? (
              <>
                <div className="mt-1 text-slate-300">Ticket loss on capture: <span className="font-mono text-amber-300">{layer.tickets?.loss ?? 30}</span></div>
                <div className="mt-1 text-[9px] uppercase tracking-wider text-slate-600">Click to cycle neutral / faction</div>
              </>
            ) : (
              <div className="mt-1 text-slate-400">Deployment flag · cannot be captured or switched.</div>
            )}
          </div>
        )
      })()}

      {!preview && (hoverSquad || selectedSquadId || pinnedSquadId) && (() => {
        const squadPopupId = hoverSquad?.id ?? selectedSquadId ?? pinnedSquadId
        const squad = plan.roster.squads.find((item) => item.id === squadPopupId)
        const isCommander = squadPopupId === 'commander'
        const commanderMember = isCommander ? plan.roster.commander : null
        const members = squad ? squad.members : commanderMember ? [commanderMember] : []
        const squadIndex = squad ? plan.roster.squads.findIndex((item) => item.id === squad.id) : -1
        const squadIcon = squad ? assets.squads[String(squadIndex + 1)] : assets.commander
        return (
          <div
            className="pointer-events-none absolute right-3 top-3 z-30 w-fit min-w-32 max-w-40 rounded border border-white/15 bg-[#0b110d]/95 px-2.5 py-2 text-[10px] shadow-2xl"
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-100">
              {squadIcon && (
                isCommander ? (
                  <GameIcon path={squadIcon} size={24} />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/50">
                    <GameIcon path={squadIcon} tint={squad?.color ?? '#facc15'} size={24} />
                  </span>
                )
              )}
              <span className="truncate">{isCommander ? 'CMD' : (squad?.name || 'SQUAD').toUpperCase()}</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {members.map((member, index) => {
                const kits = assignedKits(plan.roster.specialistAssignments, member.id)
                const dotColor = squad?.color ?? '#facc15'
                return (
                  <div key={member.id} className="flex items-center gap-2">
                    {isCommander || index === 0 ? (
                      <span
                        className="w-3 shrink-0 text-center text-[11px] leading-none"
                        style={{ color: isCommander ? '#facc15' : dotColor }}
                      >
                        ★
                      </span>
                    ) : (
                      <span className="flex w-3 shrink-0 justify-center">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-slate-300">{member.name}</span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {kits.map((kitId, index) => (
                        <img key={`${kitId}-${index}`} src={dataUrl(`icons/kits/${kitId}.webp`)} alt="" className="h-4 w-4 object-contain" />
                      ))}
                    </span>
                  </div>
                )
              })}
              {members.length === 0 && <span className="text-[9px] text-slate-600">No players</span>}
            </div>
          </div>
        )
      })()}

      {!preview && (hoverCrew || selectedVehicle) && (() => {
        const popupVehicleId = hoverCrew?.id ?? selectedVehicle?.id
        const vehicle = popupVehicleId ? layer.vehicles.find((item) => item.id === popupVehicleId) : undefined
        if (!vehicle) return null
        const delayed = !vehicleReady(vehicle, stage.time)
        const crew = plan.vehicleCrew?.[vehicle.id] ?? []
        const allMembers = [
          ...(plan.roster.commander ? [plan.roster.commander] : []),
          ...plan.roster.squads.flatMap((squad) => squad.members),
          ...plan.roster.unassigned,
        ]
        const crewMembers = crew.map((id) => {
          const member = allMembers.find((item) => item.id === id)
          if (!member) return null
          const memberSquad = plan.roster.squads.find((item) => item.members.some((m) => m.id === id))
          return {
            id,
            name: member.name,
            color: memberSquad?.color ?? (plan.roster.commander?.id === id ? '#facc15' : '#64748b'),
          }
        }).filter(Boolean)
        const squad = plan.roster.squads.find((item) => item.id === plan.claims[vehicle.id])
        const squadIndex = squad ? plan.roster.squads.findIndex((item) => item.id === squad.id) : -1
        const squadIcon = squad ? assets.squads[String(squadIndex + 1)] : undefined
        return (
          <div
            className="pointer-events-none absolute right-3 top-3 z-30 w-fit min-w-[7.5rem] max-w-36 rounded border border-white/15 bg-[#0b110d]/95 px-2.5 py-2 text-[10px] shadow-2xl"
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-100">
              <span className="truncate">{vehicle.label}</span>
              {delayed && <Lock className="h-3 w-3 shrink-0 text-slate-400" />}
            </div>
            {squad && (
              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-300">
                {squadIcon && <GameIcon path={squadIcon} tint={squad.color} size={24} />}
                <span className="truncate">{squad.name}</span>
              </div>
            )}
            <div className="mt-1.5 text-[9px] uppercase tracking-wider text-slate-500">Crew</div>
            {crewMembers.length > 0 ? (
              <div className="mt-1 flex flex-col gap-0.5 text-slate-300">
                {crewMembers.map((member) => (
                  <div key={member!.id} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: member!.color }} />
                    <span className="truncate">{member!.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-1 text-[9px] text-slate-600">No crew assigned</div>
            )}
          </div>
        )
      })()}

      {!preview && ui.tool === 'polygon' && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded border border-white/10 bg-black/80 px-3 py-1.5 text-[11px] text-slate-300">
          <span>Click to add points · close on first point · {polygon.length} placed</span>
          <button
            onClick={finishPolygon}
            disabled={polygon.length < 3}
            className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-black disabled:opacity-30"
          >
            Finish
          </button>
          <button
            onClick={() => {
              polygonRef.current = []
              setPolygon([])
            }}
            className="rounded border border-white/15 px-2 py-0.5 text-[10px] uppercase text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      )}

    </div>
  )
}



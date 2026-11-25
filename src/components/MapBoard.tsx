import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Rect, Ellipse, Text, Group, Arrow, Circle } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { DrawElement, LayerData, MapMeta, Plan, Point, Stage as PlanStage, VehicleSpawn } from '../types'
import { usePlanner, useUI } from '../store'
import { affiliationColor, clamp, dataUrl, SQUAD_COLORS } from '../lib/utils'
import { glyphFor, iconImage } from '../icons'
import { vehicleColor, worldToNorm } from '../lib/render'
import { cpFlag, useAssets } from '../lib/assets'
import { assetImage, preloadAsset, tintedAssetImage } from '../lib/gameIcons'
import { routeColor } from './RoutesPanel'

interface Props {
  map: MapMeta
  layer: LayerData
  plan: Plan
  stage: PlanStage
}

interface Draft {
  kind: 'pen' | 'line' | 'rect' | 'ellipse'
  points: Point[]
}

type ShapeKind = 'line' | 'rect' | 'ellipse'

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

export function MapBoard({ map, layer, plan, stage }: Props) {
  const ui = useUI()
  const assets = useAssets()
  const planner = usePlanner()
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [rotating, setRotating] = useState(false)
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
  const panStart = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null)
  const panMoved = useRef(false)
  const [panning, setPanning] = useState(false)
  const [polygon, setPolygon] = useState<Point[]>([])
  const polygonRef = useRef<Point[]>([])
  const pendingText = useRef<Point | null>(null)
  const [textAt, setTextAt] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')
  const [tick, setTick] = useState(0)
  const fitted = useRef<string>('')

  const routes = layer.routes ?? []
  const routeIndex = Math.max(0, routes.findIndex((r) => r.id === ui.routeId))
  const activeRoute = routes[routeIndex]
  const activeCps = activeRoute
    ? activeRoute.cps.map((id) => layer.controlPoints.find((c) => c.id === id)).filter(Boolean)
    : layer.controlPoints
  const laneColor = routeColor(routeIndex)

  const imageUrl = map.images ? dataUrl(`maps/${map.images.image}`) : null
  const image = useMapImage(imageUrl)
  const mapW = map.images?.width ?? 2048
  const mapH = map.images?.height ?? 2048
  const fitScale = Math.min(box.w / mapW, box.h / mapH) * 0.94

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
    const key = `${map.id}:${box.w}x${box.h}`
    if (fitted.current === key) return
    fitted.current = key
    const s = Math.min(box.w / mapW, box.h / mapH) * 0.94
    setView({ scale: s, x: (box.w - mapW * s) / 2, y: (box.h - mapH * s) / 2 })
  }, [box, map.id, mapW, mapH])

  // Warm the game-icon cache used by this layer and plan.
  useEffect(() => {
    const jobs: Promise<void>[] = []
    const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))
    for (const cp of layer.controlPoints) {
      const key = cp.team ? layer.factions[String(cp.team)]?.key : undefined
      const path = cpFlag(assets, key)
      if (path) jobs.push(preloadAsset(path))
    }
    for (const v of layer.vehicles) {
      const path = assets.vehicles[v.icon] ?? assets.vehicles[v.category] ?? assets.vehicles.other
      if (!path) continue
      jobs.push(preloadAsset(path))
      jobs.push(preloadAsset(path, vehicleColor(v, plan, squadColors)))
    }
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

  const toNorm = useCallback((p: { x: number; y: number }): Point => ({ x: p.x / mapW, y: p.y / mapH }), [mapW, mapH])

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
    const old = view.scale
    const dir = e.evt.deltaY > 0 ? 0.9 : 1.1
    const next = clamp(old * dir, Math.max(0.02, fitScale * 0.4), 20)
    const wx = (pointer.x - view.x) / old
    const wy = (pointer.y - view.y) / old
    setView({ scale: next, x: pointer.x - wx * next, y: pointer.y - wy * next })
  }

  const zoomBy = (factor: number) => {
    const old = view.scale
    const next = clamp(old * factor, Math.max(0.02, fitScale * 0.4), 20)
    const cx = box.w / 2
    const cy = box.h / 2
    const wx = (cx - view.x) / old
    const wy = (cy - view.y) / old
    setView({ scale: next, x: cx - wx * next, y: cy - wy * next })
  }

  const resetView = () => {
    const s = Math.min(box.w / mapW, box.h / mapH) * 0.94
    setView({ scale: s, x: (box.w - mapW * s) / 2, y: (box.h - mapH * s) / 2 })
  }

  const commitShape = (kind: ShapeKind, a: Point, b: Point) => {
    const state = useUI.getState()
    if (kind === 'line') {
      commit({
        ...base(),
        type: 'line',
        a,
        b,
        arrow: state.tool === 'arrow' ? (state.arrowBoth ? 'both' : 'end') : 'none',
        dash: state.tool === 'dashed' || state.dash,
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
    if (e.evt.button === 1) return
    const st = stageRef.current
    if (!st) return
    const state = useUI.getState()
    const tool = state.tool
    if (tool === 'select') {
      if (e.target !== st) return
      const p = st.getPointerPosition()
      if (!p) return
      panStart.current = { px: p.x, py: p.y, vx: view.x, vy: view.y }
      panMoved.current = false
      setPanning(false)
      return
    }
    if (tool === 'erase') {
      if (e.target === st) state.setSelected(null, null)
      return
    }
    const pos = mapCoords()
    if (tool === 'text') {
      pendingText.current = toNorm(pos)
      return
    }
    if (tool === 'marker') {
      commit({ ...base(), type: 'icon', at: toNorm(pos), icon: state.markerIcon, rotation: 0, size: 0.022 } as DrawElement)
      return
    }
    if (tool === 'unit') {
      commit({ ...base(), type: 'unit', at: toNorm(pos), unit: state.unitKind, affiliation: state.unitAffiliation, size: 0.026 } as DrawElement)
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
    if (['line', 'arrow', 'dashed', 'rect', 'ellipse'].includes(tool)) {
      const kind: ShapeKind = tool === 'rect' ? 'rect' : tool === 'ellipse' ? 'ellipse' : 'line'
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

  const onStageMove = () => {
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
      setView((v) => ({ ...v, x: panStart.current!.vx + dx, y: panStart.current!.vy + dy }))
      return
    }
    if (pendingRef.current) {
      const n = toNorm(mapCoords())
      setPendingShape({ ...pendingRef.current, points: [pendingRef.current.points[0], n] })
      return
    }
    if (!draft) return
    const n = toNorm(mapCoords())
    if (draft.kind === 'pen' && pointerDown.current) {
      const last = draft.points[draft.points.length - 1]
      if (Math.hypot(n.x - last.x, n.y - last.y) > 0.0018) {
        setDraft({ ...draft, points: [...draft.points, n] })
      }
    }
  }

  const onStageUp = () => {
    if (panStart.current) {
      const moved = panMoved.current
      panStart.current = null
      panMoved.current = false
      setPanning(false)
      if (!moved) useUI.getState().setSelected(null, null)
      return
    }
    if (pendingText.current && useUI.getState().tool === 'text') {
      const pos = pendingText.current
      pendingText.current = null
      setTextAt(pos)
      setTextValue('')
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
    commit({ ...base(), type: 'text', at: textAt, text: textValue.trim(), fontSize: 0.021 } as DrawElement)
    setTextAt(null)
    setTextValue('')
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
    if (ui.tool !== 'text') {
      pendingText.current = null
      setTextAt(null)
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
        if (ui.selectedKind === 'element') planner.removeElement(ui.selectedId)
        else if (ui.selectedKind === 'vehicle') planner.clearVehicleMove(ui.selectedId)
        useUI.getState().setSelected(null, null)
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

  const selectedVehicle = useMemo(() => {
    if (ui.selectedKind !== 'vehicle') return null
    return layer.vehicles.find((v) => `veh_${v.id}` === ui.selectedId) ?? null
  }, [layer.vehicles, ui.selectedId, ui.selectedKind])

  const selectedVehiclePos = selectedVehicle
    ? stage.moves[selectedVehicle.id] ?? { x: selectedVehicle.x, z: selectedVehicle.z, rotation: selectedVehicle.rotation }
    : null

  const selectedScreen = selectedVehiclePos
    ? {
        x: ((selectedVehiclePos.x + layer.world / 2) / layer.world) * mapW * view.scale + view.x,
        y: ((selectedVehiclePos.z + layer.world / 2) / layer.world) * mapH * view.scale + view.y,
      }
    : null

  const rotateFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current
    if (!el || !selectedVehicle || !selectedVehiclePos) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + ((selectedVehiclePos.x + layer.world / 2) / layer.world) * mapW * view.scale + view.x
    const cy = rect.top + ((selectedVehiclePos.z + layer.world / 2) / layer.world) * mapH * view.scale + view.y
    const angle = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90
    planner.moveVehicle(selectedVehicle.id, {
      x: selectedVehiclePos.x,
      z: selectedVehiclePos.z,
      rotation: (angle + 360) % 360,
    })
  }, [selectedVehicle, selectedVehiclePos, layer.world, mapW, mapH, view, planner])

  useEffect(() => {
    if (!rotating) return
    const move = (e: PointerEvent) => rotateFromPointer(e.clientX, e.clientY)
    const up = () => setRotating(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [rotating, rotateFromPointer])

  const vehicleVisible = (v: VehicleSpawn) => {
    if (v.team !== null && v.team !== plan.side && !ui.showEnemy) return false
    if (['asset', 'crate', 'emplacement'].includes(v.category) && !ui.showAssets) return false
    return ui.showVehicles
  }

  const iconScale = 1 / view.scale
  const stageCursor = panning ? 'grabbing' : ui.tool === 'select' ? 'default' : 'crosshair'

  const drawElementNode = (el: DrawElement) => {
    const selected = ui.selectedId === el.id
    const color = selected ? '#fbbf24' : el.color
    const sw = Math.max(1, (el.width * mapW) / 1000)
    const common = {
      id: el.id,
      draggable: ui.tool === 'select',
      listening: ui.tool === 'select' || ui.tool === 'erase',
      opacity: el.opacity,
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
        const dx = node.x() / mapW
        const dy = node.y() / mapH
        const patch = (() => {
          if (el.type === 'text' || el.type === 'icon' || el.type === 'unit') {
            return { at: { x: el.at.x + dx, y: el.at.y + dy } }
          }
          if (el.type === 'line' || el.type === 'rect' || el.type === 'ellipse') {
            return {
              a: { x: el.a.x + dx, y: el.a.y + dy },
              b: { x: el.b.x + dx, y: el.b.y + dy },
            }
          }
          if (el.type === 'pen' || el.type === 'polygon') {
            return { points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
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
            points={el.points.flatMap((p) => [p.x * mapW, p.y * mapH])}
            stroke={color}
            strokeWidth={sw}
            lineCap="round"
            lineJoin="round"
            tension={0.35}
            hitStrokeWidth={14}
          />
        )
      case 'line':
        return (
          <Arrow
            key={el.id}
            {...common}
            points={[el.a.x * mapW, el.a.y * mapH, el.b.x * mapW, el.b.y * mapH]}
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
      case 'rect':
        return (
          <Rect
            key={el.id}
            {...common}
            x={Math.min(el.a.x, el.b.x) * mapW}
            y={Math.min(el.a.y, el.b.y) * mapH}
            width={Math.abs(el.b.x - el.a.x) * mapW}
            height={Math.abs(el.b.y - el.a.y) * mapH}
            stroke={color}
            strokeWidth={sw}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            fill={el.fill ? `${el.color}22` : undefined}
          />
        )
      case 'ellipse':
        return (
          <Ellipse
            key={el.id}
            {...common}
            x={((el.a.x + el.b.x) / 2) * mapW}
            y={((el.a.y + el.b.y) / 2) * mapH}
            radiusX={Math.abs(el.b.x - el.a.x) * mapW / 2}
            radiusY={Math.abs(el.b.y - el.a.y) * mapH / 2}
            stroke={color}
            strokeWidth={sw}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            fill={el.fill ? `${el.color}22` : undefined}
          />
        )
      case 'polygon':
        return (
          <Line
            key={el.id}
            {...common}
            points={el.points.flatMap((p) => [p.x * mapW, p.y * mapH])}
            closed
            stroke={color}
            strokeWidth={sw}
            fill={el.fill ? `${el.color}22` : undefined}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            hitStrokeWidth={14}
          />
        )
      case 'text':
        return (
          <Text
            key={el.id}
            {...common}
            x={el.at.x * mapW}
            y={el.at.y * mapH}
            text={el.text}
            fontSize={Math.max(10, el.fontSize * mapW)}
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
      case 'icon':
        return (
          <Group
            key={el.id}
            {...common}
            x={el.at.x * mapW}
            y={el.at.y * mapH}
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
            <MarkerGlyph icon={el.icon} color={color} size={el.size * mapW} />
          </Group>
        )
      case 'unit': {
        const uColor = selected ? '#fbbf24' : affiliationColor(el.affiliation)
        return (
          <Group key={el.id} {...common} x={el.at.x * mapW} y={el.at.y * mapH} rotation={el.affiliation === 'hostile' ? 45 : 0}>
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
    const sw = Math.max(1, (ui.width * mapW) / 1000)
    if (draft.kind === 'pen') {
      return (
        <Line
          points={draft.points.flatMap((p) => [p.x * mapW, p.y * mapH])}
          stroke={ui.color}
          strokeWidth={sw}
          lineCap="round"
          tension={0.35}
          opacity={0.85}
        />
      )
    }
    if (draft.points.length < 2) return null
    const [a, b] = draft.points
    if (draft.kind === 'line') {
      return (
        <Arrow
          points={[a.x * mapW, a.y * mapH, b.x * mapW, b.y * mapH]}
          stroke={ui.color}
          fill={ui.color}
          strokeWidth={sw}
          pointerLength={ui.tool === 'arrow' ? 12 : 0}
          pointerWidth={ui.tool === 'arrow' ? 10 : 0}
          pointerAtBeginning={ui.tool === 'arrow' && ui.arrowBoth}
          dash={ui.tool === 'dashed' ? [sw * 3, sw * 2] : undefined}
          opacity={0.85}
        />
      )
    }
    if (draft.kind === 'rect') {
      return (
        <Rect
          x={Math.min(a.x, b.x) * mapW}
          y={Math.min(a.y, b.y) * mapH}
          width={Math.abs(b.x - a.x) * mapW}
          height={Math.abs(b.y - a.y) * mapH}
          stroke={ui.color}
          strokeWidth={sw}
          dash={[6, 4]}
          opacity={0.85}
        />
      )
    }
    return (
      <Ellipse
        x={((a.x + b.x) / 2) * mapW}
        y={((a.y + b.y) / 2) * mapH}
        radiusX={Math.abs(b.x - a.x) * mapW / 2}
        radiusY={Math.abs(b.y - a.y) * mapH / 2}
        stroke={ui.color}
        strokeWidth={sw}
        dash={[6, 4]}
        opacity={0.85}
      />
    )
  }

  const pendingNode = () => {
    if (!pending) return null
    const [a, b] = pending.points
    const sw = Math.max(1, (ui.width * mapW) / 1000)
    if (pending.kind === 'line') {
      return (
        <Arrow
          points={[a.x * mapW, a.y * mapH, b.x * mapW, b.y * mapH]}
          stroke={ui.color}
          fill={ui.color}
          strokeWidth={sw}
          pointerLength={ui.tool === 'arrow' ? 12 : 0}
          pointerWidth={ui.tool === 'arrow' ? 10 : 0}
          pointerAtBeginning={ui.tool === 'arrow' && ui.arrowBoth}
          dash={ui.tool === 'dashed' || ui.dash ? [sw * 3, sw * 2] : undefined}
          opacity={0.85}
          listening={false}
        />
      )
    }
    if (pending.kind === 'rect') {
      return (
        <Rect
          x={Math.min(a.x, b.x) * mapW}
          y={Math.min(a.y, b.y) * mapH}
          width={Math.abs(b.x - a.x) * mapW}
          height={Math.abs(b.y - a.y) * mapH}
          stroke={ui.color}
          fill={ui.fillShapes ? `${ui.color}22` : undefined}
          strokeWidth={sw}
          dash={[6, 4]}
          opacity={0.85}
          listening={false}
        />
      )
    }
    return (
      <Ellipse
        x={((a.x + b.x) / 2) * mapW}
        y={((a.y + b.y) / 2) * mapH}
        radiusX={(Math.abs(b.x - a.x) * mapW) / 2}
        radiusY={(Math.abs(b.y - a.y) * mapH) / 2}
        stroke={ui.color}
        fill={ui.fillShapes ? `${ui.color}22` : undefined}
        strokeWidth={sw}
        dash={[6, 4]}
        opacity={0.85}
        listening={false}
      />
    )
  }

  const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))
  const routePoints = (ids: number[]) => {
    const pts: number[] = []
    for (const id of ids) {
      const cp = layer.controlPoints.find((c) => c.id === id)
      if (!cp) continue
      const p = worldToNorm(cp.x, cp.z, layer.world)
      pts.push(p.x * mapW, p.y * mapH)
    }
    return pts
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#080c0a]" style={{ cursor: stageCursor }}>
      <Stage
        ref={stageRef}
        width={box.w}
        height={box.h}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onWheel={onWheel}
        onMouseDown={onStageDown}
        onMouseMove={onStageMove}
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

        <Layer listening={false}>
          {ui.showFlags && ui.showAllRoutes &&
            routes.map((r, i) => (
              <Line
                key={`lane-${r.id}`}
                points={routePoints(r.cps)}
                stroke={routeColor(i)}
                strokeWidth={2 * iconScale}
                opacity={0.22}
                lineJoin="round"
                lineCap="round"
                listening={false}
              />
            ))}
          {ui.showFlags && activeRoute && (
            <Line
              points={routePoints(activeRoute.cps)}
              stroke={laneColor}
              strokeWidth={2.5 * iconScale}
              opacity={0.45}
              lineJoin="round"
              lineCap="round"
              listening={false}
            />
          )}
          {ui.showFlags && activeCps.map((cp) => {
            if (!cp) return null
            const p = worldToNorm(cp.x, cp.z, layer.world)
            const s = 26 * iconScale
            const radius = (cp.radius / layer.world) * mapW
            const key = cp.team ? layer.factions[String(cp.team)]?.key : undefined
            const flagPath = cpFlag(assets, key)
            return (
              <Group key={cp.id} x={p.x * mapW} y={p.y * mapH}>
                {radius > 0 && (
                  <Circle
                    radius={radius}
                    fill={`${laneColor}1a`}
                    stroke={`${laneColor}80`}
                    strokeWidth={1.5 * iconScale}
                    listening={false}
                  />
                )}
                {flagPath ? (
                  <KonvaImage
                    image={assetImage(flagPath)}
                    x={-s / 2}
                    y={-s / 2}
                    width={s}
                    height={s}
                    listening={false}
                    shadowColor="#020604"
                    shadowBlur={3 * iconScale}
                    shadowOpacity={0.85}
                  />
                ) : (
                  <IconGlyph icon="flag" color={laneColor} size={s} x={0} y={0} />
                )}
                {ui.showLabels && (
                  <Text
                    text={cp.name}
                    fontSize={10.5 * iconScale}
                    fontFamily="Inter, Segoe UI, sans-serif"
                    fontStyle="bold"
                    fill="#f8fafc"
                    stroke="rgba(2,6,4,0.92)"
                    strokeWidth={3 * iconScale}
                    fillAfterStrokeEnabled
                    y={s * 0.6}
                    width={180 * iconScale}
                    align="center"
                    x={-90 * iconScale}
                    listening={false}
                  />
                )}
              </Group>
            )
          })}
        </Layer>

        <Layer>
          {layer.vehicles.filter(vehicleVisible).map((v) => {
            const pos = stage.moves[v.id] ?? { x: v.x, z: v.z, rotation: v.rotation }
            const p = worldToNorm(pos.x, pos.z, layer.world)
            const orig = worldToNorm(v.x, v.z, layer.world)
            const moved = Boolean(stage.moves[v.id])
            const color = vehicleColor(v, plan, squadColors)
            const s = (v.category === 'mbt' ? 32 : v.category === 'boat' || v.category === 'carrier' ? 34 : 30) * iconScale
            const nodeId = `veh_${v.id}`
            const selected = ui.selectedId === nodeId
            return (
              <Group key={v.id}>
                {moved && (
                  <>
                    <Line
                      points={[orig.x * mapW, orig.y * mapH, p.x * mapW, p.y * mapH]}
                      stroke="rgba(226,232,240,0.55)"
                      strokeWidth={1.4 * iconScale}
                      dash={[6 * iconScale, 4 * iconScale]}
                      listening={false}
                    />
                    <Circle
                      x={orig.x * mapW}
                      y={orig.y * mapH}
                      radius={7 * iconScale}
                      stroke="rgba(226,232,240,0.6)"
                      strokeWidth={1.5 * iconScale}
                      listening={false}
                    />
                  </>
                )}
                <Group
                  id={nodeId}
                  x={p.x * mapW}
                  y={p.y * mapH}
                  rotation={pos.rotation}
                  draggable={ui.tool === 'select'}
                  listening={ui.tool === 'select' || ui.tool === 'erase'}
                  opacity={v.atStart ? 1 : 0.78}
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
                  onDragEnd={(e) => {
                    const node = e.target
                    const norm = { x: node.x() / mapW, y: node.y() / mapH }
                    const world = { x: norm.x * layer.world - layer.world / 2, z: norm.y * layer.world - layer.world / 2 }
                    planner.moveVehicle(v.id, { x: world.x, z: world.z, rotation: pos.rotation })
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target
                    const rotation = node.rotation()
                    node.rotation(0)
                    node.scaleX(1)
                    node.scaleY(1)
                    planner.moveVehicle(v.id, { x: pos.x, z: pos.z, rotation })
                  }}
                >
                  <Circle radius={s * 0.62} fill="rgba(5,9,7,0.62)" stroke={`${selected ? '#fbbf24' : color}88`} strokeWidth={1.2 * iconScale} />
                  {(() => {
                    const iconPath = assets.vehicles[v.icon] ?? assets.vehicles[v.category] ?? assets.vehicles.other
                    if (!iconPath) {
                      return <IconGlyph icon={glyphFor('vehicle', v.category)} color={selected ? '#fbbf24' : color} size={s} x={0} y={0} />
                    }
                    return (
                      <KonvaImage
                        image={tintedAssetImage(iconPath, selected ? '#fbbf24' : color)}
                        x={-s / 2}
                        y={-s / 2}
                        width={s}
                        height={s}
                        listening={false}
                      />
                    )
                  })()}
                </Group>
                {plan.claims[v.id] && (() => {
                  const sq = plan.roster.squads.find((q) => q.id === plan.claims[v.id])
                  if (!sq) return null
                  return (
                    <Group x={p.x * mapW} y={p.y * mapH} listening={false}>
                      <Circle x={s * 0.34} y={-s * 0.34} radius={7 * iconScale} fill={sq.color} stroke="#0b110d" strokeWidth={2 * iconScale} />
                      <Text
                        text={sq.name}
                        fontSize={8 * iconScale}
                        fontFamily="Inter, Segoe UI, sans-serif"
                        fontStyle="bold"
                        fill="#07110a"
                        x={s * 0.34 - 5 * iconScale}
                        y={-s * 0.34 - 4 * iconScale}
                      />
                    </Group>
                  )
                })()}
                {ui.showLabels && (view.scale >= 0.55 || selected) && (
                  <Text
                    text={v.label}
                    fontSize={9 * iconScale}
                    fontFamily="Inter, Segoe UI, sans-serif"
                    fontStyle="bold"
                    fill={selected ? '#fbbf24' : color}
                    stroke="rgba(2,6,4,0.92)"
                    strokeWidth={3 * iconScale}
                    fillAfterStrokeEnabled
                    y={p.y * mapH + s * 0.56}
                    width={240 * iconScale}
                    align="center"
                    x={p.x * mapW - 120 * iconScale}
                    listening={false}
                  />
                )}
              </Group>
            )
          })}
        </Layer>

        <Layer>
          {stage.elements.map(drawElementNode)}
          {polygon.length > 0 && (
            <Line
              points={polygon.flatMap((p) => [p.x * mapW, p.y * mapH])}
              stroke={ui.color}
              strokeWidth={Math.max(1, (ui.width * mapW) / 1000)}
              dash={[8, 5]}
              closed={false}
              listening={false}
            />
          )}
          {draftNode()}
          {pendingNode()}
        </Layer>
      </Stage>

      {selectedScreen && selectedVehicle && ui.tool === 'select' && (
        <div className="pointer-events-none absolute z-10" style={{ left: selectedScreen.x, top: selectedScreen.y }}>
          <div className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-amber-400/80" />
          <div className="absolute h-4 w-px -translate-x-1/2 -translate-y-[34px] bg-amber-400/70" />
          <button
            title="Drag to rotate asset"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              planner.checkpoint()
              setRotating(true)
            }}
            className="pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-[52px] cursor-grab items-center justify-center rounded-full border border-black/70 bg-amber-400 text-black shadow-lg active:cursor-grabbing"
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-black/70" />
          </button>
        </div>
      )}

      {textAt && (
        <div
          className="absolute z-20"
          style={{
            left: clamp(textAt.x * mapW * view.scale + view.x, 8, box.w - 280),
            top: clamp(textAt.y * mapH * view.scale + view.y - 16, 8, box.h - 80),
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
              placeholder="Label text"
              className="w-52 bg-transparent px-2 py-1 text-sm text-slate-100 outline-none"
            />
            <button type="submit" className="rounded bg-amber-400 px-2 py-1 text-xs font-bold text-black">OK</button>
          </form>
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-[10px] font-semibold tracking-widest text-slate-400">
        <span className="rounded bg-black/70 px-2 py-1 uppercase">
          {map.name} · {layer.displayName}
        </span>
        <span className="rounded bg-black/40 px-2 py-1 uppercase text-slate-500">
          {plan.side === 1 ? layer.factions['1']?.name : layer.factions['2']?.name} side
        </span>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded border border-white/10 bg-black/70 p-1">
        <button className="h-7 w-7 rounded text-slate-300 hover:bg-white/10" onClick={() => zoomBy(0.8)} title="Zoom out">−</button>
        <button className="h-7 min-w-12 rounded px-1 text-[10px] font-mono text-slate-400 hover:bg-white/10" onClick={resetView} title="Fit map">
          {Math.round(view.scale * 100)}%
        </button>
        <button className="h-7 w-7 rounded text-slate-300 hover:bg-white/10" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
      </div>

      {ui.tool === 'polygon' && (
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

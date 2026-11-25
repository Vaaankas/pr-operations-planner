import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Rect, Ellipse, Text, Group, Arrow, Circle } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ControlPoint, DrawElement, LayerData, MapMeta, Plan, Point, Stage as PlanStage, VehicleSpawn } from '../types'
import { usePlanner, useUI } from '../store'
import { affiliationColor, clamp, dataUrl, SQUAD_COLORS } from '../lib/utils'
import { glyphFor, iconImage } from '../icons'
import { vehicleColor } from '../lib/render'
import { cpFlag, useAssets } from '../lib/assets'
import { captureTeam, isCapturable, teamName } from '../lib/flags'
import { displayNormToWorld, displayRotation, mirrorNorm, unmirrorNorm, worldToDisplayNorm } from '../lib/coords'
import { assetImage, GameIcon, preloadAsset, tintedAssetImage } from '../lib/gameIcons'
import { routeColor } from './RoutesPanel'
import { routeSegments } from '../lib/routes'

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

export function MapBoard({ map, layer, plan, stage }: Props) {
  const ui = useUI()
  const assets = useAssets()
  const planner = usePlanner()
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [rotating, setRotating] = useState(false)
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
  const panStart = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null)
  const panMoved = useRef(false)
  const panMiddle = useRef(false)
  const [panning, setPanning] = useState(false)
  const [polygon, setPolygon] = useState<Point[]>([])
  const polygonRef = useRef<Point[]>([])
  const pendingText = useRef<Point | null>(null)
  const [textAt, setTextAt] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')
  const [tick, setTick] = useState(0)
  const [hoverFlag, setHoverFlag] = useState<{ cp: ControlPoint; x: number; y: number } | null>(null)
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
    for (const faction of Object.values(layer.factions)) {
      const path = cpFlag(assets, faction.key)
      if (path) jobs.push(preloadAsset(path))
    }
    const neutralFlag = cpFlag(assets, undefined)
    if (neutralFlag) jobs.push(preloadAsset(neutralFlag))
    for (const v of layer.vehicles) {
      const path = assets.vehicles[v.icon] ?? assets.vehicles[v.category] ?? assets.vehicles.other
      if (!path) continue
      jobs.push(preloadAsset(path))
      jobs.push(preloadAsset(path, vehicleColor(v, plan, squadColors)))
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
      panStart.current = { px: p.x, py: p.y, vx: view.x, vy: view.y }
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
      const middle = panMiddle.current
      panStart.current = null
      panMoved.current = false
      panMiddle.current = false
      setPanning(false)
      if (!moved && !middle) useUI.getState().setSelected(null, null)
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
    planner.moveVehicle(selectedVehicle.id, {
      x: selectedVehiclePos.x,
      z: selectedVehiclePos.z,
      rotation,
    })
  }, [selectedVehicle, selectedVehiclePos, pointerAngle, planner])

  useEffect(() => {
    if (!rotating) return
    const move = (e: PointerEvent) => rotateFromPointer(e.clientX, e.clientY)
    const up = () => {
      rotateStart.current = null
      setRotating(false)
    }
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
            fill={el.fill ? `${el.color}22` : undefined}
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
            fill={el.fill ? `${el.color}22` : undefined}
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
            fill={el.fill ? `${el.color}22` : undefined}
            dash={el.dash ? [sw * 3, sw * 2.4] : undefined}
            hitStrokeWidth={14}
          />
        )
      case 'text': {
        const at = normToScreen(el.at)
        return (
          <Text
            key={el.id}
            {...common}
            x={at.x}
            y={at.y}
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
      }
      case 'squad': {
        const at = normToScreen(el.at)
        const r = 12 * iconScale
        const icon = assets.squads[String(el.squadNumber)]
        return (
          <Group key={el.id} {...common} x={at.x} y={at.y}>
            <Circle radius={r * 0.82} fill="#07110a" stroke={selected ? '#fbbf24' : undefined} strokeWidth={2 * iconScale} />
            {icon ? (
              <KonvaImage image={tintedAssetImage(icon, el.squadColor)} x={-r} y={-r} width={r * 2} height={r * 2} listening={false} />
            ) : (
              <Text
                text={String(el.squadNumber)}
                x={-r}
                y={-r * 0.66}
                width={r * 2}
                align="center"
                fontSize={r * 1.1}
                fontFamily="Inter, Segoe UI, sans-serif"
                fontStyle="bold"
                fill="#f8fafc"
                listening={false}
              />
            )}
            {selected && (
              <>
                <Circle radius={r + 5 * iconScale} stroke="#fbbf24" strokeWidth={3.5 * iconScale} listening={false} />
                <Circle
                  radius={r + 5 * iconScale}
                  stroke="#fbbf24"
                  strokeWidth={7 * iconScale}
                  opacity={0.22}
                  listening={false}
                />
              </>
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
    const sw = Math.max(1, (ui.width * mapW) / 1000)
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
    const sw = Math.max(1, (ui.width * mapW) / 1000)
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
        x={(a.x + b.x) / 2}
        y={(a.y + b.y) / 2}
        radiusX={Math.abs(b.x - a.x) / 2}
        radiusY={Math.abs(b.y - a.y) / 2}
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
      style={{ cursor: stageCursor }}
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
        const index = plan.roster.squads.findIndex((s) => s.id === squadId)
        const squad = plan.roster.squads[index]
        if (!st || !squad) return
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
          squadNumber: index + 1,
          squadColor: squad.color,
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

        <Layer listening={ui.tool === 'select'}>
          {ui.showFlags && visibleRoutes.flatMap((r) => {
            const index = routes.findIndex((x) => x.id === r.id)
            return routeSegments(layer, r).map(([from, to], i) => {
              const a = worldToDisplayNorm(from.x, from.z, layer.world)
              const b = worldToDisplayNorm(to.x, to.z, layer.world)
              return (
                <Line
                  key={`lane-${r.id}-${i}`}
                  points={[a.x * mapW, a.y * mapH, b.x * mapW, b.y * mapH]}
                  stroke={routeColor(index)}
                  strokeWidth={2.5 * iconScale}
                  opacity={0.45}
                  lineJoin="round"
                  lineCap="round"
                  listening={false}
                />
              )
            })
          })}
          {ui.showFlags && activeCps.map((cp) => {
            if (!cp || ui.hiddenCps.includes(cp.id)) return null
            const p = worldToDisplayNorm(cp.x, cp.z, layer.world)
            const radius = (cp.radius / layer.world) * mapW
            const team = captureTeam(plan, cp)
            const key = team ? layer.factions[String(team)]?.key : undefined
            const flagPath = cpFlag(assets, key)
            const img = flagPath ? assetImage(flagPath) : null
            const w = 30 * iconScale
            const ratio = img && img.width && img.height ? img.height / img.width : 1
            const h = w * Math.min(1, Math.max(0.4, ratio))
            const index = visibleRoutes.findIndex((r) => r.cps.includes(cp.id))
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
                    fill={`${color}14`}
                    stroke={`${color}70`}
                    strokeWidth={1.5 * iconScale}
                    listening={false}
                  />
                )}
                {img ? (
                  <KonvaImage
                    image={img}
                    x={-w / 2}
                    y={-h / 2}
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
                    fontSize={10.5 * iconScale}
                    fontFamily="Inter, Segoe UI, sans-serif"
                    fontStyle="bold"
                    fill="#f8fafc"
                    stroke="rgba(2,6,4,0.92)"
                    strokeWidth={3 * iconScale}
                    fillAfterStrokeEnabled
                    y={h / 2 + 3 * iconScale}
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
            const pos = vehiclePosition(v)
            const p = worldToDisplayNorm(pos.x, pos.z, layer.world)
            const move = stage.moves[v.id]
            const color = vehicleColor(v, plan, squadColors)
            const s = (v.category === 'mbt' ? 32 : v.category === 'boat' || v.category === 'carrier' ? 34 : 30) * iconScale
            const nodeId = `veh_${v.id}`
            const selected = ui.selectedId === nodeId
            const claimIndex = plan.roster.squads.findIndex((q) => q.id === plan.claims[v.id])
            const claimPrefix = claimIndex >= 0 ? `[${claimIndex + 1}] ` : ''
            const turns = stage.turns?.[v.id] ?? []
            const base = baseVehiclePos(v)
            const route = move
              ? [base, ...turns, move].map((q) => {
                  const d = worldToDisplayNorm(q.x, q.z, layer.world)
                  return [d.x * mapW, d.y * mapH] as [number, number]
                })
              : []
            return (
              <Group key={v.id}>
                {route.length > 1 && ui.showVehiclePaths && !ui.hiddenVehiclePaths.includes(v.id) && (
                  <Line
                    points={route.flatMap(([x, y]) => [x, y])}
                    stroke={color}
                    strokeWidth={2 * iconScale}
                    opacity={0.82}
                    lineCap="round"
                    lineJoin="round"
                    hitStrokeWidth={20 * iconScale}
                    listening={ui.tool === 'select'}
                    onClick={(e) => {
                      if (ui.tool !== 'select') return
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
                      draggable
                      onDragStart={() => planner.checkpoint()}
                      onDragEnd={(e) => {
                        const node = e.target
                        updateVehicleTurn(v.id, i, displayNormToWorld({ x: node.x() / mapW, y: node.y() / mapH }, layer.world))
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
                  rotation={(displayRotation(pos.rotation) + 90) % 360}
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
                    const world = displayNormToWorld({ x: node.x() / mapW, y: node.y() / mapH }, layer.world)
                    planner.moveVehicle(v.id, { x: world.x, z: world.z, rotation: pos.rotation })
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target
                    const rotation = (270 - node.rotation() + 360) % 360
                    node.rotation(0)
                    node.scaleX(1)
                    node.scaleY(1)
                    planner.moveVehicle(v.id, { x: pos.x, z: pos.z, rotation: (rotation + 360) % 360 })
                  }}
                >
                  <Circle radius={s * 0.5} fill="rgba(0,0,0,0.001)" />
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
                {ui.showLabels && (view.scale >= 0.55 || selected || claimIndex >= 0) && (
                  <Text
                    text={`${claimPrefix}${v.label}`}
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
              points={polygon.flatMap((p) => { const s = normToScreen(p); return [s.x, s.y] })}
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
              if (selectedVehiclePos) {
                rotateStart.current = {
                  angle: pointerAngle(e.clientX, e.clientY),
                  rotation: selectedVehiclePos.rotation,
                }
              }
              setRotating(true)
            }}
            className="pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-[52px] cursor-grab items-center justify-center rounded-full border border-black/70 bg-amber-400 text-black shadow-lg active:cursor-grabbing"
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-black/70" />
          </button>
        </div>
      )}

      {textAt && (() => {
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
              placeholder="Label text"
              className="w-52 bg-transparent px-2 py-1 text-sm text-slate-100 outline-none"
            />
            <button type="submit" className="rounded bg-amber-400 px-2 py-1 text-xs font-bold text-black">OK</button>
          </form>
        </div>
        )
      })()}

      {plan.roster.squads.length > 0 && (
        <div className="absolute bottom-16 right-3 flex flex-col gap-0.5 rounded border border-white/10 bg-black/65 px-2.5 py-2">
          {plan.roster.squads.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/pr-squad', s.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className="flex cursor-grab items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-200 active:cursor-grabbing"
              title="Drag onto the map to place a squad badge"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#07110a]">
                {assets.squads[String(i + 1)] ? (
                  <GameIcon path={assets.squads[String(i + 1)]} tint={s.color} size={24} />
                ) : (
                  <span className="font-mono text-[10px] font-bold text-slate-100">{i + 1}</span>
                )}
              </span>
              <span className="max-w-36 truncate">{s.name || `SQUAD ${i + 1}`}</span>
            </div>
          ))}
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded border border-white/10 bg-black/70 p-1">
        <button className="h-7 w-7 rounded text-slate-300 hover:bg-white/10" onClick={() => zoomBy(0.8)} title="Zoom out">−</button>
        <button className="h-7 min-w-12 rounded px-1 text-[10px] font-mono text-slate-400 hover:bg-white/10" onClick={resetView} title="Fit map">
          {Math.round(view.scale * 100)}%
        </button>
        <button className="h-7 w-7 rounded text-slate-300 hover:bg-white/10" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
      </div>

      {hoverFlag && (() => {
        const team = captureTeam(plan, hoverFlag.cp)
        const capturable = isCapturable(hoverFlag.cp)
        return (
          <div
            className="pointer-events-none absolute z-30 w-52 rounded border border-white/15 bg-[#0b110d]/95 px-2.5 py-2 text-[10px] shadow-2xl"
            style={{ left: clamp(hoverFlag.x + 18, 8, box.w - 220), top: clamp(hoverFlag.y - 8, 8, box.h - 110) }}
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



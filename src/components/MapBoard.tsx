import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Rect, Ellipse, Text, Group, Arrow, Circle } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ControlPoint, DrawElement, LayerData, MapMeta, Plan, Point, Stage as PlanStage, VehicleSpawn } from '../types'
import { usePlanner, useUI } from '../store'
import { affiliationColor, clamp, dataUrl, SQUAD_COLORS } from '../lib/utils'
import { glyphFor, iconImage } from '../icons'
import { vehicleColor, worldToNorm } from '../lib/render'

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

const PENCIL = '#f8fafc'

export function MapBoard({ map, layer, plan, stage }: Props) {
  const ui = useUI()
  const planner = usePlanner()
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [rotating, setRotating] = useState(false)
  const [box, setBox] = useState({ w: 800, h: 600 })
  const [view, setView] = useState({ scale: 0.4, x: 0, y: 0 })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [polygon, setPolygon] = useState<Point[]>([])
  const polygonRef = useRef<Point[]>([])
  const pendingText = useRef<Point | null>(null)
  const [textAt, setTextAt] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')
  const [space, setSpace] = useState(false)
  const [tick, setTick] = useState(0)
  const fitted = useRef<string>('')

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

  // Warm the icon cache: every vehicle category and marker in current plan colours.
  useEffect(() => {
    const colors = [PENCIL, '#38bdf8', '#f87171', '#fbbf24', '#94a3b8', ...SQUAD_COLORS]
    const names = [
      'mbt', 'ifv', 'apc', 'recon', 'jeep', 'logistics', 'aa', 'artillery', 'transport_heli',
      'attack_heli', 'jet', 'bomber', 'boat', 'carrier', 'emplacement', 'asset', 'crate', 'other',
      'flag', 'fob', 'rally', 'lz', 'objective', 'observe', 'attack', 'defend', 'waypoint',
      'mine', 'cache', 'repair', 'supply', 'mortar', 'tow', 'star', 'inf', 'armor', 'air', 'hq', 'mech', 'support',
    ]
    let alive = true
    Promise.all(
      names.flatMap((n) =>
        colors.map((c) => {
          const img = iconImage(n, c)
          return img.complete ? Promise.resolve() : new Promise<void>((res) => {
            img.onload = () => res()
            img.onerror = () => res()
          })
        }),
      ),
    ).then(() => alive && setTick((t) => t + 1))
    return () => {
      alive = false
    }
  }, [])

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
    useUI.getState().setSelected(el.id, 'element')
  }, [planner])

  const base = useCallback(() => ({
    id: `el_${Math.random().toString(36).slice(2, 9)}`,
    color: ui.color,
    width: ui.width,
    opacity: ui.opacity,
    dash: ui.dash,
  }), [ui.color, ui.width, ui.opacity, ui.dash])

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const st = stageRef.current
    if (!st) return
    const pointer = st.getPointerPosition()
    if (!pointer) return
    const old = view.scale
    const dir = e.evt.deltaY > 0 ? 0.9 : 1.1
    const next = clamp(old * dir, Math.max(0.02, fitScale * 0.4), 6)
    const wx = (pointer.x - view.x) / old
    const wy = (pointer.y - view.y) / old
    setView({ scale: next, x: pointer.x - wx * next, y: pointer.y - wy * next })
  }

  const zoomBy = (factor: number) => {
    const old = view.scale
    const next = clamp(old * factor, Math.max(0.02, fitScale * 0.4), 6)
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

  const onStageDown = (e: KonvaEventObject<MouseEvent>) => {
    if (space || ui.tool === 'pan' || e.evt.button === 1) return
    const st = stageRef.current
    if (!st) return
    if (ui.tool === 'select' || ui.tool === 'erase') {
      if (e.target !== st) return
      useUI.getState().setSelected(null, null)
      return
    }
    const pos = mapCoords()
    if (ui.tool === 'text') {
      pendingText.current = toNorm(pos)
      return
    }
    if (ui.tool === 'marker') {
      commit({
        ...base(),
        type: 'icon',
        at: toNorm(pos),
        icon: ui.markerIcon,
        rotation: 0,
        size: 0.02,
      } as DrawElement)
      return
    }
    if (ui.tool === 'unit') {
      commit({
        ...base(),
        type: 'unit',
        at: toNorm(pos),
        unit: ui.unitKind,
        affiliation: ui.unitAffiliation,
        size: 0.024,
      } as DrawElement)
      return
    }
    if (ui.tool === 'polygon') {
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
    if (ui.tool === 'pen') {
      setDraft({ kind: 'pen', points: [toNorm(pos)] })
    } else if (ui.tool === 'line' || ui.tool === 'arrow' || ui.tool === 'dashed') {
      setDraft({ kind: 'line', points: [toNorm(pos)] })
    } else if (ui.tool === 'rect') {
      setDraft({ kind: 'rect', points: [toNorm(pos), toNorm(pos)] })
    } else if (ui.tool === 'ellipse') {
      setDraft({ kind: 'ellipse', points: [toNorm(pos), toNorm(pos)] })
    }
  }

  const onStageMove = () => {
    if (!draft) return
    const n = toNorm(mapCoords())
    if (draft.kind === 'pen') {
      const last = draft.points[draft.points.length - 1]
      if (Math.hypot(n.x - last.x, n.y - last.y) > 0.0018) {
        setDraft({ ...draft, points: [...draft.points, n] })
      }
    } else {
      setDraft({ ...draft, points: [draft.points[0], n] })
    }
  }

  const onStageUp = () => {
    if (pendingText.current && ui.tool === 'text') {
      const pos = pendingText.current
      pendingText.current = null
      setTextAt(pos)
      setTextValue('')
      return
    }
    if (!draft) return
    const pts = draft.points
    if (draft.kind === 'pen') {
      if (pts.length > 2) commit({ ...base(), type: 'pen', points: pts } as DrawElement)
    } else if (draft.kind === 'line') {
      const [a, b] = pts
      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.006) {
        if (ui.tool === 'arrow') {
          commit({ ...base(), type: 'line', a, b, arrow: ui.arrowBoth ? 'both' : 'end', dash: false } as DrawElement)
        } else {
          commit({ ...base(), type: 'line', a, b, arrow: 'none', dash: ui.tool === 'dashed' || ui.dash } as DrawElement)
        }
      }
    } else if (draft.kind === 'rect' || draft.kind === 'ellipse') {
      const [a, b] = pts
      if (Math.abs(a.x - b.x) > 0.008 && Math.abs(a.y - b.y) > 0.008) {
        commit({ ...base(), type: draft.kind, a, b, fill: ui.fillShapes } as DrawElement)
      }
    }
    setDraft(null)
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
    polygonRef.current = []
    setPolygon([])
    pendingText.current = null
    setTextAt(null)
  }, [stage.id])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.code === 'Space' && !typing) {
        setSpace(true)
        e.preventDefault()
      }
      if (typing) return
      if (e.key === 'Escape') {
        setDraft(null)
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
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false)
    }
    const blur = () => setSpace(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
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
  const stageCursor = space || ui.tool === 'pan' ? 'grab' : ui.tool === 'select' ? 'default' : ui.tool === 'erase' ? 'not-allowed' : 'crosshair'

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
            <IconGlyph icon={glyphFor('marker', el.icon)} color={color} size={el.size * mapW} x={0} y={0} />
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

  const flags = ui.showFlags ? layer.controlPoints : []
  const squadColors = plan.roster.squads.map((s) => ({ id: s.id, color: s.color }))

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
        draggable={space || ui.tool === 'pan'}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))
        }}
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
          {flags.map((cp: ControlPoint) => {
            const p = worldToNorm(cp.x, cp.z, layer.world)
            const s = 30 * iconScale
            return (
              <Group key={cp.id} x={p.x * mapW} y={p.y * mapH}>
                <IconGlyph icon="flag" color="#fbbf24" size={s} x={0} y={0} />
                {ui.showLabels && (
                  <Text
                    text={cp.name.toUpperCase()}
                    fontSize={11 * iconScale}
                    fontFamily="Inter, Segoe UI, sans-serif"
                    fontStyle="bold"
                    fill="#fde68a"
                    stroke="rgba(2,6,4,0.9)"
                    strokeWidth={3 * iconScale}
                    fillAfterStrokeEnabled
                    y={s * 0.55}
                    offsetX={0}
                    width={220 * iconScale}
                    align="center"
                    x={-110 * iconScale}
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
            const s = (v.category === 'mbt' ? 26 : v.category === 'boat' || v.category === 'carrier' ? 28 : 22) * iconScale
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
                  <IconGlyph icon={glyphFor('vehicle', v.category)} color={selected ? '#fbbf24' : color} size={s} x={0} y={0} />
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
          {map.name} · {layer.name}
          {layer.layerTypeLabel ? ` · ${layer.layerTypeLabel}` : ''}
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
      {(ui.tool === 'pen' || ui.tool === 'line' || ui.tool === 'arrow' || ui.tool === 'rect' || ui.tool === 'ellipse' || ui.tool === 'text') && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded border border-white/10 bg-black/75 px-3 py-1.5 text-[11px] text-slate-400">
          {ui.tool === 'text' ? 'Click the map to place a label' : 'Drag on the map to draw · Esc cancels'}
        </div>
      )}
    </div>
  )
}

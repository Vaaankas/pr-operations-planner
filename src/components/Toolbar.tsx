import { useEffect } from 'react'
import {
  MousePointer2, Pencil, Minus, MoveUpRight, Square, Circle, Pentagon,
  Type, TextCursorInput, MapPin, Eraser, Ruler, Undo2, Redo2,
} from 'lucide-react'
import { usePlanner, useUI } from '../store'
import type { Tool } from '../types'
import { iconDataUrl } from '../icons'
import { useAssets } from '../lib/assets'
import { GameIcon } from '../lib/gameIcons'
import { SQUAD_COLORS } from '../lib/utils'

const TOOLS: { tool: Tool; icon: typeof MousePointer2; label: string; key: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select / move', key: 'V' },
  { tool: 'pen', icon: Pencil, label: 'Draw', key: 'P' },
  { tool: 'line', icon: Minus, label: 'Line', key: 'L' },
  { tool: 'arrow', icon: MoveUpRight, label: 'Arrow', key: 'A' },
  { tool: 'ruler', icon: Ruler, label: 'Ruler', key: 'D' },
  { tool: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { tool: 'ellipse', icon: Circle, label: 'Ellipse', key: 'O' },
  { tool: 'polygon', icon: Pentagon, label: 'Polygon', key: 'G' },
  { tool: 'text', icon: Type, label: 'Label', key: 'T' },
  { tool: 'textbox', icon: TextCursorInput, label: 'Text box', key: 'B' },
  { tool: 'marker', icon: MapPin, label: 'Marker', key: 'M' },
  { tool: 'erase', icon: Eraser, label: 'Erase', key: 'E' },
]

const COLORS = SQUAD_COLORS

const MARKERS = [
  'objective', 'fob', 'rally', 'lz', 'observe', 'attack', 'defend', 'waypoint',
  'mine', 'cache', 'repair', 'supply', 'mortar', 'tow', 'aa', 'star', 'phase',
]

const ORDERS = ['move', 'attack', 'defend', 'repair', 'build', 'observe']

export function ToolbarRail() {
  const ui = useUI()
  return (
    <div className="flex min-h-0 w-12 shrink-0 flex-1 flex-col items-center gap-0.5 border-r border-white/10 bg-[#080d0a] py-2">
      {TOOLS.map(({ tool, icon: Icon, label, key }) => (
        <button
          key={tool}
          onClick={() => ui.setTool(tool)}
          title={`${label} (${key})`}
          className={`relative flex h-8 w-8 items-center justify-center rounded transition ${ui.tool === tool ? 'bg-amber-400 text-black' : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'}`}
        >
          <Icon className="h-4 w-4" />
          {ui.tool === tool && <span className="absolute -right-0.5 -top-0.5 rounded bg-black px-0.5 font-mono text-[8px] text-amber-300">{key}</span>}
        </button>
      ))}
    </div>
  )
}

export function ToolbarHistory() {
  const planner = usePlanner()
  const canUndo = usePlanner((state) => state.past.length > 0)
  const canRedo = usePlanner((state) => state.future.length > 0)
  return (
    <div className="flex h-[72px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-t border-white/10 bg-[#080d0a]">
      <button
        onClick={() => planner.undo()}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-slate-100 disabled:opacity-30"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => planner.redo()}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-slate-100 disabled:opacity-30"
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export function OptionsBar() {
  const ui = useUI()
  const assets = useAssets()
  const tool = ui.tool
  const isDraw = ['pen', 'line', 'arrow', 'ruler', 'rect', 'ellipse', 'polygon', 'text'].includes(tool)
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0a100c] px-3">
      <span className="w-24 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400/90">
        {TOOLS.find((t) => t.tool === tool)?.label ?? 'Tool'}
      </span>

      {isDraw && (
        <>
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => ui.setColor(c)}
                className={`h-4 w-4 rounded-full border ${ui.color === c ? 'border-white ring-2 ring-white/40' : 'border-black/40'}`}
                style={{ background: c }}
                title={c}
              />
            ))}
            <label className="ml-1 h-4 w-4 cursor-pointer overflow-hidden rounded-full border border-white/30 bg-gradient-to-br from-rose-500 via-amber-400 to-sky-500" title="Custom colour">
              <input type="color" value={ui.color} onChange={(e) => ui.setColor(e.target.value)} className="h-0 w-0 opacity-0" />
            </label>
          </div>
          <div className="h-5 w-px bg-white/10" />
          <label className="flex items-center gap-2 text-[10px] text-slate-400">
            WIDTH
            <input
              type="range"
              min={0.1}
              max={20}
              step={0.1}
              value={ui.width}
              onChange={(e) => ui.setWidth(Number(e.target.value))}
              className="h-1 w-20 accent-amber-400"
            />
            <span className="w-7 font-mono text-slate-300">{ui.width.toFixed(1)}</span>
          </label>
          <label className="flex items-center gap-2 text-[10px] text-slate-400">
            OPACITY
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={ui.opacity}
              onChange={(e) => ui.setOpacity(Number(e.target.value))}
              className="h-1 w-16 accent-amber-400"
            />
            <span className="w-7 font-mono text-slate-300">{Math.round(ui.opacity * 100)}%</span>
          </label>
          {tool !== 'text' && (
            <button
              onClick={() => ui.setDash(!ui.dash)}
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ui.dash ? 'border-amber-400/60 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
            >
              Dashed
            </button>
          )}
          {tool === 'arrow' && (
            <button
              onClick={() => ui.setArrowBoth(!ui.arrowBoth)}
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ui.arrowBoth ? 'border-amber-400/60 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
            >
              Both ends
            </button>
          )}
          {['rect', 'ellipse', 'polygon'].includes(tool) && (
            <>
              <button
                onClick={() => ui.setFillShapes(!ui.fillShapes)}
                className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ui.fillShapes ? 'border-amber-400/60 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
              >
                Fill area
              </button>
              {ui.fillShapes && (
                <label className="flex items-center gap-2 text-[10px] text-slate-400">
                  FILL
                  <input
                    type="range"
                    min={0.02}
                    max={1}
                    step={0.02}
                    value={ui.fillOpacity}
                    onChange={(e) => ui.setFillOpacity(Number(e.target.value))}
                    className="h-1 w-16 accent-amber-400"
                  />
                  <span className="w-7 font-mono text-slate-300">{Math.round(ui.fillOpacity * 100)}%</span>
                </label>
              )}
            </>
          )}
        </>
      )}

      {tool === 'marker' && (
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {MARKERS.map((m) => {
            const path = assets.markers[m]
            return (
              <button
                key={m}
                onClick={() => ui.setMarker(m)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${ui.markerIcon === m ? 'bg-amber-400/20 ring-1 ring-amber-400' : 'hover:bg-white/10'}`}
                title={m}
              >
                {path ? (
                  <GameIcon path={path} size={20} />
                ) : (
                  <img src={iconDataUrl(m, ui.markerIcon === m ? '#fbbf24' : '#cbd5e1')} alt={m} className="h-5 w-5" />
                )}
              </button>
            )
          })}
          <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
          {ORDERS.map((o) => {
            const icon = `order_${o}`
            const path = assets.orders[o]
            return (
              <button
                key={icon}
                onClick={() => ui.setMarker(icon)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${ui.markerIcon === icon ? 'bg-amber-400/20 ring-1 ring-amber-400' : 'hover:bg-white/10'}`}
                title={`commander order: ${o}`}
              >
                {path ? <GameIcon path={path} size={22} /> : <span className="text-[9px] text-amber-300">!</span>}
              </button>
            )
          })}
        </div>
      )}

    </div>
  )
}

export function useToolHotkeys() {
  const ui = useUI()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return
      const hit = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase())
      if (hit) ui.setTool(hit.tool)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui])
}

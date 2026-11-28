import { Fragment, useEffect } from 'react'
import {
  MousePointer2, Pencil, Minus, MoveUpRight, Square, Circle, Pentagon,
  Type, MapPin, Swords, Eraser, Ruler, Undo2, Redo2,
} from 'lucide-react'
import { usePlanner, useUI } from '../store'
import type { Tool } from '../types'
import { useAssets } from '../lib/assets'
import { GameIcon } from '../lib/gameIcons'
import { SQUAD_COLORS } from '../lib/utils'

const TOOLS: { tool: Tool; icon: typeof MousePointer2; label: string; key: string; group?: 'marker' }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select / move', key: 'V' },
  { tool: 'pen', icon: Pencil, label: 'Draw', key: 'P' },
  { tool: 'line', icon: Minus, label: 'Line', key: 'L' },
  { tool: 'arrow', icon: MoveUpRight, label: 'Arrow', key: 'A' },
  { tool: 'ruler', icon: Ruler, label: 'Ruler', key: 'D' },
  { tool: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { tool: 'ellipse', icon: Circle, label: 'Ellipse', key: 'O' },
  { tool: 'polygon', icon: Pentagon, label: 'Polygon', key: 'G' },
  { tool: 'text', icon: Type, label: 'Label', key: 'T' },
  { tool: 'erase', icon: Eraser, label: 'Erase', key: 'E' },
  { tool: 'marker_friendly', icon: MapPin, label: 'Marker', key: 'M', group: 'marker' },
  { tool: 'marker_enemy', icon: Swords, label: 'Enemy marker', key: 'N', group: 'marker' },
]

const COLORS = SQUAD_COLORS

const FRIENDLY_MARKERS = [
  { icon: 'friendly_forwardoutpost', label: 'FORWARD OUTPOST' },
  { icon: 'friendly_buildfob', label: 'BUILD FOB' },
  { icon: 'friendly_minefield', label: 'MINEFIELD' },
  { icon: 'friendly_mortarplacement', label: 'MORTAR EMPL.' },
  { icon: 'friendly_repairdepot', label: 'REPAIR DEPOT' },
  { icon: 'friendly_antiairmissile', label: 'AA' },
  { icon: 'friendly_atgm', label: 'ATGM' },
  { icon: 'friendly_hmg', label: 'HMG' },
  { icon: 'friendly_mortar', label: 'MORTAR' },
  { icon: 'friendly_supply', label: 'SUPPLY' },
]

const ENEMY_MARKER_GROUPS = [
  {
    label: 'INF / FORCES',
    icons: ['spotted_enemyforces', 'spotted_sniper', 'spotted_spotter', 'spotted_saboteur'],
  },
  {
    label: 'OBJECTIVES',
    icons: ['spotted_objective', 'spotted_firebase', 'spotted_bunker', 'spotted_rally'],
  },
  {
    label: 'VEHICLES',
    icons: [
      'spotted_aav', 'spotted_apc', 'spotted_atgmvehicle', 'spotted_heavyaa',
      'spotted_heavyat', 'spotted_ifv', 'spotted_jeep', 'spotted_tank', 'spotted_truck',
    ],
  },
  {
    label: 'MISC',
    icons: [
      'spotted_antiairmissile', 'spotted_atgm', 'spotted_bridge', 'spotted_destroyedbridge',
      'spotted_hmg', 'spotted_mortar', 'spotted_razorwire', 'spotted_supply',
    ],
  },
]

export function ToolbarRail() {
  const ui = useUI()
  return (
    <div className="flex min-h-0 w-12 shrink-0 flex-1 flex-col items-center gap-0.5 border-r border-white/10 bg-[#080d0a] py-2">
      {TOOLS.map(({ tool, icon: Icon, label, key, group }, index) => (
        <Fragment key={tool}>
          {group === 'marker' && TOOLS[index - 1]?.group !== 'marker' && (
            <div className="my-0.5 h-px w-6 shrink-0 bg-white/15" title="Markers" />
          )}
          <button
            onClick={() => ui.setTool(tool)}
            title={`${label} (${key})`}
            className={`relative flex h-8 w-8 items-center justify-center rounded transition ${ui.tool === tool ? 'bg-amber-400 text-black' : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'}`}
          >
            <Icon className="h-4 w-4" />
            {ui.tool === tool && <span className="absolute -right-0.5 -top-0.5 rounded bg-black px-0.5 font-mono text-[8px] text-amber-300">{key}</span>}
          </button>
        </Fragment>
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
                className={`h-4 w-4 rounded-full border ${ui.color === c ? 'border-white ring-2 ring-white/40' : 'border-white/40'}`}
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
          {tool === 'text' && (
            <div className="flex items-center gap-1">
              {([
                { key: 'bold', label: 'B', active: ui.textBold, set: ui.setTextBold, className: 'font-bold' },
                { key: 'italic', label: 'I', active: ui.textItalic, set: ui.setTextItalic, className: 'italic' },
                { key: 'underline', label: 'U', active: ui.textUnderline, set: ui.setTextUnderline, className: 'underline' },
              ] as const).map((style) => (
                <button
                  key={style.key}
                  onClick={() => style.set(!style.active)}
                  title={style.key}
                  className={`h-6 w-6 rounded border text-[11px] ${style.className} ${
                    style.active
                      ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                      : 'border-white/10 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          )}
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

      {tool === 'marker_friendly' && (
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {FRIENDLY_MARKERS.map(({ icon, label }) => {
            const path = assets.markers[icon]
            return (
              <button
                key={icon}
                onClick={() => ui.setMarker(icon)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${ui.markerIcon === icon ? 'bg-amber-400/20 ring-1 ring-amber-400' : 'hover:bg-white/10'}`}
                title={label}
              >
                {path ? <GameIcon path={path} size={22} /> : <span className="text-[9px] text-amber-300">!</span>}
              </button>
            )
          })}
        </div>
      )}

      {tool === 'marker_enemy' && (
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {ENEMY_MARKER_GROUPS.map((group, groupIndex) => (
            <div
              key={group.label}
              className={`flex shrink-0 items-center gap-1 ${groupIndex > 0 ? 'border-l border-white/10 pl-2' : ''}`}
            >
              {group.icons.map((icon) => {
                const path = assets.markers[icon]
                const label = icon.replace('spotted_', '').replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()
                return (
                  <button
                    key={icon}
                    onClick={() => ui.setEnemyMarker(icon)}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${ui.enemyMarkerIcon === icon ? 'bg-amber-400/20 ring-1 ring-amber-400' : 'hover:bg-white/10'}`}
                    title={label}
                  >
                    {path ? <GameIcon path={path} size={22} /> : <span className="text-[9px] text-amber-300">!</span>}
                  </button>
                )
              })}
            </div>
          ))}
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

import { useEffect } from 'react'
import { X, MousePointer2, Pencil, Clock, Download, ShieldCheck } from 'lucide-react'

export function HelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/15 bg-[#0b110d] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
          <ShieldCheck className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200">Field manual</span>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-[12px] leading-relaxed text-slate-300">
          <section>
            <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/90">Workflow</h3>
            <ol className="list-decimal space-y-1 pl-5 text-slate-400">
              <li>Pick a map and layer. Every PvP layer keeps its own vehicle manifest, control points and SGID attack routes.</li>
              <li>Toggle routes and individual flags in the Routes tab. Multiple routes can be visible at once.</li>
              <li>Fill the roster: 50-player reference, commander, up to nine squads. Drag the grip handles to move players or reorder squads.</li>
              <li>Place or move vehicles, claim them for squads, then draw the scheme of manoeuvre. Drag a vehicle route to add turning points.</li>
              <li>Add stages with mission-clock times and notes. A new stage inherits the previous stage's drawings and vehicle positions.</li>
              <li>Export a PowerPoint, PDF, PNG maps, or a roster-only brief. Everything autosaves in this browser.</li>
            </ol>
          </section>

          <section>
            <h3 className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/90"><MousePointer2 className="h-3 w-3" /> Controls</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] text-slate-400">
              <span>Wheel</span><span>Zoom to cursor (20×)</span>
              <span>Drag empty map</span><span>Pan (Select tool)</span>
              <span>Middle mouse drag</span><span>Pan with any tool</span>
              <span>Click / drag</span><span>Draw lines, arrows and areas</span>
              <span>V / P / L / A / D</span><span>Select, draw, line, arrow, ruler</span>
              <span>R / O / G / T</span><span>Rect, ellipse, polygon, label</span>
              <span>M / N / E</span><span>Markers, enemy markers, erase</span>
              <span>Right click</span><span>Cancel the active drawing or vehicle move</span>
              <span>Ctrl+Z / Ctrl+Y</span><span>Undo / redo</span>
              <span>Delete</span><span>Remove selection</span>
              <span>Esc</span><span>Cancel current drawing</span>
              <span>Enter</span><span>Close polygon</span>
              <span>Left / Right</span><span>Previous / next stage</span>
            </div>
          </section>

          <section>
            <h3 className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/90"><Pencil className="h-3 w-3" /> Map symbology</h3>
            <p className="text-slate-400">
              Asset glyphs are the in-game vehicle silhouettes, tinted by team or claiming squad. Flags use the in-game capture-point flag sprites and real capture radii.
              Attack lanes follow the layer's AASv4 SupplyGroupId order; toggle any combination of routes and flags.
              The amber frame on the map sets the export crop; drag its edges or handles, or reset it with the crop button in the Stage panel.
              Delayed spawns are dimmed with their timer. Vehicle trails start at the previous stage's position and use the vehicle's colour.
              Player status cycles blank → green ✓ (confirmed) → amber ? (uncertain).
            </p>
          </section>

          <section>
            <h3 className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/90"><Clock className="h-3 w-3" /> Stages</h3>
            <p className="text-slate-400">
              Stages sort by their mission clock. Use play in the timeline to step through the plan during a briefing.
              Notes become the left column of the exported stage slide and the speaker notes of the PPTX.
            </p>
          </section>

          <section>
            <h3 className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/90"><Download className="h-3 w-3" /> Exports</h3>
            <p className="text-slate-400">
              PowerPoint uses a 16:9 layout with a title slide, roster table, and one slide per stage. PDF mirrors that layout.
              PNG export bundles every stage into a ZIP. Rendered at 2048 or 3072 pixels per map.
            </p>
          </section>

          <section className="rounded border border-white/10 bg-black/25 px-3 py-2">
            <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Credits & data</h3>
            <p className="text-[11px] text-slate-500">
              Map imagery, control points, and vehicle spawn data are extracted from Project Reality: BF2.
              Project Reality is the work of its developers and community; this planner ships only downscaled map renders and derived spawn data.
              Interface and planner artwork are original to this tool; marker, vehicle and flag icons are derived from in-game sprites.
              Built as a static site; no accounts, no server, plans stay in the browser.
            </p>
          </section>
        </div>
        <div className="flex justify-end border-t border-white/10 px-5 py-3">
          <button onClick={onClose} className="rounded bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300">Close</button>
        </div>
      </div>
    </div>
  )
}

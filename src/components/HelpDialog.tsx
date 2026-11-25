import { X, MousePointer2, Pencil, Clock, Download, ShieldCheck } from 'lucide-react'

export function HelpDialog({ onClose }: { onClose: () => void }) {
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
              <li>Pick a map and layer. Every PvP layer keeps its own vehicle manifest and control points.</li>
              <li>Fill the roster: 50 players, commander, up to nine squads of eight. Drag names between squads.</li>
              <li>Place or move vehicles, claim them for squads, then draw the scheme of manoeuvre.</li>
              <li>Add stages with mission-clock times and notes. Each stage carries its own drawings and vehicle moves.</li>
              <li>Export a PowerPoint, PDF, or stage JPEGs. Everything autosaves in this browser.</li>
            </ol>
          </section>

          <section>
            <h3 className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/90"><MousePointer2 className="h-3 w-3" /> Controls</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] text-slate-400">
              <span>Wheel</span><span>Zoom to cursor</span>
              <span>Space + drag</span><span>Pan map</span>
              <span>V / H / P / L / A</span><span>Select, pan, pen, line, arrow</span>
              <span>R / O / G / T / M / U</span><span>Rect, ellipse, zone, text, marker, unit</span>
              <span>Ctrl+Z / Ctrl+Y</span><span>Undo / redo</span>
              <span>Delete</span><span>Remove selection</span>
              <span>Esc</span><span>Cancel current drawing</span>
              <span>Enter</span><span>Close zone polygon</span>
            </div>
          </section>

          <section>
            <h3 className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/90"><Pencil className="h-3 w-3" /> Map symbology</h3>
            <p className="text-slate-400">
              Friendly assets use the planning side's blue (or their claiming squad's colour); enemy assets are red.
              Delayed spawns are dimmed and carry their respawn timer. A moved vehicle leaves a dashed return line to its spawn.
              The map's baked A–M / 1–13 grid is the same one used in-game.
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
              Icons and interface are original to this tool. Built as a static site — no accounts, no server, plans stay in the browser.
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

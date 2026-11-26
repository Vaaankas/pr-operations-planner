import { useState } from 'react'
import { Download, FileImage, FileJson, FileText, Loader2, Presentation, X } from 'lucide-react'
import type { LayerData, MapMeta, Plan } from '../types'
import { useUI } from '../store'
import { buildPdf, buildPngZip, buildPptx, type ExportFormat, type ExportOptions } from '../lib/export'
import { downloadBlob, safeName } from '../lib/utils'
import { useAssets } from '../lib/assets'

interface Props {
  plan: Plan
  map: MapMeta
  layer: LayerData
}

export function ExportDialog({ plan, map, layer }: Props) {
  const ui = useUI()
  const assets = useAssets()
  const [format, setFormat] = useState<ExportFormat>('pptx')
  const [resolution, setResolution] = useState<2048 | 3072>(2048)
  const [stages, setStages] = useState<'all' | 'active'>('all')
  const [includeRoster, setIncludeRoster] = useState(true)
  const [rosterOnly, setRosterOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' })
  const [error, setError] = useState<string | null>(null)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${safeName(plan.operation)}.prplan.json`)
    ui.setExportOpen(false)
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    setProgress({ done: 0, total: plan.stages.length, label: 'Preparing' })
    try {
      const opts: ExportOptions = {
        format,
        resolution,
        stages,
        includeRoster: rosterOnly ? true : includeRoster,
        rosterOnly,
        download: true,
        visibleRoutes: ui.visibleRoutes,
        hiddenCps: ui.hiddenCps,
      }
      const src = { plan, map, layer, assets }
      const onProgress = (done: number, total: number, label: string) => setProgress({ done, total, label })
      const base = safeName(plan.operation)
      if (format === 'pptx') {
        const blob = await buildPptx(src, opts, onProgress)
        downloadBlob(blob, `${base}.pptx`)
      } else if (format === 'pdf') {
        const blob = await buildPdf(src, opts, onProgress)
        downloadBlob(blob, `${base}.pdf`)
      } else {
        const { blob } = await buildPngZip(src, opts, onProgress)
        downloadBlob(blob, `${base}_maps.zip`)
      }
      ui.setExportOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-white/15 bg-[#0b110d] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
          <Download className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200">Export brief</span>
          <button onClick={() => !busy && ui.setExportOpen(false)} className="ml-auto text-slate-500 hover:text-slate-200 disabled:opacity-30" disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Format</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'pptx' as const, icon: Presentation, title: 'PowerPoint', sub: '.pptx · editable text' },
                { id: 'pdf' as const, icon: FileText, title: 'PDF', sub: '.pdf · print ready' },
                { id: 'png' as const, icon: FileImage, title: 'Map images', sub: '.zip · stage PNGs' },
              ].map(({ id, icon: Icon, title, sub }) => (
                <button
                  key={id}
                  onClick={() => setFormat(id)}
                  disabled={rosterOnly && id === 'png'}
                  className={`rounded border px-3 py-3 text-left transition ${format === id ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 hover:border-white/25'} ${rosterOnly && id === 'png' ? 'cursor-not-allowed opacity-30' : ''}`}
                >
                  <Icon className={`h-4 w-4 ${format === id ? 'text-amber-300' : 'text-slate-400'}`} />
                  <div className="mt-2 text-[12px] font-semibold text-slate-100">{title}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-slate-500">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {!rosterOnly && <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Stages</div>
              <div className="flex gap-1">
                {(['all', 'active'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStages(s)}
                    className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${stages === s ? 'border-amber-400/60 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-500'}`}
                  >
                    {s === 'all' ? `All ${plan.stages.length}` : 'Current'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Map resolution</div>
              <div className="flex gap-1">
                {([2048, 3072] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className={`flex-1 rounded border px-2 py-1 font-mono text-[10px] ${resolution === r ? 'border-amber-400/60 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-500'}`}
                  >
                    {r}px
                  </button>
                ))}
              </div>
            </div>
          </div>}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-300">
              <input type="checkbox" checked={includeRoster} disabled={rosterOnly} onChange={(e) => setIncludeRoster(e.target.checked)} className="accent-amber-400" />
              Include roster slide
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-300">
              <input
                type="checkbox"
                checked={rosterOnly}
                onChange={(e) => {
                  setRosterOnly(e.target.checked)
                  if (e.target.checked && format === 'png') setFormat('pdf')
                }}
                className="accent-amber-400"
              />
              Roster only
            </label>
          </div>

          <div className="rounded border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-slate-500">
            <div className="flex justify-between"><span>Operation</span><span className="text-slate-300">{plan.operation}</span></div>
            <div className="mt-1 flex justify-between"><span>Map / layer</span><span className="text-slate-300">{map.name} · {layer.name}</span></div>
            <div className="mt-1 flex justify-between"><span>Squads / players</span><span className="text-slate-300">{plan.roster.squads.length} · {plan.roster.squads.reduce((n, s) => n + s.members.length, 0) + (plan.roster.commander ? 1 : 0)}</span></div>
          </div>

          {busy && (
            <div className="rounded border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-amber-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress.label}
                <span className="ml-auto font-mono">{progress.total ? `${progress.done}/${progress.total}` : ''}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded bg-black/40">
                <div className="h-full bg-amber-400 transition-all" style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '10%' }} />
              </div>
            </div>
          )}

          {error && <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">ERROR: {error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            onClick={exportJson}
            disabled={busy}
            className="mr-auto flex items-center gap-1.5 rounded border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-30"
          >
            <FileJson className="h-3.5 w-3.5" /> Plan JSON
          </button>
          <button onClick={() => ui.setExportOpen(false)} disabled={busy} className="rounded border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 disabled:opacity-30">
            Cancel
          </button>
          <button
            onClick={run}
            disabled={busy}
            className="flex items-center gap-2 rounded bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {busy ? 'Building…' : 'Build export'}
          </button>
        </div>
      </div>
    </div>
  )
}

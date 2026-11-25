import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { formatTime, safeName } from './utils'
import { renderStageCanvas } from './render'

export type ExportFormat = 'pptx' | 'pdf' | 'png'

export interface ExportOptions {
  format: ExportFormat
  resolution: 2048 | 3072
  stages: 'all' | 'active'
  includeRoster: boolean
  download: boolean
}

interface Source {
  plan: Plan
  map: MapMeta
  layer: LayerData
}

const PAGE_W = 13.333
const PAGE_H = 7.5

function orderedStages(plan: Plan): Stage[] {
  return [...plan.stages].sort((a, b) => a.time - b.time)
}

function stageList(src: Source, opts: ExportOptions): Stage[] {
  const all = orderedStages(src.plan)
  return opts.stages === 'active' ? all.filter((s) => s.id === src.plan.activeStageId) : all
}

function textOn(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '0F172A' : 'FFFFFF'
}

function rosterRows(plan: Plan): any[][] {
  const squads = plan.roster.squads
  const header: any[] = [
    { text: 'CMD', options: { fill: { color: '111827' }, color: 'FDE68A', bold: true, fontSize: 10, align: 'center' } },
    ...squads.map((s) => ({
      text: `${s.name} · ${s.type}`,
      options: {
        fill: { color: s.color.replace('#', '') },
        color: textOn(s.color),
        bold: true,
        fontSize: 9,
        align: 'center',
      },
    })),
  ]
  const rows: any[][] = [header]
  const max = Math.max(8, ...squads.map((s) => s.members.length))
  for (let r = 0; r < max; r++) {
    rows.push([
      { text: r === 0 ? (plan.roster.commander?.name ?? '—') : '', options: { fontSize: 9, align: 'center', color: '0F172A' } },
      ...squads.map((s) => ({
        text: s.members[r]?.name ?? '',
        options: { fontSize: 9, align: 'center', color: '0F172A', fill: { color: r % 2 ? 'F1F5F9' : 'FFFFFF' } },
      })),
    ])
  }
  return rows
}

function subtitle(src: Source): string {
  const side = src.layer.factions[String(src.plan.side)]
  return `${src.map.name} · ${src.layer.name} · ${side?.name ?? `Team ${src.plan.side}`}`
}

async function renderAll(
  src: Source,
  opts: ExportOptions,
  onProgress?: (done: number, total: number, label: string) => void,
  format: 'jpeg' | 'png' = 'jpeg',
) {
  const stages = stageList(src, opts)
  const images: { stage: Stage; data: string }[] = []
  for (let i = 0; i < stages.length; i++) {
    onProgress?.(i, stages.length, `Rendering ${stages[i].name}`)
    const canvas = await renderStageCanvas(src.plan, src.layer, stages[i], src.map, {
      size: opts.resolution,
      showFlags: true,
      showVehicles: true,
      showEnemy: true,
      showAssets: false,
      showLabels: true,
      showSpawnMarks: true,
    })
    images.push({ stage: stages[i], data: canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.9 : undefined) })
  }
  onProgress?.(stages.length, stages.length, 'Rendered')
  return images
}

export async function buildPptx(src: Source, opts: ExportOptions, onProgress?: (done: number, total: number, label: string) => void): Promise<Blob> {
  const mod: any = await import('pptxgenjs')
  const PptxGenJS = mod.default ?? mod
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'PR Operations Planner'
  pptx.title = src.plan.operation
  pptx.subject = subtitle(src)

  const dark = '0B110D'
  const amber = 'FBBF24'
  const ink = '0F172A'

  // title
  const title = pptx.addSlide()
  title.background = { color: dark }
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: PAGE_H, fill: { color: amber } })
  title.addText('PROJECT REALITY', { x: 0.7, y: 0.55, w: 6, h: 0.3, fontFace: 'Segoe UI', fontSize: 11, color: '94A3B8', bold: true, charSpacing: 4 })
  title.addText(src.plan.operation, { x: 0.7, y: 1.25, w: 12, h: 1.7, fontFace: 'Segoe UI', fontSize: 38, bold: true, color: 'F8FAFC' })
  title.addText(subtitle(src), { x: 0.7, y: 3.1, w: 12, h: 0.45, fontFace: 'Segoe UI', fontSize: 16, color: 'CBD5E1' })
  title.addShape(pptx.ShapeType.rect, { x: 0.7, y: 3.85, w: 3.2, h: 0.02, fill: { color: amber } })
  title.addText(
    [
      { text: 'OPERATION ORDER', options: { fontSize: 10, color: 'FBBF24', bold: true, breakLine: true } },
      { text: `${src.plan.roster.squads.length} squads · ${src.plan.stages.length} stages · ${src.layer.controlPoints.length} control points`, options: { fontSize: 12, color: '94A3B8' } },
    ],
    { x: 0.7, y: 4.2, w: 8, h: 0.8, fontFace: 'Segoe UI' },
  )
  const stageLine = orderedStages(src.plan).map((s) => `${formatTime(s.time)} ${s.name}`).join('   ·   ')
  title.addText('STAGES', { x: 0.7, y: 5.1, w: 2, h: 0.25, fontFace: 'Segoe UI', fontSize: 9, bold: true, color: 'FBBF24', charSpacing: 2 })
  title.addText(stageLine, { x: 0.7, y: 5.4, w: 11.8, h: 0.7, fontFace: 'Segoe UI', fontSize: 11, color: '94A3B8' })
  title.addText(new Date(src.plan.createdAt).toLocaleDateString(), { x: 0.7, y: 6.6, w: 4, h: 0.3, fontFace: 'Segoe UI', fontSize: 10, color: '64748B' })

  // roster
  if (opts.includeRoster) {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addText('ROSTER', { x: 0.45, y: 0.32, w: 6, h: 0.35, fontFace: 'Segoe UI', fontSize: 22, bold: true, color: ink, charSpacing: 3 })
    slide.addText(subtitle(src), { x: 0.45, y: 0.72, w: 12.4, h: 0.25, fontFace: 'Segoe UI', fontSize: 10, color: '64748B' })
    const colW = 12.4 / (src.plan.roster.squads.length + 1)
    slide.addTable(rosterRows(src.plan), {
      x: 0.45,
      y: 1.12,
      w: 12.4,
      colW: Array(src.plan.roster.squads.length + 1).fill(colW),
      rowH: 0.42,
      border: { type: 'solid', color: 'CBD5E1', pt: 0.5 },
      fontFace: 'Segoe UI',
      valign: 'middle',
      margin: 0.04,
    })
    if (src.plan.roster.unassigned.length) {
      slide.addText(
        `Reserve: ${src.plan.roster.unassigned.map((m) => m.name).join(' · ')}`,
        { x: 0.45, y: 6.7, w: 12.4, h: 0.35, fontFace: 'Segoe UI', fontSize: 9, color: '64748B' },
      )
    }
    slide.addText(`${src.plan.operation}  ·  roster`, { x: 0.45, y: 7.12, w: 8, h: 0.2, fontFace: 'Segoe UI', fontSize: 8, color: '94A3B8' })
  }

  const images = await renderAll(src, opts, onProgress)

  for (const { stage, data } of images) {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: PAGE_W, h: 0.07, fill: { color: amber } })
    slide.addText(`${stage.name}`, { x: 0.45, y: 0.32, w: 4.6, h: 0.55, fontFace: 'Segoe UI', fontSize: 24, bold: true, color: ink })
    slide.addText(`T+${formatTime(stage.time)}`, { x: 0.45, y: 0.9, w: 3, h: 0.3, fontFace: 'Consolas', fontSize: 12, bold: true, color: 'B45309' })
    slide.addText(subtitle(src), { x: 0.45, y: 1.2, w: 4.7, h: 0.45, fontFace: 'Segoe UI', fontSize: 9, color: '64748B' })

    const notes = stage.notes.trim()
    if (notes) {
      slide.addText(notes, {
        x: 0.45, y: 1.78, w: 4.55, h: 4.9, fontFace: 'Segoe UI', fontSize: 11, color: '334155',
        valign: 'top', breakLine: false, lineSpacingMultiple: 1.15, fit: 'shrink',
      })
    } else {
      slide.addText('No stage notes.', { x: 0.45, y: 1.78, w: 4.5, h: 0.4, fontFace: 'Segoe UI', fontSize: 10, italic: true, color: '94A3B8' })
    }

    const mapSize = 6.55
    slide.addImage({ data, x: PAGE_W - mapSize - 0.35, y: 0.38, w: mapSize, h: mapSize })
    slide.addText(`${src.plan.operation}  ·  ${stage.name}  ·  ${formatTime(stage.time)}`, {
      x: 0.45, y: 7.12, w: 8, h: 0.2, fontFace: 'Segoe UI', fontSize: 8, color: '94A3B8',
    })
    if (notes) slide.addNotes(notes)
  }

  return (await pptx.write({ outputType: 'blob' })) as Blob
}

export async function buildPdf(src: Source, opts: ExportOptions, onProgress?: (done: number, total: number, label: string) => void): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [PAGE_W, PAGE_H], compress: true })
  let page = 0
  const newPage = () => {
    if (page > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape')
    page++
  }

  // title
  newPage()
  doc.setFillColor(11, 17, 13)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setFillColor(251, 191, 36)
  doc.rect(0, 0, 0.16, PAGE_H, 'F')
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PROJECT REALITY', 0.7, 0.75)
  doc.setTextColor(248, 250, 252)
  doc.setFontSize(32)
  const titleLines = doc.splitTextToSize(src.plan.operation, 11.5)
  doc.text(titleLines, 0.7, 1.7)
  doc.setTextColor(203, 213, 225)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.text(subtitle(src), 0.7, 3.4)
  doc.setDrawColor(251, 191, 36)
  doc.setLineWidth(0.02)
  doc.line(0.7, 3.75, 3.6, 3.75)
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text(`${src.plan.roster.squads.length} squads · ${src.plan.stages.length} stages · ${src.layer.controlPoints.length} control points`, 0.7, 4.1)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(251, 191, 36)
  doc.setFontSize(8)
  doc.text('STAGES', 0.7, 5.0)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(10)
  doc.text(orderedStages(src.plan).map((s) => `${formatTime(s.time)}  ${s.name}`).join('    ·    '), 0.7, 5.35, { maxWidth: 11.8 })
  doc.text(new Date(src.plan.createdAt).toLocaleDateString(), 0.7, 7.05)

  if (opts.includeRoster) {
    newPage()
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('ROSTER', 0.45, 0.55)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(subtitle(src), 0.45, 0.8)

    const squads = src.plan.roster.squads
    const cols = squads.length + 1
    const x0 = 0.45
    const width = 12.4
    const cellW = width / cols
    const headerH = 0.38
    const y0 = 1.15
    doc.setFillColor(17, 24, 39)
    doc.rect(x0, y0, width, headerH, 'F')
    doc.setTextColor(253, 230, 138)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('CMD', x0 + 0.05, y0 + 0.24)
    squads.forEach((s, i) => {
      const cx = x0 + cellW * (i + 1)
      const hex = s.color.replace('#', '')
      doc.setFillColor(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16))
      doc.rect(cx, y0, cellW, headerH, 'F')
      const t = textOn(s.color)
      doc.setTextColor(parseInt(t.slice(0, 2), 16), parseInt(t.slice(2, 4), 16), parseInt(t.slice(4, 6), 16))
      doc.text(`${s.name} · ${s.type}`, cx + 0.05, y0 + 0.24)
    })
    doc.setFont('helvetica', 'normal')
    const rows = Math.max(8, ...squads.map((s) => s.members.length))
    const rowH = 0.48
    for (let r = 0; r < rows; r++) {
      const y = y0 + headerH + rowH * r
      if (r % 2) {
        doc.setFillColor(241, 245, 249)
        doc.rect(x0, y, width, rowH, 'F')
      }
      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.006)
      doc.rect(x0, y, width, rowH)
      for (let c = 1; c < cols; c++) doc.line(x0 + cellW * c, y, x0 + cellW * c, y + rowH)
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(8)
      if (r === 0 && src.plan.roster.commander) doc.text(src.plan.roster.commander.name, x0 + 0.05, y + 0.29)
      squads.forEach((s, i) => {
        const m = s.members[r]
        if (m) doc.text(m.name, x0 + cellW * (i + 1) + 0.05, y + 0.29)
      })
    }
    if (src.plan.roster.unassigned.length) {
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`Reserve: ${src.plan.roster.unassigned.map((m) => m.name).join(' · ')}`, 0.45, 7.05, { maxWidth: 12.4 })
    }
  }

  const images = await renderAll(src, opts, onProgress)
  for (const { stage, data } of images) {
    newPage()
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(251, 191, 36)
    doc.rect(0, 0, PAGE_W, 0.07, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(stage.name, 0.45, 0.6)
    doc.setFont('courier', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(180, 83, 9)
    doc.text(`T+${formatTime(stage.time)}`, 0.45, 1.0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(subtitle(src), 0.45, 1.25, { maxWidth: 4.7 })

    if (stage.notes.trim()) {
      doc.setFontSize(10)
      doc.setTextColor(51, 65, 85)
      const lines = doc.splitTextToSize(stage.notes.trim(), 4.55)
      doc.text(lines, 0.45, 1.65, { lineHeightFactor: 1.35 })
    }
    const mapSize = 6.55
    doc.addImage(data, 'JPEG', PAGE_W - mapSize - 0.35, 0.38, mapSize, mapSize)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`${src.plan.operation}  ·  ${stage.name}  ·  ${formatTime(stage.time)}`, 0.45, 7.2)
  }

  return doc.output('blob')
}

export async function buildPngZip(src: Source, opts: ExportOptions, onProgress?: (done: number, total: number, label: string) => void): Promise<{ blob: Blob; files: { name: string; data: string }[] }> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const images = await renderAll(src, opts, onProgress, 'png')
  const files: { name: string; data: string }[] = []
  for (const { stage, data } of images) {
    const base64 = data.split(',')[1]
    const name = `${safeName(src.plan.operation)}_${safeName(stage.name)}.png`
    zip.file(name, base64, { base64: true })
    files.push({ name, data })
  }
  zip.file('README.txt', `${src.plan.operation}\n${subtitle(src)}\nGenerated ${new Date().toISOString()}\n`)
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, files }
}

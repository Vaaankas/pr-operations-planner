import type { AssetManifest, LayerData, MapMeta, Plan, Stage } from '../types'
import { formatTime, safeName } from './utils'
import { layerDisplayName } from './layerLabels'
import { buildRosterView, type RosterViewSquad } from './rosterView'
import { captureStageDataUrl } from './konvaExport'
import { stageSlideData } from './slide'
import { hasOrderTokens, ordersPlainText } from './orders'
import { renderOrdersImage } from './ordersImage'

export type ExportFormat = 'pptx' | 'pdf' | 'png'

export interface ExportOptions {
  format: ExportFormat
  resolution: 2048 | 3072
  stages: 'all' | 'active'
  includeRoster: boolean
  rosterOnly: boolean
  signal?: AbortSignal
}

interface Source {
  plan: Plan
  map: MapMeta
  layer: LayerData
  assets: AssetManifest
}

const PAGE_W = 13.333
const PAGE_H = 7.5

function orderedStages(plan: Plan): Stage[] {
  return [...plan.stages].sort((a, b) => a.time - b.time)
}

function stageList(src: Source, opts: ExportOptions): Stage[] {
  if (opts.rosterOnly) return []
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

function subtitle(src: Source): string {
  const side = src.layer.factions[String(src.plan.side)]
  return `${src.map.name} · ${layerDisplayName(src.layer)} · ${side?.name ?? `Team ${src.plan.side}`}`
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
    if (opts.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
    onProgress?.(i, stages.length, `Rendering ${stages[i].name}`)
    const data = await captureStageDataUrl(src, stages[i], opts.resolution, format)
    images.push({ stage: stages[i], data })
  }
  onProgress?.(stages.length, stages.length, 'Rendered')
  return images
}


function hexRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function pptxRosterCard(pptx: any, slide: any, squad: RosterViewSquad, x: number, y: number, w: number, h: number): void {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: 'FFFFFF' },
    line: { color: 'CBD5E1', width: 0.5 },
  })
  const headH = 0.28
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h: headH,
    fill: { color: squad.color.replace('#', '') },
    line: { color: squad.color.replace('#', ''), width: 0.5 },
  })
  slide.addText(String(squad.number), {
    x: x + 0.05, y: y + 0.045, w: 0.22, h: 0.19,
    fontFace: 'Consolas', fontSize: 7.5, bold: true, color: textOn(squad.color), align: 'center', margin: 0,
  })
  slide.addText(squad.name, {
    x: x + 0.29, y: y + 0.03, w: w - 1.08, h: 0.22,
    fontFace: 'Segoe UI', fontSize: 9.5, bold: true, color: textOn(squad.color), margin: 0, fit: 'shrink',
  })
  const squadMeta = `${squad.type}${squad.kits.length ? ` ${squad.kits.join(' ')}` : ''}`
  slide.addText(squadMeta, {
    x: x + w - 1.18, y: y + 0.045, w: 0.62, h: 0.18,
    fontFace: 'Consolas', fontSize: 5.8, bold: true, color: textOn(squad.color), align: 'right', margin: 0, fit: 'shrink',
  })
  slide.addText(`${squad.members.length}${squad.hiddenMembers ? `+${squad.hiddenMembers}` : ''}/8`, {
    x: x + w - 0.52, y: y + 0.045, w: 0.46, h: 0.18,
    fontFace: 'Consolas', fontSize: 6.5, bold: true, color: textOn(squad.color), align: 'right', margin: 0,
  })
  const rowH = 0.165
  squad.members.forEach((member, index) => {
    const rowY = y + headH + 0.03 + index * rowH
    if (member.role) {
      slide.addText(member.role, {
        x: x + 0.04, y: rowY, w: 0.22, h: 0.15,
        fontFace: 'Consolas', fontSize: 6, bold: true, color: '475569', align: 'center', margin: 0,
      })
    }
    slide.addText(member.name, {
      x: x + 0.28, y: rowY, w: w - 0.63, h: 0.15,
      fontFace: 'Segoe UI', fontSize: 8, color: '0F172A', margin: 0, fit: 'shrink',
    })
    if (member.kit) {
      slide.addText(member.kit, {
        x: x + w - 0.34, y: rowY, w: 0.18, h: 0.15,
        fontFace: 'Consolas', fontSize: 5.8, bold: true, color: '64748B', align: 'right', margin: 0,
      })
    }
    if (member.state !== 'unknown') {
      slide.addText(member.state === 'confirmed' ? '✓' : '?', {
        x: x + w - 0.14, y: rowY, w: 0.1, h: 0.15,
        fontFace: 'Segoe UI', fontSize: 6, bold: true,
        color: member.state === 'confirmed' ? '059669' : 'D97706', align: 'right', margin: 0,
      })
    }
  })
  if (squad.members.length === 0) {
    slide.addText('Empty squad', {
      x: x + 0.06, y: y + headH + 0.08, w: w - 0.12, h: 0.18,
      fontFace: 'Segoe UI', fontSize: 7, italic: true, color: '94A3B8', margin: 0,
    })
  }
  const vehicle = squad.vehicles[0]
  if (vehicle) {
    slide.addText(`${vehicle.label}${vehicle.crew.length ? `  ·  ${vehicle.crew.join(', ')}` : ''}`, {
      x: x + 0.05, y: y + h - 0.21, w: w - 0.1, h: 0.16,
      fontFace: 'Segoe UI', fontSize: 6, color: '475569', margin: 0, fit: 'shrink',
    })
  }
  if (squad.hiddenMembers) {
    slide.addText(`+${squad.hiddenMembers} more`, {
      x: x + 0.05, y: y + h - (vehicle ? 0.36 : 0.21), w: w - 0.1, h: 0.14,
      fontFace: 'Segoe UI', fontSize: 5.5, italic: true, color: '94A3B8', margin: 0,
    })
  }
}

function addPptxRoster(pptx: any, src: Source): void {
  const view = buildRosterView(src.plan, src.map, src.layer)
  const slide = pptx.addSlide()
  slide.background = { color: 'FFFFFF' }
  const amber = 'FBBF24'
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: PAGE_W, h: 0.08, fill: { color: amber } })
  slide.addText('ROSTER', { x: 0.45, y: 0.26, w: 5, h: 0.46, fontFace: 'Segoe UI', fontSize: 24, bold: true, color: '0F172A', charSpacing: 2, margin: 0 })
  slide.addText(view.meta, { x: 0.45, y: 0.7, w: 8.2, h: 0.24, fontFace: 'Segoe UI', fontSize: 9.5, color: '64748B', margin: 0 })
  slide.addText(
    [
      { text: `${view.total}/50 players`, options: { bold: true, color: '0F172A' } },
      { text: `   ${view.confirmed} confirmed · ${view.uncertain} uncertain`, options: { color: '475569' } },
    ],
    { x: 9.2, y: 0.34, w: 3.68, h: 0.22, fontFace: 'Consolas', fontSize: 8, align: 'right', margin: 0 },
  )

  const x0 = 0.45
  const top = 1.04
  const gap = 0.08
  const cardW = (9.15 - gap * 2) / 3
  const cardH = (5.85 - gap * 2) / 3
  view.squads.forEach((squad, index) => {
    pptxRosterCard(pptx, slide, squad, x0 + (index % 3) * (cardW + gap), top + Math.floor(index / 3) * (cardH + gap), cardW, cardH)
  })

  const sideX = 9.78
  const sideW = 3.1
  const commanderY = top
  const commanderH = 0.82
  slide.addShape(pptx.ShapeType.rect, { x: sideX, y: commanderY, w: sideW, h: commanderH, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.5 } })
  slide.addShape(pptx.ShapeType.rect, { x: sideX, y: commanderY, w: sideW, h: 0.24, fill: { color: '111827' }, line: { color: '111827', width: 0 } })
  slide.addText('COMMANDER', { x: sideX + 0.06, y: commanderY + 0.055, w: sideW - 0.12, h: 0.14, fontFace: 'Consolas', fontSize: 7.5, bold: true, color: 'FDE68A', margin: 0 })
  slide.addText(view.commander?.name ?? 'Not assigned', { x: sideX + 0.06, y: commanderY + 0.32, w: sideW - 0.12, h: 0.2, fontFace: 'Segoe UI', fontSize: 10, bold: Boolean(view.commander), color: view.commander ? '0F172A' : '94A3B8', margin: 0, fit: 'shrink' })
  slide.addText(view.commander?.kit ? `${view.commander.kit}  ·  CMD` : 'CMD', { x: sideX + 0.06, y: commanderY + 0.55, w: sideW - 0.3, h: 0.16, fontFace: 'Consolas', fontSize: 6.5, color: '64748B', margin: 0 })
  if (view.commander && view.commander.state !== 'unknown') slide.addText(view.commander.state === 'confirmed' ? '✓' : '?', { x: sideX + sideW - 0.22, y: commanderY + 0.33, w: 0.14, h: 0.16, fontFace: 'Segoe UI', fontSize: 7, bold: true, color: view.commander.state === 'confirmed' ? '059669' : 'D97706', align: 'right', margin: 0 })

  const specY = commanderY + commanderH + 0.1
  const specH = 2.35
  slide.addShape(pptx.ShapeType.rect, { x: sideX, y: specY, w: sideW, h: specH, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.5 } })
  slide.addShape(pptx.ShapeType.rect, { x: sideX, y: specY, w: sideW, h: 0.24, fill: { color: '111827' }, line: { color: '111827', width: 0 } })
  slide.addText('SPECIALIST KITS', { x: sideX + 0.06, y: specY + 0.055, w: sideW - 0.12, h: 0.14, fontFace: 'Consolas', fontSize: 7.5, bold: true, color: 'FDE68A', margin: 0 })
  view.kits.forEach((kit, index) => {
    const y = specY + 0.31 + index * 0.235
    slide.addText(kit.name, { x: sideX + 0.06, y, w: sideW - 0.6, h: 0.18, fontFace: 'Segoe UI', fontSize: 7.2, color: '334155', margin: 0, fit: 'shrink' })
    slide.addText(`${kit.count}/${kit.limit}`, { x: sideX + sideW - 0.5, y, w: 0.42, h: 0.18, fontFace: 'Consolas', fontSize: 7, bold: true, color: kit.count > kit.limit ? 'E11D48' : kit.count ? 'B45309' : '94A3B8', align: 'right', margin: 0 })
  })

  const reserveY = specY + specH + 0.1
  const reserveH = 6.89 - reserveY
  slide.addShape(pptx.ShapeType.rect, { x: sideX, y: reserveY, w: sideW, h: reserveH, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.5 } })
  slide.addShape(pptx.ShapeType.rect, { x: sideX, y: reserveY, w: sideW, h: 0.24, fill: { color: '111827' }, line: { color: '111827', width: 0 } })
  slide.addText(`RESERVES  ${view.reserves.length}`, { x: sideX + 0.06, y: reserveY + 0.055, w: sideW - 0.12, h: 0.14, fontFace: 'Consolas', fontSize: 7.5, bold: true, color: 'FDE68A', margin: 0 })
  const reserves = view.reserves.slice(0, 12)
  reserves.forEach((member, index) => {
    slide.addText(member.name, { x: sideX + 0.06, y: reserveY + 0.3 + index * 0.17, w: sideW - 0.12, h: 0.14, fontFace: 'Segoe UI', fontSize: 7.4, color: '334155', margin: 0, fit: 'shrink' })
  })
  if (view.reserves.length === 0) {
    slide.addText('None', { x: sideX + 0.06, y: reserveY + 0.32, w: sideW - 0.12, h: 0.16, fontFace: 'Segoe UI', fontSize: 7.4, italic: true, color: '94A3B8', margin: 0 })
  } else if (view.reserves.length > reserves.length) {
    slide.addText(`+${view.reserves.length - reserves.length} more`, { x: sideX + 0.06, y: reserveY + 0.3 + reserves.length * 0.17, w: sideW - 0.12, h: 0.14, fontFace: 'Segoe UI', fontSize: 6.5, italic: true, color: '94A3B8', margin: 0 })
  }

  slide.addText(`${src.plan.operation}  ·  roster`, { x: 0.45, y: 7.15, w: 8, h: 0.18, fontFace: 'Segoe UI', fontSize: 8, color: '94A3B8', margin: 0 })
  slide.addText(view.extraSquads ? `+${view.extraSquads} squads not shown` : 'PR OPERATIONS PLANNER', { x: 9.2, y: 7.15, w: 3.68, h: 0.18, fontFace: 'Consolas', fontSize: 7, color: '94A3B8', align: 'right', margin: 0 })
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
  if (!opts.rosterOnly) {
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
  }

  // roster
  if (opts.includeRoster || opts.rosterOnly) addPptxRoster(pptx, src)

  const images = await renderAll(src, opts, onProgress)

  for (const { stage, data } of images) {
    const slideData = stageSlideData(src.plan, src.map, src.layer, stage)
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: PAGE_W, h: 0.07, fill: { color: amber } })
    slide.addText(slideData.title, { x: 0.45, y: 0.32, w: 4.6, h: 0.55, fontFace: 'Segoe UI', fontSize: 24, bold: true, color: ink })
    slide.addText(slideData.timeLabel, { x: 0.45, y: 0.9, w: 3, h: 0.3, fontFace: 'Consolas', fontSize: 12, bold: true, color: 'B45309' })
    slide.addText(slideData.meta, { x: 0.45, y: 1.2, w: 4.7, h: 0.45, fontFace: 'Segoe UI', fontSize: 9, color: '64748B' })

    const notes = slideData.notes
    const tokenizedOrders = Boolean(notes && hasOrderTokens(notes))
    if (tokenizedOrders) {
      slide.addImage({
        data: await renderOrdersImage(src.plan, stage, src.assets),
        x: 0.45, y: 1.78, w: 4.55, h: 4.9,
      })
    } else if (notes) {
      slide.addText(notes, {
        x: 0.45, y: 1.78, w: 4.55, h: 4.9, fontFace: 'Segoe UI', fontSize: 11, color: '334155',
        valign: 'top', breakLine: false, lineSpacingMultiple: 1.15, fit: 'shrink',
      })
    } else {
      slide.addText('No stage notes.', { x: 0.45, y: 1.78, w: 4.5, h: 0.4, fontFace: 'Segoe UI', fontSize: 10, italic: true, color: '94A3B8' })
    }

    const mapSize = 7.0
    slide.addImage({ data, x: PAGE_W - mapSize - 0.28, y: 0.25, w: mapSize, h: mapSize })
    slide.addText(slideData.footer, {
      x: 0.45, y: 7.12, w: 4.6, h: 0.2, fontFace: 'Segoe UI', fontSize: 8, color: '94A3B8',
    })
    if (notes) slide.addNotes(ordersPlainText(notes, src.plan))
  }

  return (await pptx.write({ outputType: 'blob' })) as Blob
}


function pdfRosterCard(doc: any, squad: RosterViewSquad, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.006)
  doc.setFillColor(255, 255, 255)
  doc.rect(x, y, w, h, 'FD')
  const [hr, hg, hb] = hexRgb(squad.color)
  doc.setFillColor(hr, hg, hb)
  doc.rect(x, y, w, 0.27, 'F')
  const [tr, tg, tb] = hexRgb(textOn(squad.color))
  doc.setTextColor(tr, tg, tb)
  doc.setFont('courier', 'bold')
  doc.setFontSize(6.5)
  doc.text(String(squad.number), x + 0.06, y + 0.18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.8)
  doc.text(squad.name, x + 0.27, y + 0.18, { maxWidth: w - 1.02 })
  doc.setFont('courier', 'bold')
  doc.setFontSize(5.8)
  doc.text(`${squad.type}${squad.kits.length ? ` ${squad.kits.join(' ')}` : ''} ${squad.members.length}${squad.hiddenMembers ? `+${squad.hiddenMembers}` : ''}/8`, x + w - 0.95, y + 0.18, { maxWidth: 0.9 })
  squad.members.forEach((member, index) => {
    const rowY = y + 0.3 + index * 0.16
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.004)
    doc.line(x + 0.04, rowY + 0.155, x + w - 0.04, rowY + 0.155)
    doc.setTextColor(71, 85, 105)
    doc.setFont('courier', 'bold')
    doc.setFontSize(6)
    if (member.role) doc.text(member.role, x + 0.04, rowY + 0.11)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.4)
    doc.text(member.name, x + 0.27, rowY + 0.11, { maxWidth: w - 0.62 })
    if (member.kit) {
      doc.setTextColor(100, 116, 139)
      doc.setFont('courier', 'bold')
      doc.setFontSize(5.6)
      doc.text(member.kit, x + w - 0.31, rowY + 0.11)
    }
    if (member.state !== 'unknown') {
      const [sr, sg, sb] = member.state === 'confirmed' ? [5, 150, 105] : [217, 119, 6]
      doc.setFillColor(sr, sg, sb)
      doc.circle(x + w - 0.11, rowY + 0.08, 0.023, 'F')
    }
  })
  if (squad.members.length === 0) {
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.6)
    doc.text('Empty squad', x + 0.05, y + 0.43)
  }
  const vehicle = squad.vehicles[0]
  if (vehicle) {
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.7)
    doc.text(`${vehicle.label}${vehicle.crew.length ? `  ·  ${vehicle.crew.join(', ')}` : ''}`, x + 0.05, y + h - 0.1, { maxWidth: w - 0.1 })
  }
  if (squad.hiddenMembers) {
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(5.4)
    doc.text(`+${squad.hiddenMembers} more`, x + 0.05, y + h - (vehicle ? 0.24 : 0.1))
  }
}

function addPdfRoster(doc: any, src: Source): void {
  const view = buildRosterView(src.plan, src.map, src.layer)
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setFillColor(251, 191, 36)
  doc.rect(0, 0, PAGE_W, 0.08, 'F')
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('ROSTER', 0.45, 0.58)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(view.meta, 0.45, 0.8, { maxWidth: 8.2 })
  doc.setFont('courier', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text(`${view.total}/50 players   ${view.confirmed} confirmed · ${view.uncertain} uncertain`, 9.15, 0.58, { maxWidth: 3.72, align: 'right' })

  const x0 = 0.45
  const top = 1.02
  const gap = 0.08
  const cardW = (9.15 - gap * 2) / 3
  const cardH = (5.85 - gap * 2) / 3
  view.squads.forEach((squad, index) => {
    pdfRosterCard(doc, squad, x0 + (index % 3) * (cardW + gap), top + Math.floor(index / 3) * (cardH + gap), cardW, cardH)
  })

  const sideX = 9.78
  const sideW = 3.1
  const commanderY = top
  const commanderH = 0.82
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.006)
  doc.setFillColor(255, 255, 255)
  doc.rect(sideX, commanderY, sideW, commanderH, 'FD')
  doc.setFillColor(17, 24, 39)
  doc.rect(sideX, commanderY, sideW, 0.24, 'F')
  doc.setTextColor(253, 230, 138)
  doc.setFont('courier', 'bold')
  doc.setFontSize(7)
  doc.text('COMMANDER', sideX + 0.06, commanderY + 0.19)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', view.commander ? 'bold' : 'italic')
  doc.setFontSize(9)
  doc.text(view.commander?.name ?? 'Not assigned', sideX + 0.06, commanderY + 0.46, { maxWidth: sideW - 0.12 })
  doc.setTextColor(100, 116, 139)
  doc.setFont('courier', 'normal')
  doc.setFontSize(6)
  doc.text(view.commander?.kit ? `${view.commander.kit}  ·  CMD` : 'CMD', sideX + 0.06, commanderY + 0.65)
  if (view.commander?.state === 'confirmed' || view.commander?.state === 'uncertain') {
    const [cr, cg, cb] = view.commander.state === 'confirmed' ? [5, 150, 105] : [217, 119, 6]
    doc.setFillColor(cr, cg, cb)
    doc.circle(sideX + sideW - 0.12, commanderY + 0.46, 0.025, 'F')
  }

  const specY = commanderY + commanderH + 0.1
  const specH = 2.35
  doc.setDrawColor(203, 213, 225)
  doc.setFillColor(255, 255, 255)
  doc.rect(sideX, specY, sideW, specH, 'FD')
  doc.setFillColor(17, 24, 39)
  doc.rect(sideX, specY, sideW, 0.24, 'F')
  doc.setTextColor(253, 230, 138)
  doc.setFont('courier', 'bold')
  doc.setFontSize(7)
  doc.text('SPECIALIST KITS', sideX + 0.06, specY + 0.19)
  view.kits.forEach((kit, index) => {
    const y = specY + 0.38 + index * 0.235
    doc.setTextColor(51, 65, 85)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.text(kit.name, sideX + 0.06, y, { maxWidth: sideW - 0.6 })
    doc.setFont('courier', 'bold')
    doc.setFontSize(6.5)
    const [cr, cg, cb] = kit.count > kit.limit ? [225, 29, 72] : kit.count ? [180, 83, 9] : [148, 163, 184]
    doc.setTextColor(cr, cg, cb)
    doc.text(`${kit.count}/${kit.limit}`, sideX + sideW - 0.5, y)
  })

  const reserveY = specY + specH + 0.1
  const reserveH = 6.89 - reserveY
  doc.setDrawColor(203, 213, 225)
  doc.setFillColor(255, 255, 255)
  doc.rect(sideX, reserveY, sideW, reserveH, 'FD')
  doc.setFillColor(17, 24, 39)
  doc.rect(sideX, reserveY, sideW, 0.24, 'F')
  doc.setTextColor(253, 230, 138)
  doc.setFont('courier', 'bold')
  doc.setFontSize(7)
  doc.text(`RESERVES  ${view.reserves.length}`, sideX + 0.06, reserveY + 0.19)
  const reserves = view.reserves.slice(0, 12)
  reserves.forEach((member, index) => {
    doc.setTextColor(51, 65, 85)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(member.name, sideX + 0.06, reserveY + 0.45 + index * 0.17, { maxWidth: sideW - 0.12 })
  })
  if (view.reserves.length === 0) {
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.text('None', sideX + 0.06, reserveY + 0.45)
  } else if (view.reserves.length > reserves.length) {
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(6.2)
    doc.text(`+${view.reserves.length - reserves.length} more`, sideX + 0.06, reserveY + 0.45 + reserves.length * 0.17)
  }

  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text(`${src.plan.operation}  ·  roster`, 0.45, 7.22)
  if (view.extraSquads) doc.text(`+${view.extraSquads} squads not shown`, 9.78, 7.22, { maxWidth: 3.1, align: 'right' })
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
  if (!opts.rosterOnly) {
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
  }

  if (opts.includeRoster || opts.rosterOnly) {
    newPage()
    addPdfRoster(doc, src)
  }

  const images = await renderAll(src, opts, onProgress)
  for (const { stage, data } of images) {
    const slideData = stageSlideData(src.plan, src.map, src.layer, stage)
    newPage()
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(251, 191, 36)
    doc.rect(0, 0, PAGE_W, 0.07, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(slideData.title, 0.45, 0.6)
    doc.setFont('courier', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(180, 83, 9)
    doc.text(slideData.timeLabel, 0.45, 1.0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(slideData.meta, 0.45, 1.25, { maxWidth: 4.7 })

    if (slideData.notes) {
      if (hasOrderTokens(slideData.notes)) {
        doc.addImage(await renderOrdersImage(src.plan, stage, src.assets), 'PNG', 0.45, 1.65, 4.55, 4.9)
      } else {
        doc.setFontSize(10)
        doc.setTextColor(51, 65, 85)
        const lines = doc.splitTextToSize(slideData.notes, 4.55)
        doc.text(lines, 0.45, 1.65, { lineHeightFactor: 1.35 })
      }
    }
    const mapSize = 7.0
    doc.addImage(data, 'JPEG', PAGE_W - mapSize - 0.28, 0.25, mapSize, mapSize)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(slideData.footer, 0.45, 7.2)
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

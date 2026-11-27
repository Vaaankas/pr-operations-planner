import { useEffect, useRef, useState } from 'react'
import type { AssetManifest, Plan } from '../types'
import { useAssets } from '../lib/assets'
import { dataUrl } from '../lib/utils'
import { CMD_ORDER_TOKEN, parseOrders, squadOrderToken } from '../lib/orders'
import { preloadAsset, tintedAssetSrc } from '../lib/gameIcons'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function chipMarkup(token: string, icon: string | undefined, label: string): string {
  return `<span data-order-token="${escapeHtml(token)}" contenteditable="false" class="orders-chip" title="${escapeHtml(label)}"><img src="${escapeHtml(icon ?? '')}" alt=""></span>`
}

function orderChip(plan: Plan, assets: AssetManifest, token: string): { icon?: string; label: string } {
  if (token === CMD_ORDER_TOKEN) {
    const icon = assets.commander
    return { icon: icon ? (tintedAssetSrc(icon, '#facc15') ?? dataUrl(icon)) : undefined, label: 'Commander' }
  }
  const id = token.slice('[[squad:'.length, -2)
  const index = plan.roster.squads.findIndex((squad) => squad.id === id)
  const squad = plan.roster.squads[index]
  const path = assets.squads[String(index + 1)]
  return {
    icon: path ? (tintedAssetSrc(path, squad?.color ?? '#f8fafc') ?? dataUrl(path)) : undefined,
    label: squad?.name ?? 'Squad',
  }
}

function ordersHtml(text: string, plan: Plan, assets: AssetManifest): string {
  return parseOrders(text).map((segment) => {
    if (segment.type === 'text') return escapeHtml(segment.text).replace(/\n/g, '<br>')
    const token = segment.type === 'cmd' ? CMD_ORDER_TOKEN : squadOrderToken(segment.squadId)
    const chip = orderChip(plan, assets, token)
    return chipMarkup(token, chip.icon, chip.label)
  }).join('')
}

function serializeOrders(node: Node): string {
  let out = ''
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? ''
      return
    }
    if (!(child instanceof HTMLElement)) return
    if (child.dataset.orderToken) {
      out += child.dataset.orderToken
      return
    }
    if (child.tagName === 'BR') {
      out += '\n'
      return
    }
    out += serializeOrders(child)
  })
  return out
}

interface Props {
  value: string
  stageId: string
  plan: Plan
  onChange: (value: string) => void
  onCommit: (value: string) => void
}

export function OrdersEditor({ value, stageId, plan, onChange, onCommit }: Props) {
  const assets = useAssets()
  const editor = useRef<HTMLDivElement>(null)
  const lastStage = useRef(stageId)
  const [iconVersion, setIconVersion] = useState(0)

  useEffect(() => {
    let alive = true
    const tasks = plan.roster.squads.flatMap((squad, index) => {
      const path = assets.squads[String(index + 1)]
      return path ? [preloadAsset(path, squad.color)] : []
    })
    if (assets.commander) tasks.push(preloadAsset(assets.commander, '#facc15'))
    Promise.all(tasks).then(() => {
      if (alive) setIconVersion((current) => current + 1)
    })
    return () => {
      alive = false
    }
  }, [assets, plan.roster.squads])

  useEffect(() => {
    if (!editor.current) return
    const stageChanged = lastStage.current !== stageId
    lastStage.current = stageId
    if (!stageChanged && document.activeElement === editor.current) return
    editor.current.innerHTML = ordersHtml(value, plan, assets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, iconVersion, value])

  const read = (): string => (editor.current ? serializeOrders(editor.current) : '')
  const commit = () => {
    const next = read()
    onChange(next)
    onCommit(next)
  }

  const insertToken = (token: string) => {
    const root = editor.current
    if (!root) return
    const chip = document.createElement('span')
    const info = orderChip(plan, assets, token)
    chip.dataset.orderToken = token
    chip.contentEditable = 'false'
    chip.className = 'orders-chip'
    chip.title = info.label
    if (info.icon) {
      const image = document.createElement('img')
      image.src = info.icon
      image.alt = ''
      chip.appendChild(image)
    }
    root.focus()
    const selection = window.getSelection()
    let range: Range | null = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!range || !root.contains(range.startContainer)) {
      range = document.createRange()
      range.selectNodeContents(root)
      range.collapse(false)
    }
    range.deleteContents()
    range.insertNode(chip)
    const space = document.createTextNode(' ')
    chip.after(space)
    range.setStartAfter(space)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
    commit()
  }

  return (
    <div
      ref={editor}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder="Orders, tasks, timing, coordination..."
      onInput={() => onChange(read())}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        document.execCommand('insertLineBreak')
      }}
      onPaste={(event) => {
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes('text/pr-squad')) event.preventDefault()
      }}
      onDrop={(event) => {
        const squadId = event.dataTransfer.getData('text/pr-squad')
        if (!squadId) return
        event.preventDefault()
        insertToken(squadId === 'commander' ? CMD_ORDER_TOKEN : squadOrderToken(squadId))
      }}
      className="orders-editor min-h-0 w-full flex-1 overflow-y-auto rounded border border-white/10 bg-black/30 px-2 py-2 text-[12px] leading-relaxed text-slate-200 outline-none focus:border-amber-400/50"
    />
  )
}

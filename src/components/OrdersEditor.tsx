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

function chipElement(plan: Plan, assets: AssetManifest, token: string): HTMLElement {
  const info = orderChip(plan, assets, token)
  const chip = document.createElement('span')
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
  return chip
}

function previousSiblingDeep(node: Node): Node | null {
  let current: Node | null = node
  while (current && current.parentNode) {
    if (current.previousSibling) return current.previousSibling
    current = current.parentNode
  }
  return null
}

function nextSiblingDeep(node: Node): Node | null {
  let current: Node | null = node
  while (current && current.parentNode) {
    if (current.nextSibling) return current.nextSibling
    current = current.parentNode
  }
  return null
}

function deepestLast(node: Node): Node {
  let current = node
  while (current.lastChild) current = current.lastChild
  return current
}

function deepestFirst(node: Node): Node {
  let current = node
  while (current.firstChild) current = current.firstChild
  return current
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

  const currentRange = (): Range | null => {
    const root = editor.current
    if (!root) return null
    root.focus()
    const selection = window.getSelection()
    let range: Range | null = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!range || !root.contains(range.startContainer)) {
      range = document.createRange()
      range.selectNodeContents(root)
      range.collapse(false)
    }
    return range
  }

  const insertNode = (node: Node, after?: Node) => {
    const range = currentRange()
    if (!range) return
    range.deleteContents()
    range.insertNode(node)
    const caret = after ?? node
    range.setStartAfter(caret)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    commit()
  }

  const insertToken = (token: string) => {
    const chip = chipElement(plan, assets, token)
    const space = document.createTextNode(' ')
    const range = currentRange()
    if (!range) return
    range.deleteContents()
    range.insertNode(chip)
    chip.after(space)
    range.setStartAfter(space)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    commit()
  }

  const removeAdjacentChip = (direction: 'back' | 'forward'): boolean => {
    const root = editor.current
    const selection = window.getSelection()
    if (!root || !selection?.rangeCount) return false
    const range = selection.getRangeAt(0)
    if (!range.collapsed) {
      range.deleteContents()
      commit()
      return true
    }
    let candidate: Node | null = null
    if (range.startContainer === root) {
      candidate = direction === 'back'
        ? root.childNodes[range.startOffset - 1] ?? null
        : root.childNodes[range.startOffset] ?? null
    } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
      if (direction === 'back' && range.startOffset > 0) return false
      candidate = direction === 'back'
        ? previousSiblingDeep(range.startContainer)
        : nextSiblingDeep(range.startContainer)
    } else {
      candidate = direction === 'back'
        ? range.startContainer.childNodes[range.startOffset - 1] ?? previousSiblingDeep(range.startContainer)
        : range.startContainer.childNodes[range.startOffset] ?? nextSiblingDeep(range.startContainer)
    }
    if (!candidate) return false
    const chip = candidate instanceof HTMLElement && candidate.dataset.orderToken
      ? candidate
      : direction === 'back'
        ? deepestLast(candidate)
        : deepestFirst(candidate)
    if (!(chip instanceof HTMLElement) || !chip.dataset.orderToken) return false
    chip.remove()
    commit()
    return true
  }

  const copySelection = (event: React.ClipboardEvent<HTMLDivElement>, cut: boolean) => {
    const root = editor.current
    const selection = window.getSelection()
    if (!root || !selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (range.collapsed || !root.contains(range.commonAncestorContainer)) return
    event.preventDefault()
    event.clipboardData.setData('text/plain', serializeOrders(range.cloneContents()))
    if (cut) {
      range.deleteContents()
      commit()
    }
  }

  const pasteOrders = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    if (!text) return
    const fragment = document.createDocumentFragment()
    for (const segment of parseOrders(text)) {
      if (segment.type === 'text') fragment.appendChild(document.createTextNode(segment.text))
      else fragment.appendChild(chipElement(plan, assets, segment.type === 'cmd' ? CMD_ORDER_TOKEN : squadOrderToken(segment.squadId)))
    }
    const last = fragment.lastChild
    insertNode(fragment, last ?? undefined)
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
      onCopy={(event) => copySelection(event, false)}
      onCut={(event) => copySelection(event, true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          document.execCommand('insertLineBreak')
          return
        }
        if (event.key === 'Backspace' && removeAdjacentChip('back')) event.preventDefault()
        if (event.key === 'Delete' && removeAdjacentChip('forward')) event.preventDefault()
      }}
      onPaste={pasteOrders}
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

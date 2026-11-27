import type { Plan } from '../types'

export const CMD_ORDER_TOKEN = '[[cmd]]'

export const squadOrderToken = (squadId: string): string => `[[squad:${squadId}]]`

export type OrderSegment =
  | { type: 'text'; text: string }
  | { type: 'squad'; squadId: string }
  | { type: 'cmd' }

const TOKEN = /\[\[squad:([^\]]+)\]\]|\[\[cmd\]\]/gi

export function parseOrders(text: string): OrderSegment[] {
  const segments: OrderSegment[] = []
  TOKEN.lastIndex = 0
  let cursor = 0
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push({ type: 'text', text: text.slice(cursor, index) })
    if (match[0].toLowerCase() === CMD_ORDER_TOKEN) segments.push({ type: 'cmd' })
    else segments.push({ type: 'squad', squadId: match[1] })
    cursor = index + match[0].length
  }
  if (cursor < text.length) segments.push({ type: 'text', text: text.slice(cursor) })
  TOKEN.lastIndex = 0
  return segments
}

export function hasOrderTokens(text: string): boolean {
  TOKEN.lastIndex = 0
  const found = TOKEN.test(text)
  TOKEN.lastIndex = 0
  return found
}

export function ordersPlainText(text: string, plan: Plan): string {
  return parseOrders(text).map((segment) => {
    if (segment.type === 'cmd') return 'CMD'
    if (segment.type === 'squad') {
      const index = plan.roster.squads.findIndex((squad) => squad.id === segment.squadId)
      return index >= 0 ? plan.roster.squads[index].name : 'SQUAD'
    }
    return segment.text
  }).join('')
}

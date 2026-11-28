import type { LayerData, MapMeta, Plan, Stage } from '../types'
import { formatTime } from './utils'
import { layerDisplayName } from './layerLabels'

export interface StageSlideData {
  title: string
  timeLabel: string
  meta: string
  notes: string
  footer: string
}

export function stageSlideData(plan: Plan, map: MapMeta, layer: LayerData, stage: Stage): StageSlideData {
  const side = layer.factions[String(plan.side)]
  const timed = stage.timeEnabled !== false
  return {
    title: stage.name,
    timeLabel: timed ? `T+${formatTime(stage.time)}` : '--:--',
    meta: `${map.name} · ${layerDisplayName(layer)} · ${side?.name ?? `Team ${plan.side}`}`,
    notes: stage.notes.trim(),
    footer: [plan.operation, stage.name, timed ? formatTime(stage.time) : null].filter(Boolean).join(' · '),
  }
}

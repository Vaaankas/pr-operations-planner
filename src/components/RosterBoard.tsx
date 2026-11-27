import { useEffect, useRef, useState } from 'react'
import { GripVertical, Plus, Star, Trash2, UserPlus, Users, X } from 'lucide-react'
import type { LayerData, Member, Plan, Squad, VehicleSpawn } from '../types'
import { usePlanner } from '../store'
import { useAssets, vehicleIconPath } from '../lib/assets'
import { dataUrl, isHiddenVehicle, playerCount, SQUAD_COLORS, SQUAD_HARD_CAP, SQUAD_SIZE } from '../lib/utils'
import { assignedKits, SPECIALIST_KITS, specialistKit, specialistLimit } from '../lib/kits'
import { GameIcon } from '../lib/gameIcons'

function EditableName({ value, onCommit, className, placeholder }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value)
  const [editing, setEditing] = useState(false)
  const selectText = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setV(value)
    setEditing(false)
  }, [value])
  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={v}
        placeholder={placeholder}
        onFocus={(e) => {
          if (selectText.current) {
            e.currentTarget.select()
            selectText.current = false
          }
        }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v.trim() !== value) onCommit(v.trim())
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setV(value)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className={`${className ?? ''} w-full`}
      />
    )
  }
  return (
    <div className="flex min-w-0 flex-1 items-center">
      <span
        data-name-text
        onDoubleClick={() => {
          selectText.current = true
          setEditing(true)
        }}
        className={`${className ?? ''} max-w-full cursor-text truncate select-text`}
      >
        {value || <span className="text-slate-600">{placeholder}</span>}
      </span>
    </div>
  )
}

function ConfirmationToggle({ member }: { member: Member }) {
  const state = member.unconfirmed ? 'unconfirmed' : member.confirmed ? 'confirmed' : 'unknown'
  return (
    <button
      onClick={() => usePlanner.getState().cycleConfirmation(member.id)}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${
        state === 'unconfirmed'
          ? 'border-amber-400 bg-amber-400 text-black'
          : state === 'confirmed'
            ? 'border-emerald-400 bg-emerald-400 text-black'
            : 'border-white/20 text-transparent hover:border-emerald-400/60'
      }`}
      title={
        state === 'unconfirmed'
          ? 'Uncertain — click to clear'
          : state === 'confirmed'
            ? 'Confirmed — click to mark uncertain'
            : 'Click to confirm'
      }
    >
      {state === 'unconfirmed' ? '?' : state === 'confirmed' ? '✓' : ''}
    </button>
  )
}

function MemberRow({
  member,
  index,
  target,
  role,
  layer,
}: {
  member: Member
  index: number
  target: string
  role?: 'SL' | '2IC'
  layer: LayerData
}) {
  const planner = usePlanner()
  const plan = usePlanner((s) => s.plan)
  const assets = useAssets()
  const [over, setOver] = useState(false)
  const namePointer = useRef(false)
  const memberKitId = assignedKits(plan?.roster.specialistAssignments, member.id)[0]
  const memberKit = specialistKit(memberKitId)
  const memberVehicle = layer.vehicles.find((vehicle) =>
    plan?.claims[vehicle.id] === target
    && (plan?.vehicleCrew?.[vehicle.id] ?? []).includes(member.id),
  )
  useEffect(() => {
    const clear = () => setOver(false)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])
  return (
    <div
      draggable
      onPointerDown={(e) => {
        const target = e.target as HTMLElement
        namePointer.current = target.tagName === 'INPUT' || !!target.closest('[data-name-text]')
      }}
      onDragStart={(e) => {
        const target = e.target as HTMLElement
        if (namePointer.current || target.tagName === 'INPUT' || target.closest('[data-name-text]')) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('text/pr-member', member.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        const kit = e.dataTransfer.getData('text/pr-kit')
        if (kit) {
          planner.assignSpecialist(member.id, kit)
          return
        }
        const assetId = e.dataTransfer.getData('text/pr-asset')
        if (assetId) {
          if (target !== 'commander' && target !== 'unassigned') planner.claimVehicle(assetId, target)
          return
        }
        const id = e.dataTransfer.getData('text/pr-member')
        if (id) planner.moveMember(id, target, index)
      }}
      className={`group flex cursor-grab select-none items-center gap-2 rounded border px-2 py-1.5 active:cursor-grabbing ${
        over ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-black/25'
      }`}
    >
      <span className="cursor-grab active:cursor-grabbing" title="Drag player">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-slate-400" />
      </span>
      {role && (
        <span
          className="shrink-0 rounded border border-white/15 bg-white/5 px-1 font-mono text-[9px] font-bold text-slate-300"
          title={role === 'SL' ? 'Squad leader' : 'Second in command'}
        >
          {role}
        </span>
      )}
      <EditableName
        value={member.name}
        onCommit={(name) => planner.renameMember(member.id, name || 'Unnamed')}
        className="min-w-0 truncate bg-transparent text-[14px] font-medium text-slate-200 outline-none"
      />
      {memberKit && (
        <button
          onContextMenu={(e) => {
            e.preventDefault()
            planner.clearSpecialist(member.id)
          }}
          title={`${memberKit.name} — right-click to clear`}
          className="shrink-0"
        >
          <img src={dataUrl(`icons/kits/${memberKit.id}.webp`)} alt={memberKit.short} className="h-4 w-4 object-contain" />
        </button>
      )}
      {memberVehicle && (() => {
        const icon = vehicleIconPath(assets, memberVehicle)
        return icon ? (
          <img src={dataUrl(icon)} alt={memberVehicle.label} title={memberVehicle.label} className="h-4 w-4 shrink-0 object-contain" />
        ) : null
      })()}
      <ConfirmationToggle member={member} />
      <button onClick={() => planner.removeMember(member.id)} title="Remove player">
        <X className="h-3.5 w-3.5 text-slate-500 hover:text-rose-400" />
      </button>
    </div>
  )
}

function AddPlayer({ target, compact }: { target: string; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  const addNames = (raw: string): number => {
    const names = raw.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
    let added = 0
    for (const value of names) {
      if (usePlanner.getState().addMember(target, value)) added += 1
    }
    return added
  }

  const submit = (closeAfter = true) => {
    if (!name.trim()) {
      setOpen(false)
      return
    }
    if (addNames(name) > 0) {
      setName('')
      if (closeAfter) {
        setOpen(false)
      } else {
        requestAnimationFrame(() => ref.current?.focus())
      }
    } else {
      setOpen(false)
    }
  }
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-amber-300 ${compact ? '' : 'mt-1'}`}
      >
        <UserPlus className="h-3.5 w-3.5" /> Add player
      </button>
    )
  }
  return (
    <div className="flex min-w-0 flex-1 items-start gap-1">
      <div className="min-w-0 flex-1">
      <input
        ref={ref}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit(false)
          }
          if (e.key === 'Escape') {
            setOpen(false)
            setName('')
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text/plain')
          if (!/[\r\n]/.test(text)) return
          e.preventDefault()
          if (addNames(text) > 0) {
            setName('')
            requestAnimationFrame(() => ref.current?.focus())
          }
        }}
        onBlur={() => submit(true)}
        placeholder="Player name"
        className="w-full rounded border border-amber-400/40 bg-black/40 px-1.5 py-1 text-[11px] text-slate-100 outline-none"
      />
        <div className="mt-0.5 text-[8px] uppercase tracking-wider text-slate-600">Paste multiple lines to add several</div>
      </div>
    </div>
  )
}

function SpecialistKitsCard({ plan, layer }: { plan: Plan; layer: LayerData }) {
  const assets = useAssets()
  const [mode, setMode] = useState<'kits' | 'assets'>('kits')
  const players = playerCount(plan)
  const assignments = plan.roster.specialistAssignments ?? {}
  const counts = Object.values(assignments)
    .flatMap((value) => (Array.isArray(value) ? value : [value as unknown as string]))
    .reduce<Record<string, number>>((acc, kit) => {
      acc[kit] = (acc[kit] ?? 0) + 1
      return acc
    }, {})
  return (
    <div className="flex h-full min-h-0 flex-col rounded border border-white/10 bg-[#0b120e]/85">
      <div className="flex items-center gap-1 border-b border-white/5 p-1">
        <button
          onClick={() => setMode('kits')}
          className={`flex-1 rounded px-1 py-1 text-[9px] font-bold uppercase leading-tight ${mode === 'kits' ? 'bg-amber-400 text-black' : 'border border-white/10 text-slate-500 hover:text-slate-200'}`}
        >
          Specialist kits
        </button>
        <button
          onClick={() => setMode('assets')}
          className={`flex-1 rounded px-1 py-1 text-[9px] font-bold uppercase leading-tight ${mode === 'assets' ? 'bg-amber-400 text-black' : 'border border-white/10 text-slate-500 hover:text-slate-200'}`}
        >
          Assets
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5 py-1.5">
        {mode === 'assets' ? (
          layer.vehicles
            .filter((vehicle) => vehicle.team === plan.side && !isHiddenVehicle(vehicle.template) && !plan.claims[vehicle.id])
            .map((vehicle) => (
              <div
                key={vehicle.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/pr-asset', vehicle.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className="flex min-h-8 cursor-grab select-none items-center gap-2 rounded border border-white/10 bg-black/25 px-1.5 active:cursor-grabbing"
                title="Drag onto a squad to assign"
              >
                {(() => {
                  const icon = vehicleIconPath(assets, vehicle)
                  return icon ? <img src={dataUrl(icon)} alt="" draggable={false} className="h-5 w-5 object-contain" /> : null
                })()}
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{vehicle.label}</span>
              </div>
            ))
        ) : SPECIALIST_KITS.map((kit) => {
          const limit = specialistLimit(kit, players)
          const count = counts[kit.id] ?? 0
          return (
            <div
              key={kit.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/pr-kit', kit.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className="flex min-h-0 flex-1 cursor-grab select-none items-center gap-2 rounded border border-white/10 bg-black/25 px-1.5 active:cursor-grabbing"
            >
              <img
                src={dataUrl(`icons/kits/${kit.id}.webp`)}
                alt={kit.short}
                draggable={false}
                className="h-5 w-5 shrink-0 object-contain"
                title={`${kit.name} — drag onto a player or squad`}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] text-slate-300" title={`${kit.name} · PR limit ${limit}`}>{kit.name}</span>
              <span className={`shrink-0 font-mono text-[12px] ${count > limit ? 'text-rose-300' : count ? 'text-amber-300' : 'text-slate-600'}`}>
                {count}/{limit}
              </span>
            </div>
          )
        })}
      </div>
      <div className="border-t border-white/5 px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
        {mode === 'assets' ? 'Drag assets onto squads' : 'Drag kits onto players or squads'}
      </div>
    </div>
  )
}

function VehicleCrewBox({ vehicle, squad, plan }: { vehicle: VehicleSpawn; squad: Squad; plan: Plan }) {
  const planner = usePlanner()
  const assets = useAssets()
  const [over, setOver] = useState(false)
  const crew = (plan.vehicleCrew?.[vehicle.id] ?? []).filter((id) => squad.members.some((member) => member.id === id))
  const icon = vehicleIconPath(assets, vehicle)
  const crewMembers = crew.map((id) => squad.members.find((member) => member.id === id)).filter(Boolean)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        const memberId = e.dataTransfer.getData('text/pr-member')
        if (!memberId || crew.includes(memberId)) return
        planner.setVehicleCrew(vehicle.id, [...crew, memberId])
      }}
      className={`rounded border px-1.5 py-1 ${over ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/15 bg-black/30'}`}
    >
      <div className="flex items-center gap-1.5">
        {icon && <img src={dataUrl(icon)} alt="" className="h-4 w-4 object-contain" />}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-200">{vehicle.label}</span>
        <button
          onClick={() => {
            planner.claimVehicle(vehicle.id, null)
            planner.setVehicleCrew(vehicle.id, [])
          }}
          className="shrink-0 text-slate-600 hover:text-rose-400"
          title="Remove vehicle from squad"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1">
        {crewMembers.length > 0 ? (
          crewMembers.map((member) => (
            <button
              key={member!.id}
              onContextMenu={(e) => {
                e.preventDefault()
                planner.setVehicleCrew(vehicle.id, crew.filter((id) => id !== member!.id))
              }}
              className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px] text-slate-300"
              title="Right-click to remove from vehicle"
            >
              {member!.name}
            </button>
          ))
        ) : (
          <span className="font-mono text-[9px] text-slate-600">Drag players here</span>
        )}
      </div>
    </div>
  )
}

function SquadCard({ squad, index, layer }: { squad: Squad; index: number; layer: LayerData }) {
  const planner = usePlanner()
  const assets = useAssets()
  const plan = usePlanner((s) => s.plan)!
  const [drop, setDrop] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [headerDrop, setHeaderDrop] = useState(false)
  const namePointer = useRef(false)
  const full = squad.members.length >= SQUAD_HARD_CAP
  const overNominal = squad.members.length > SQUAD_SIZE
  const assignedKitIds = assignedKits(plan?.roster.specialistAssignments, squad.id)
  const claimedVehicles = layer.vehicles.filter((vehicle) => plan?.claims[vehicle.id] === squad.id)
  useEffect(() => {
    const clear = () => {
      setDrop(false)
      setHeaderDrop(false)
    }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrop(true)
      }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrop(false)
        const kit = e.dataTransfer.getData('text/pr-kit')
        if (kit) {
          planner.assignSpecialist(squad.id, kit)
          return
        }
        const assetId = e.dataTransfer.getData('text/pr-asset')
        if (assetId) {
          planner.claimVehicle(assetId, squad.id)
          return
        }
        const memberId = e.dataTransfer.getData('text/pr-member')
        const squadId = e.dataTransfer.getData('text/pr-squad')
        if (memberId) planner.moveMember(memberId, squad.id)
        else if (squadId) planner.reorderSquads(squadId, squad.id)
      }}
      className={`flex h-full min-h-0 flex-col rounded border bg-[#0b120e]/85 ${drop ? 'border-amber-400/70 bg-amber-400/5' : 'border-white/10'}`}
    >
      <div
        draggable
        onPointerDown={(e) => {
          const target = e.target as HTMLElement
          namePointer.current = target.tagName === 'INPUT'
            || !!target.closest('[data-name-text]')
            || !!target.closest('[data-squad-icon]')
        }}
        onDragStart={(e) => {
          const target = e.target as HTMLElement
          if (namePointer.current || target.tagName === 'INPUT' || target.closest('[data-name-text]') || target.closest('[data-squad-icon]')) {
            e.preventDefault()
            return
          }
          e.dataTransfer.setData('text/pr-squad', squad.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setHeaderDrop(true)
        }}
        onDragLeave={() => setHeaderDrop(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const kit = e.dataTransfer.getData('text/pr-kit')
          if (kit) {
            planner.assignSpecialist(squad.id, kit)
            setHeaderDrop(false)
            return
          }
          const assetId = e.dataTransfer.getData('text/pr-asset')
          if (assetId) {
            planner.claimVehicle(assetId, squad.id)
            setHeaderDrop(false)
            return
          }
          const squadId = e.dataTransfer.getData('text/pr-squad')
          if (squadId) planner.reorderSquads(squadId, squad.id)
          setHeaderDrop(false)
        }}
        className={`flex cursor-grab select-none items-center gap-1.5 border-b px-2 py-1.5 active:cursor-grabbing ${
          headerDrop ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/5'
        }`}
        style={{ boxShadow: `inset 3px 0 0 ${squad.color}` }}
      >
        <span className="cursor-grab active:cursor-grabbing" title="Drag squad">
          <GripVertical className="h-3.5 w-3.5 text-slate-600" />
        </span>
        <button
          data-squad-icon
          onClick={() => setColorOpen(!colorOpen)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#07110a]"
          title="Squad colour"
        >
          {assets.squads[String(index + 1)] ? (
            <GameIcon path={assets.squads[String(index + 1)]} tint={squad.color} size={24} />
          ) : (
            <span className="font-mono text-[20px] font-bold text-slate-100">{index + 1}</span>
          )}
        </button>
        <EditableName
          value={squad.name.toUpperCase()}
          onCommit={(name) => planner.updateSquad(squad.id, { name: name.toUpperCase() })}
          placeholder="Squad name"
          className="min-w-0 border-0 bg-transparent text-[14px] font-semibold text-slate-100 outline-none placeholder:text-slate-600"
        />
        {assignedKitIds.map((kitId, kitIndex) => {
          const kit = specialistKit(kitId)
          if (!kit) return null
          return (
            <button
              key={`${kitId}-${kitIndex}`}
              onContextMenu={(e) => {
                e.preventDefault()
                planner.clearSpecialist(squad.id, kitId)
              }}
              title={`${kit.name} — right-click to clear`}
              className="shrink-0"
            >
              <img src={dataUrl(`icons/kits/${kitId}.webp`)} alt={kit.short} className="h-4 w-4 object-contain" />
            </button>
          )
        })}
        <span className={`font-mono text-[12px] ${overNominal ? 'text-amber-300' : 'text-slate-400'}`}>{squad.members.length}/{SQUAD_SIZE}</span>
        <button onClick={() => planner.removeSquad(squad.id)} className="text-slate-600 hover:text-rose-400" title="Delete squad">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {colorOpen && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-2 py-1.5">
          {SQUAD_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                planner.updateSquad(squad.id, { color: c })
                setColorOpen(false)
              }}
              className="h-4 w-4 rounded-full border border-white/30"
              style={{ background: c }}
            />
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
        {squad.members.map((m, i) => (
          <MemberRow key={m.id} member={m} index={i} target={squad.id} role={i === 0 ? 'SL' : i === 1 ? '2IC' : undefined} layer={layer} />
        ))}
        {!full && <AddPlayer target={squad.id} compact />}
        {claimedVehicles.length > 0 && (
          <div className="space-y-1 border-t border-white/5 pt-1">
            {claimedVehicles.map((vehicle) => (
              <VehicleCrewBox key={vehicle.id} vehicle={vehicle} squad={squad} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function RosterBoard({ layer }: { layer: LayerData }) {
  const plan = usePlanner((s) => s.plan)!
  const planner = usePlanner()
  const assets = useAssets()
  const [dropReserve, setDropReserve] = useState(false)
  const [dropCommander, setDropCommander] = useState(false)
  const count = playerCount(plan)
  const allMembers = [
    ...(plan.roster.commander ? [plan.roster.commander] : []),
    ...plan.roster.squads.flatMap((s) => s.members),
    ...plan.roster.unassigned,
  ]
  const confirmed = allMembers.filter((m) => m.confirmed).length
  const uncertain = allMembers.filter((member) => member.unconfirmed).length

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
          <Users className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200">Roster</span>
          <span className={`font-mono text-[11px] ${count > 50 ? 'text-amber-300' : 'text-slate-400'}`}>{count}/50 players</span>
          <span className="font-mono text-[11px] text-emerald-400/90">{confirmed}/50 confirmed</span>
          <span className="font-mono text-[11px] text-amber-400/90">{uncertain} uncertain</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">Drag players or squad headers to reorder</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid h-full auto-rows-[minmax(220px,1fr)] grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {plan.roster.squads.slice(0, 9).map((squad, i) => (
              <SquadCard key={squad.id} squad={squad} index={i} layer={layer} />
            ))}
            {plan.roster.squads.length < 9 && (
              <button
                onClick={() => planner.addSquad()}
                className="flex h-full min-h-0 flex-col items-center justify-center gap-2 rounded border border-dashed border-white/15 text-slate-500 hover:border-amber-400/50 hover:text-amber-300"
              >
                <Plus className="h-5 w-5" />
                <span className="font-mono text-[11px] uppercase tracking-wider">Add squad</span>
              </button>
            )}
            <div className="h-full min-h-0 2xl:col-start-5 2xl:row-start-2">
              <SpecialistKitsCard plan={plan} layer={layer} />
            </div>
          </div>
        </div>
      </section>

      <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/10 bg-[#080d0a]">
        <div className="border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2">
            {assets.commander ? (
              <span className="flex h-6 w-6 items-center justify-center">
                <GameIcon path={assets.commander} size={24} />
              </span>
            ) : (
              <Star className="h-4 w-4 text-amber-300" />
            )}
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-200">Commander</span>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDropCommander(true)
            }}
            onDragLeave={() => setDropCommander(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDropCommander(false)
              const id = e.dataTransfer.getData('text/pr-member')
              if (id) planner.moveMember(id, 'commander')
            }}
            className={`mt-1.5 rounded border px-2 py-2 ${dropCommander ? 'border-amber-400/70 bg-amber-400/5' : 'border-white/10 bg-black/20'}`}
          >
            {plan.roster.commander ? (
              <MemberRow member={plan.roster.commander} index={0} target="commander" layer={layer} />
            ) : (
              <AddPlayer target="commander" />
            )}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDropReserve(true)
          }}
          onDragLeave={() => setDropReserve(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDropReserve(false)
            const id = e.dataTransfer.getData('text/pr-member')
            if (id) planner.moveMember(id, 'unassigned')
          }}
          className={`flex min-h-0 flex-1 flex-col ${dropReserve ? 'bg-amber-400/5' : ''}`}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">Reserves</span>
            <span className="ml-auto font-mono text-[10px] text-slate-500">{plan.roster.unassigned.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
            {plan.roster.unassigned.map((m, i) => (
              <MemberRow key={m.id} member={m} index={i} target="unassigned" layer={layer} />
            ))}
            {plan.roster.unassigned.length === 0 && (
              <div className="rounded border border-dashed border-white/10 px-2 py-6 text-center text-[10px] uppercase tracking-wider text-slate-600">
                Drop players here
              </div>
            )}
            <AddPlayer target="unassigned" />
          </div>
        </div>


      </aside>
    </div>
  )
}

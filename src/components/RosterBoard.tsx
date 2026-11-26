import { useEffect, useRef, useState } from 'react'
import { GripVertical, Plus, Star, Trash2, UserPlus, Users, X } from 'lucide-react'
import type { Member, Plan, Squad } from '../types'
import { usePlanner } from '../store'
import { dataUrl, playerCount, SQUAD_COLORS } from '../lib/utils'
import { SPECIALIST_KITS, specialistKit, specialistLimit } from '../lib/kits'

function EditableName({ value, onCommit, className, placeholder }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    setV(value)
    setEditing(false)
  }, [value])
  if (editing) {
    return (
      <input
        autoFocus
        value={v}
        placeholder={placeholder}
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
        onClick={() => setEditing(true)}
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
          ? 'Unconfirmed — click to clear'
          : state === 'confirmed'
            ? 'Confirmed — click to mark unconfirmed'
            : 'Click to confirm'
      }
    >
      {state === 'unconfirmed' ? '?' : state === 'confirmed' ? '✓' : ''}
    </button>
  )
}

function MemberRow({
  member,
  accent,
  index,
  target,
}: {
  member: Member
  accent?: string
  index: number
  target: string
}) {
  const planner = usePlanner()
  const plan = usePlanner((s) => s.plan)
  const [over, setOver] = useState(false)
  const namePointer = useRef(false)
  const assignedKit = specialistKit(plan?.roster.specialistAssignments?.[member.id])
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
      {accent && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />}
      <EditableName
        value={member.name}
        onCommit={(name) => planner.renameMember(member.id, name || 'Unnamed')}
        className="min-w-0 truncate bg-transparent text-[14px] font-medium text-slate-200 outline-none"
      />
      {assignedKit && (
        <button
          onContextMenu={(e) => {
            e.preventDefault()
            planner.clearSpecialist(member.id)
          }}
          title={`${assignedKit.name} — right-click to clear`}
          className="shrink-0"
        >
          <img src={dataUrl(`icons/kits/${assignedKit.id}.webp`)} alt={assignedKit.short} className="h-4 w-4 object-contain" />
        </button>
      )}
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
  const submit = () => {
    if (!name.trim()) {
      setOpen(false)
      return
    }
    if (usePlanner.getState().addMember(target, name)) {
      setName('')
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
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setOpen(false)
            setName('')
          }
        }}
        onBlur={submit}
        placeholder="Player name"
        className="w-full rounded border border-amber-400/40 bg-black/40 px-1.5 py-1 text-[11px] text-slate-100 outline-none"
      />
    </div>
  )
}

function SpecialistKitsCard({ plan }: { plan: Plan }) {
  const players = playerCount(plan)
  const assignments = plan.roster.specialistAssignments ?? {}
  const counts = Object.values(assignments).reduce<Record<string, number>>((acc, kit) => {
    acc[kit] = (acc[kit] ?? 0) + 1
    return acc
  }, {})
  return (
    <div className="flex h-full min-h-0 flex-col rounded border border-white/10 bg-[#0b120e]/85">
      <div className="flex items-center gap-2 border-b border-white/5 px-2 py-1.5">
        <span className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-300">Specialist kits</span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{players} players</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-1.5 py-1.5">
        {SPECIALIST_KITS.map((kit) => {
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
      <div className="border-t border-white/5 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-slate-600">
        Drag a kit onto a player or squad
      </div>
    </div>
  )
}

function SquadCard({ squad, index }: { squad: Squad; index: number }) {
  const planner = usePlanner()
  const plan = usePlanner((s) => s.plan)
  const [drop, setDrop] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [headerDrop, setHeaderDrop] = useState(false)
  const namePointer = useRef(false)
  const full = squad.members.length >= 9
  const assignedKit = specialistKit(plan?.roster.specialistAssignments?.[squad.id])
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
          namePointer.current = target.tagName === 'INPUT' || !!target.closest('[data-name-text]')
        }}
        onDragStart={(e) => {
          const target = e.target as HTMLElement
          if (namePointer.current || target.tagName === 'INPUT' || target.closest('[data-name-text]')) {
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
        <span className="w-6 shrink-0 border-0 text-left font-mono text-[20px] font-bold leading-none text-slate-100 outline-none">
          {index + 1}
        </span>
        <EditableName
          value={squad.name}
          onCommit={(name) => planner.updateSquad(squad.id, { name })}
          placeholder="Squad name"
          className="min-w-0 border-0 bg-transparent text-[14px] font-semibold text-slate-100 outline-none placeholder:text-slate-600"
        />
        {assignedKit && (
          <button
            onContextMenu={(e) => {
              e.preventDefault()
              planner.clearSpecialist(squad.id)
            }}
            title={`${assignedKit.name} — right-click to clear`}
            className="shrink-0"
          >
            <img src={dataUrl(`icons/kits/${assignedKit.id}.webp`)} alt={assignedKit.short} className="h-4 w-4 object-contain" />
          </button>
        )}
        <button onClick={() => setColorOpen(!colorOpen)} className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ background: squad.color }} title="Squad colour" />
        <span className={`font-mono text-[12px] ${full ? 'text-amber-300' : 'text-slate-400'}`}>{squad.members.length}/9</span>
        <button onClick={() => planner.removeSquad(squad.id)} className="text-slate-600 hover:text-rose-400" title="Delete squad">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {colorOpen && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-2 py-1.5">
          {SQUAD_COLORS.concat(['#ef4444']).map((c) => (
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
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-1.5">
        {squad.members.map((m, i) => (
          <MemberRow key={m.id} member={m} accent={squad.color} index={i} target={squad.id} />
        ))}
        {squad.members.length === 0 && <div className="px-1 py-2 text-[11px] uppercase tracking-wider text-slate-600">Empty squad</div>}
        <div className="mt-auto">
          {!full && <AddPlayer target={squad.id} />}
        </div>
      </div>
    </div>
  )
}

export function RosterBoard() {
  const plan = usePlanner((s) => s.plan)!
  const planner = usePlanner()
  const [dropReserve, setDropReserve] = useState(false)
  const [dropCommander, setDropCommander] = useState(false)
  const count = playerCount(plan)
  const allMembers = [
    ...(plan.roster.commander ? [plan.roster.commander] : []),
    ...plan.roster.squads.flatMap((s) => s.members),
    ...plan.roster.unassigned,
  ]
  const confirmed = allMembers.filter((m) => m.confirmed).length
  const unconfirmed = allMembers.length - confirmed

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
          <Users className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200">Roster</span>
          <span className={`font-mono text-[11px] ${count > 50 ? 'text-amber-300' : 'text-slate-400'}`}>{count}/50 players</span>
          <span className="font-mono text-[11px] text-emerald-400/90">{confirmed}/50 confirmed</span>
          <span className="font-mono text-[11px] text-amber-400/90">{unconfirmed} unconfirmed</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">Drag players or squad headers to reorder</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid h-full auto-rows-[minmax(220px,1fr)] grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {plan.roster.squads.slice(0, 9).map((squad, i) => (
              <SquadCard key={squad.id} squad={squad} index={i} />
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
              <SpecialistKitsCard plan={plan} />
            </div>
          </div>
        </div>
      </section>

      <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/10 bg-[#080d0a]">
        <div className="border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-300" />
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
              <MemberRow member={plan.roster.commander} accent="#facc15" index={0} target="commander" />
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
              <MemberRow key={m.id} member={m} index={i} target="unassigned" />
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

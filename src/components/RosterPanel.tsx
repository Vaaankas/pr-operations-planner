import { useEffect, useRef, useState } from 'react'
import { GripVertical, Plus, Star, Trash2, UserPlus, Users, X } from 'lucide-react'
import { usePlanner } from '../store'
import { PLAYER_CAP, playerCount, SQUAD_SIZE, SQUAD_TYPES } from '../lib/utils'
import type { Member, Squad } from '../types'

function EditableName({ value, onCommit, className, placeholder }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onCommit(v.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setV(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className={className}
    />
  )
}

function MemberChip({ member, accent, onRemove, onPromote }: { member: Member; accent?: string; onRemove: () => void; onPromote?: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/pr-member', member.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="group flex cursor-grab items-center gap-1.5 rounded border border-white/10 bg-black/30 px-1.5 py-1 active:cursor-grabbing"
    >
      <GripVertical className="h-3 w-3 shrink-0 text-slate-600 group-hover:text-slate-400" />
      {accent && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />}
      <EditableName
        value={member.name}
        onCommit={(name) => usePlanner.getState().renameMember(member.id, name || 'Unnamed')}
        className="min-w-0 flex-1 truncate bg-transparent text-[11px] font-medium text-slate-200 outline-none"
      />
      {onPromote && (
        <button onClick={onPromote} className="opacity-0 transition group-hover:opacity-100" title="Make commander">
          <Star className="h-3 w-3 text-slate-500 hover:text-amber-300" />
        </button>
      )}
      <button onClick={onRemove} className="opacity-0 transition group-hover:opacity-100" title="Remove player">
        <X className="h-3 w-3 text-slate-500 hover:text-rose-400" />
      </button>
    </div>
  )
}

function AddMember({ target, label = 'Add player' }: { target: string; label?: string }) {
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
    const ok = usePlanner.getState().addMember(target, name)
    if (ok) {
      setName('')
      setOpen(false)
    }
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-amber-300">
        <UserPlus className="h-3 w-3" /> {label}
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

function SquadCard({ squad, index }: { squad: Squad; index: number }) {
  const planner = usePlanner()
  const [drop, setDrop] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const full = squad.members.length >= SQUAD_SIZE
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
        const id = e.dataTransfer.getData('text/pr-member')
        if (id) planner.moveMember(id, squad.id)
      }}
      className={`rounded border bg-[#0b120e]/80 transition ${drop ? 'border-amber-400/70 bg-amber-400/5' : 'border-white/10'}`}
    >
      <div className="flex items-center gap-2 border-b border-white/5 px-2 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${squad.color}` }}>
        <span className="ml-1 font-mono text-[10px] font-bold text-slate-500">{String(index + 1).padStart(2, '0')}</span>
        <EditableName
          value={squad.name}
          onCommit={(name) => planner.updateSquad(squad.id, { name })}
          className="w-12 bg-transparent text-[12px] font-bold text-slate-100 outline-none"
        />
        <select
          value={squad.type}
          onChange={(e) => planner.updateSquad(squad.id, { type: e.target.value })}
          className="rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300 outline-none"
        >
          {SQUAD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{squad.members.length}/8</span>
        <button onClick={() => setColorOpen(!colorOpen)} className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ background: squad.color }} title="Squad colour" />
        <button onClick={() => planner.removeSquad(squad.id)} className="text-slate-600 hover:text-rose-400" title="Delete squad">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {colorOpen && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-2 py-1.5">
          {['#3b82f6', '#65a30d', '#22d3ee', '#facc15', '#e2e8f0', '#f472b6', '#86efac', '#a78bfa', '#fb923c', '#ef4444'].map((c) => (
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
      <div className="space-y-1 p-1.5">
        {squad.members.map((m) => (
          <MemberChip
            key={m.id}
            member={m}
            accent={squad.color}
            onRemove={() => planner.removeMember(m.id)}
            onPromote={() => planner.moveMember(m.id, 'commander')}
          />
        ))}
        {!full && <AddMember target={squad.id} label={squad.members.length ? 'Add' : 'Add player'} />}
        {full && <div className="px-1 py-0.5 text-[9px] uppercase tracking-wider text-slate-600">Squad full</div>}
      </div>
    </div>
  )
}

export function RosterPanel() {
  const plan = usePlanner((s) => s.plan)!
  const planner = usePlanner()
  const count = playerCount(plan)
  const [dropReserve, setDropReserve] = useState(false)
  const [dropCommander, setDropCommander] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Users className="h-3.5 w-3.5 text-amber-400" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">Roster</span>
        <span className={`ml-auto font-mono text-[11px] ${count >= PLAYER_CAP ? 'text-amber-300' : 'text-slate-400'}`}>{count}/{PLAYER_CAP}</span>
        <div className="h-1.5 w-16 overflow-hidden rounded bg-white/10">
          <div className={`h-full ${count >= PLAYER_CAP ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${(count / PLAYER_CAP) * 100}%` }} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-2">
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
          className={`rounded border px-2 py-2 ${dropCommander ? 'border-amber-400/60 bg-amber-400/5' : 'border-white/10 bg-black/20'}`}
        >
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">Commander</span>
            <span className="ml-auto font-mono text-[9px] text-slate-600">1</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {plan.roster.commander ? (
              <MemberChip
                member={plan.roster.commander}
                accent="#facc15"
                onRemove={() => planner.removeMember(plan.roster.commander!.id)}
              />
            ) : (
              <AddMember target="commander" label="Assign commander" />
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
          className={`rounded border px-2 py-2 ${dropReserve ? 'border-amber-400/60 bg-amber-400/5' : 'border-white/10 bg-black/20'}`}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">Reserve pool</span>
            <span className="ml-auto font-mono text-[9px] text-slate-600">{plan.roster.unassigned.length}</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {plan.roster.unassigned.map((m) => (
              <MemberChip
                key={m.id}
                member={m}
                onRemove={() => planner.removeMember(m.id)}
                onPromote={() => planner.moveMember(m.id, 'commander')}
              />
            ))}
            <AddMember target="unassigned" label="Add to reserve" />
          </div>
        </div>

        {plan.roster.squads.map((squad, i) => (
          <SquadCard key={squad.id} squad={squad} index={i} />
        ))}
      </div>

      {plan.roster.squads.length < 9 && (
        <button
          onClick={() => planner.addSquad()}
          className="flex shrink-0 items-center justify-center gap-1 border-t border-white/10 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:bg-white/5 hover:text-amber-300"
        >
          <Plus className="h-3 w-3" /> Add squad
        </button>
      )}
    </div>
  )
}

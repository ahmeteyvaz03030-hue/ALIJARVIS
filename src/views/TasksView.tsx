import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useTodos, type Todo } from '../state/useTodos'
import { EASE } from '../lib/motion'
import { clockStamp } from '../lib/hooks'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { SegmentBar, StatusPill } from '../components/hud/Readout'

function TaskRow({
  todo,
  index,
  onToggle,
  onRemove,
}: {
  todo: Todo
  index: number
  onToggle: () => void
  onRemove: () => void
}) {
  const { calm, cue } = useSystem()
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
      transition={{ duration: calm ? 0.15 : 0.38, ease: EASE.out, delay: calm ? 0 : index * 0.02 }}
      className="group flex items-center gap-3 border border-cyan/12 bg-cyan/[0.02] px-3 py-2.5"
    >
      <motion.button
        type="button"
        onClick={() => {
          cue(todo.done ? 'nav' : 'confirm')
          onToggle()
        }}
        whileTap={{ scale: 0.85 }}
        aria-label={todo.done ? 'Als offen markieren' : 'Als erledigt markieren'}
        className="relative flex h-5 w-5 shrink-0 items-center justify-center border transition-colors"
        style={{
          borderColor: todo.done ? 'rgba(124,255,155,0.7)' : 'rgba(53,230,255,0.35)',
          background: todo.done ? 'rgba(124,255,155,0.14)' : 'transparent',
        }}
      >
        <AnimatePresence>
          {todo.done && (
            <motion.svg
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE.out }}
              viewBox="0 0 16 16"
              className="h-3 w-3"
            >
              <motion.path
                d="M3 8.5l3 3 7-7"
                fill="none"
                stroke="#7cff9b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      <div className="min-w-0 flex-1">
        <div
          className={`text-[0.84rem] leading-snug transition-colors ${
            todo.done ? 'text-ice/35 line-through' : 'text-ice/90'
          }`}
        >
          {todo.text}
        </div>
        <div className="mt-0.5 font-mono text-[0.5rem] tracking-[0.14em] text-cyan/35">
          {todo.done && todo.doneAt
            ? `ERLEDIGT ${clockStamp(new Date(todo.doneAt))}`
            : `ANGELEGT ${clockStamp(new Date(todo.createdAt))}`}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          cue('deny')
          onRemove()
        }}
        aria-label="Löschen"
        className="shrink-0 font-mono text-sm text-cyan/25 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
      >
        ✕
      </button>
    </motion.div>
  )
}

export function TasksView() {
  const { calm, cue } = useSystem()
  const { open, done, add, toggle, remove, clearDone } = useTodos()
  const [draft, setDraft] = useState('')

  const total = open.length + done.length
  const progress = total > 0 ? (done.length / total) * 100 : 0

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <HoloCard
        index={0}
        tone="lime"
        title="Reminder Log"
        status={`${open.length} OFFEN`}
        className="lg:col-span-8"
        scan
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add(draft)
            setDraft('')
            cue('confirm')
          }}
          className="mb-4 flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Neue Erinnerung..."
            aria-label="Neue Erinnerung"
            className="hud-input flex-1 py-2 text-[0.84rem]"
            style={{ letterSpacing: 'normal' }}
          />
          <HudButton type="submit" variant="primary" small disabled={!draft.trim()}>
            Hinzufügen
          </HudButton>
        </form>

        {total === 0 ? (
          <div className="py-14 text-center font-mono text-[0.62rem] tracking-[0.2em] text-cyan/35">
            KEINE EINTRÄGE — LISTE IST LEER
          </div>
        ) : (
          <div className="space-y-4">
            {open.length > 0 && (
              <div className="space-y-1.5">
                <div className="hud-label mb-1">Offen</div>
                <AnimatePresence initial={false}>
                  {open.map((todo, i) => (
                    <TaskRow
                      key={todo.id}
                      todo={todo}
                      index={i}
                      onToggle={() => toggle(todo.id)}
                      onRemove={() => remove(todo.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {done.length > 0 && (
              <div className="space-y-1.5 border-t border-cyan/10 pt-3">
                <div className="flex items-center justify-between">
                  <span className="hud-label">Erledigt</span>
                  <button
                    type="button"
                    onClick={() => {
                      cue('nav')
                      clearDone()
                    }}
                    className="font-mono text-[0.55rem] tracking-[0.16em] text-cyan/40 hover:text-cyan/80"
                  >
                    ERLEDIGTE LÖSCHEN
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {done.map((todo, i) => (
                    <TaskRow
                      key={todo.id}
                      todo={todo}
                      index={i}
                      onToggle={() => toggle(todo.id)}
                      onRemove={() => remove(todo.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </HoloCard>

      <div className="grid grid-cols-1 gap-3 lg:col-span-4 lg:grid-rows-[auto_1fr]">
        <HoloCard index={1} tone="cyan" title="Fortschritt" status="LIVE">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="hud-label">Erledigt</span>
              <span className="font-display text-lg font-black tabular-nums text-ice">
                {done.length} / {total}
              </span>
            </div>
            <SegmentBar value={progress} segments={20} tone="lime" />
            <div className="flex items-center justify-between border-t border-cyan/10 pt-3">
              <span className="hud-label">Status</span>
              <StatusPill tone={total === 0 ? 'cyan' : progress === 100 ? 'lime' : 'amber'} pulse={!calm}>
                {total === 0 ? 'KEINE AUFGABEN' : progress === 100 ? 'ALLES ERLEDIGT' : 'IN BEARBEITUNG'}
              </StatusPill>
            </div>
          </div>
        </HoloCard>

        <HoloCard index={2} tone="violet" title="Vorschläge" status="TRIP">
          <p className="mb-3 text-[0.76rem] leading-relaxed text-ice/60">
            Ein paar typische Punkte vor dem Abflug nach Marmaris:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Koffer packen',
              'Reisepass prüfen',
              'Steckdosenadapter einpacken',
              'Sonnencreme kaufen',
              'Tony Bescheid geben',
              'Auslandskrankenversicherung prüfen',
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  add(suggestion)
                  cue('confirm')
                }}
                className="border border-violet/25 bg-violet/[0.05] px-2 py-1 font-mono text-[0.58rem] tracking-[0.06em] text-violet/80 transition-colors hover:border-violet/55 hover:text-violet"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </HoloCard>
      </div>
    </div>
  )
}

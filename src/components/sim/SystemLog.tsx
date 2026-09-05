import { AnimatePresence, motion } from 'framer-motion'
import { useLog, useSystem, type LogLevel } from '../../state/SystemProvider'
import { clockStamp } from '../../lib/hooks'
import { EASE } from '../../lib/motion'
import { HoloCard } from '../hud/HoloCard'

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: 'rgba(53,230,255,0.75)',
  ok: 'rgba(124,255,155,0.9)',
  warn: 'rgba(255,181,77,0.9)',
  core: 'rgba(182,244,255,0.95)',
}

const LEVEL_MARK: Record<LogLevel, string> = {
  info: '·',
  ok: '+',
  warn: '!',
  core: '*',
}

/**
 * LIVE SYSTEM LOG — a real terminal tail. Only the most recent entries are
 * mounted (`visibleCount`), so the list never grows unbounded.
 */
export function SystemLog({
  index = 0,
  visibleCount = 7,
}: {
  index?: number
  visibleCount?: number
}) {
  const { calm } = useSystem()
  const log = useLog()
  const entries = log.slice(-visibleCount)

  return (
    <HoloCard
      title="System Log"
      status={`${log.length} EVT`}
      index={index}
      tone="cyan"
      bodyClassName="p-0"
    >
      <div className="relative">
        {/* terminal chrome */}
        <div className="flex items-center gap-2 border-b border-cyan/10 bg-void/40 px-3 py-1.5">
          <span className="flex gap-1">
            {['#ff5a6e', '#ffb54d', '#7cff9b'].map((c) => (
              <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c, opacity: 0.65 }} />
            ))}
          </span>
          <span className="font-mono text-[0.55rem] tracking-[0.2em] text-cyan/40">
            rjv://core/journal --follow
          </span>
        </div>

        <div className="min-h-[11rem] space-y-0.5 p-3 font-mono text-[0.68rem] leading-relaxed">
          <AnimatePresence initial={false} mode="popLayout">
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={
                  calm
                    ? { opacity: 0 }
                    : { opacity: 0, x: -16, filter: 'blur(4px)', backgroundColor: 'rgba(53,230,255,0.18)' }
                }
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)', backgroundColor: 'rgba(53,230,255,0)' }}
                exit={{ opacity: 0, x: 12, height: 0 }}
                transition={{ duration: calm ? 0.15 : 0.45, ease: EASE.out }}
                className="flex items-baseline gap-2 whitespace-nowrap"
              >
                <span className="shrink-0 text-cyan/35 tabular-nums">{clockStamp(entry.at)}</span>
                <span className="shrink-0" style={{ color: LEVEL_COLOR[entry.level] }}>
                  {LEVEL_MARK[entry.level]}
                </span>
                <span className="truncate" style={{ color: LEVEL_COLOR[entry.level] }}>
                  {entry.text}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-cyan/35">{clockStamp(new Date())}</span>
            <span className="text-cyan/50">$</span>
            <span className="jv-blink inline-block h-3 w-1.5 translate-y-[1px] bg-cyan" />
          </div>
        </div>
      </div>
    </HoloCard>
  )
}

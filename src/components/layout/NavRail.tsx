import { motion } from 'framer-motion'
import { useSystem } from '../../state/SystemProvider'
import {
  IconChecklist,
  IconComms,
  IconCore,
  IconFilm,
  IconPin,
  IconPlane,
  IconSettings,
  IconTrophy,
} from './Icons'

export type ViewId =
  | 'home'
  | 'travel'
  | 'marmaris'
  | 'movies'
  | 'fortnite'
  | 'tasks'
  | 'comms'
  | 'settings'

interface NavItem {
  id: ViewId
  label: string
  code: string
  Icon: typeof IconCore
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'HOME', code: 'CORE', Icon: IconCore },
  { id: 'travel', label: 'TRAVEL', code: 'FLGT', Icon: IconPlane },
  { id: 'marmaris', label: 'MARMARIS', code: 'GEO', Icon: IconPin },
  { id: 'movies', label: 'MOVIES', code: 'ENT', Icon: IconFilm },
  { id: 'fortnite', label: 'FORTNITE', code: 'GAME', Icon: IconTrophy },
  { id: 'tasks', label: 'TASKS', code: 'TSK', Icon: IconChecklist },
  { id: 'comms', label: 'TONY COMMS', code: 'COM', Icon: IconComms },
  { id: 'settings', label: 'SETTINGS', code: 'SYS', Icon: IconSettings },
]

export function NavRail({
  active,
  onSelect,
  badges = {},
}: {
  active: ViewId
  onSelect: (id: ViewId) => void
  /** Per-view unread/open counts — shown as a small pulsing badge on the icon. */
  badges?: Partial<Record<ViewId, number>>
}) {
  const { calm, cue } = useSystem()

  return (
    <>
      {/* desktop rail */}
      <motion.nav
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        className="sticky top-[3.25rem] z-40 hidden h-[calc(100vh-3.25rem)] w-[5.4rem] shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-cyan/12 bg-void/50 py-4 backdrop-blur-sm lg:flex"
      >
        {NAV_ITEMS.map((item, i) => (
          <RailButton
            key={item.id}
            item={item}
            active={active === item.id}
            badge={badges[item.id] ?? 0}
            delay={i * 0.05}
            onClick={() => {
              if (active !== item.id) cue('nav')
              onSelect(item.id)
            }}
          />
        ))}

        <div className="mt-auto w-full px-3">
          <div className="h-px bg-cyan/15" />
          <motion.div
            className="mt-3 flex flex-col items-center gap-1 font-mono text-[0.5rem] tracking-[0.2em] text-cyan/35"
            animate={calm ? undefined : { opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span>RJV</span>
            <span>0.1.0</span>
          </motion.div>
        </div>
      </motion.nav>

      {/* mobile dock */}
      <motion.nav
        initial={{ y: 90 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-between gap-0.5 border-t border-cyan/20 bg-void/92 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <DockButton
            key={item.id}
            item={item}
            active={active === item.id}
            badge={badges[item.id] ?? 0}
            onClick={() => {
              if (active !== item.id) cue('nav')
              onSelect(item.id)
            }}
          />
        ))}
      </motion.nav>
    </>
  )
}

function Badge({ count }: { count: number }) {
  const { calm } = useSystem()
  if (!count) return null
  return (
    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center px-1">
      {!calm && (
        <motion.span
          className="absolute inset-0 rounded-full border border-amber"
          animate={{ scale: [1, 1.9], opacity: [0.9, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className="relative rounded-full bg-amber px-1 font-display text-[0.5rem] font-black leading-4 text-void">
        {count}
      </span>
    </span>
  )
}

function RailButton({
  item,
  active,
  badge,
  delay,
  onClick,
}: {
  item: NavItem
  active: boolean
  badge: number
  delay: number
  onClick: () => void
}) {
  const { Icon } = item
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 3 }}
      className="group relative flex w-[4.4rem] flex-col items-center gap-1 py-2.5"
      aria-current={active ? 'page' : undefined}
      title={item.label}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className="absolute inset-0 border border-cyan/45 bg-cyan/10"
          style={{
            clipPath:
              'polygon(0 6px, 6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)',
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      {active && (
        <motion.span
          layoutId="rail-active-bar"
          className="absolute left-0 top-1/2 h-8 w-[2px] -translate-y-1/2 bg-cyan shadow-[0_0_10px_#35e6ff]"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <Badge count={badge} />
      <span
        className={`relative transition-colors duration-200 ${
          active ? 'text-cyan' : 'text-cyan/45 group-hover:text-cyan/85'
        }`}
        style={active ? { filter: 'drop-shadow(0 0 7px rgba(53,230,255,0.8))' } : undefined}
      >
        <Icon size={20} />
      </span>
      <span
        className={`relative font-display text-[0.5rem] font-bold tracking-[0.14em] transition-colors ${
          active ? 'text-ice' : 'text-cyan/40 group-hover:text-cyan/70'
        }`}
      >
        {item.code}
      </span>
    </motion.button>
  )
}

function DockButton({
  item,
  active,
  badge,
  onClick,
}: {
  item: NavItem
  active: boolean
  badge: number
  onClick: () => void
}) {
  const { Icon } = item
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="relative flex flex-1 flex-col items-center gap-0.5 py-2"
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
    >
      {active && (
        <motion.span
          layoutId="dock-active"
          className="absolute inset-x-0.5 inset-y-0 border-t-2 border-cyan bg-cyan/10"
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        />
      )}
      <Badge count={badge} />
      <span className={`relative ${active ? 'text-cyan' : 'text-cyan/45'}`}>
        <Icon size={18} />
      </span>
      <span
        className={`relative font-display text-[0.44rem] font-bold tracking-[0.1em] ${
          active ? 'text-ice' : 'text-cyan/40'
        }`}
      >
        {item.code}
      </span>
    </motion.button>
  )
}

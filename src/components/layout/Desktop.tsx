import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useComms } from '../../state/useComms'
import { useTodos } from '../../state/useTodos'
import { TRIP } from '../../lib/config'
import { calmViewVariants, viewVariants } from '../../lib/motion'
import type { JarvisSession } from '../../lib/auth'
import { NavRail, type ViewId } from './NavRail'
import { TopBar } from './TopBar'
import { HomeView } from '../../views/HomeView'
import { TravelView } from '../../views/TravelView'
import { MarmarisView } from '../../views/MarmarisView'
import { MoviesView } from '../../views/MoviesView'
import { FortniteView } from '../../views/FortniteView'
import { BesiktasView } from '../../views/BesiktasView'
import { CinemaView } from '../../views/CinemaView'
import { OwnerView } from '../../views/OwnerView'
import { ProfileView } from '../../views/ProfileView'
import { TasksView } from '../../views/TasksView'
import { CommsView } from '../../views/CommsView'
import { SettingsView } from '../../views/SettingsView'
import { ArrivalSequence } from '../travel/ArrivalSequence'
import { FlightModeCinematic, FlightModeStrip } from '../travel/FlightModeBanner'
import { JarvisConsole } from '../jarvis/JarvisConsole'
import { ModeBanner } from './ModeBanner'
import { useHub } from '../../state/DataHub'
import { useOwnerFeed } from '../../state/useOwnerFeed'
import { MODE_SPEC } from '../../lib/jarvisModes'

const VIEW_TITLE: Record<ViewId, string> = {
  home: 'CORE OVERVIEW',
  profile: 'ALI DATABASE',
  travel: 'TRAVEL OPERATIONS',
  marmaris: 'MARMARIS INTEL',
  movies: 'ENTERTAINMENT INDEX',
  fortnite: 'FORTNITE TRACKER',
  besiktas: 'BEŞIKTAŞ COMMAND',
  cinema: 'KINO PLAUEN',
  tasks: 'REMINDER LOG',
  comms: 'PRIVATE CHANNELS',
  owner: 'OWNER CONSOLE',
  settings: 'SYSTEM CONFIGURATION',
}

/** One-shot cinematics are remembered per trip so they don't replay on reload. */
function seenKey(name: string) {
  return `ronaljarvis.seen.${name}.${TRIP.departure.toISOString().slice(0, 10)}`
}

function hasSeen(name: string): boolean {
  try {
    return localStorage.getItem(seenKey(name)) === '1'
  } catch {
    return false
  }
}

function markSeen(name: string): void {
  try {
    localStorage.setItem(seenKey(name), '1')
  } catch {
    /* ignore */
  }
}

export function Desktop({
  session,
  onSignOut,
  onReplayBoot,
}: {
  session: JarvisSession
  onSignOut: () => void
  onReplayBoot: () => void
}) {
  const { phase, calm, cue, pushLog } = useSystem()
  const { mode } = useHub()
  const comms = useComms()
  const ownerFeed = useOwnerFeed(true)
  const { open: openTasks } = useTodos()
  const [view, setView] = useState<ViewId>('home')
  const [cinematic, setCinematic] = useState<'none' | 'flight' | 'arrival'>('none')
  const [consoleOpen, setConsoleOpen] = useState(false)
  const lastPhase = useRef(phase)

  /* The mode paints the whole interface, so it is applied to the root element
     rather than threaded through every panel. */
  useEffect(() => {
    const root = document.documentElement
    root.dataset.jarvisMode = mode
    root.style.setProperty('--jv-accent', MODE_SPEC[mode].accent)
    return () => {
      root.style.removeProperty('--jv-accent')
      delete root.dataset.jarvisMode
    }
  }, [mode])

  /* Fire the phase cinematics — once on entry, or on demand from settings. */
  useEffect(() => {
    const entered = lastPhase.current !== phase
    lastPhase.current = phase
    if (phase === 'flight_day' && (entered || !hasSeen('flight')) && !hasSeen('flight')) {
      markSeen('flight')
      setCinematic('flight')
    } else if (phase === 'arrived' && (entered || !hasSeen('arrival')) && !hasSeen('arrival')) {
      markSeen('arrival')
      setCinematic('arrival')
    }
  }, [phase])

  const select = useCallback(
    (next: ViewId) => {
      if (next === view) return
      setView(next)
      pushLog(`Module focus → ${VIEW_TITLE[next]}`, 'info')
    },
    [pushLog, view],
  )

  /** Answers can offer a jump; the brain only knows the id as a string. */
  const navigate = useCallback(
    (id: string) => {
      if (VIEW_TITLE[id as ViewId]) select(id as ViewId)
    },
    [select],
  )

  /* ⌘K / Strg+K reaches RonalJarvis from any module. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setConsoleOpen((o) => !o)
        cue('process')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cue])

  const flightStrip = phase === 'flight_day' || phase === 'in_flight'
  const variants = calm ? calmViewVariants : viewVariants

  return (
    <div className="relative min-h-screen">
      <TopBar session={session} onSignOut={onSignOut} onOpenConsole={() => setConsoleOpen(true)} />

      <AnimatePresence>{flightStrip && <FlightModeStrip inFlight={phase === 'in_flight'} />}</AnimatePresence>

      <ModeBanner mode={mode} onOpen={() => select('settings')} />

      {/* While the console is open the page behind it is inert: the backdrop
          already blocks the mouse, but without this the chat and the nav stay
          tab-reachable underneath a modal dialog. */}
      <div className="flex" inert={consoleOpen}>
        <NavRail
          active={view}
          onSelect={select}
          badges={{
            comms: comms.unread + ownerFeed.unread.length,
            tasks: openTasks.length,
          }}
        />

        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-5 lg:pb-8">
          {/* breadcrumb / module header */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <motion.span
                key={`${view}-tick`}
                className="h-3 w-[2px] bg-cyan shadow-[0_0_8px_#35e6ff]"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              />
              <AnimatePresence mode="wait">
                <motion.h1
                  key={view}
                  initial={{ opacity: 0, y: 10, letterSpacing: '0.4em' }}
                  animate={{ opacity: 1, y: 0, letterSpacing: '0.22em' }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                  className="truncate font-display text-[0.72rem] font-black tracking-[0.22em] text-ice"
                >
                  {VIEW_TITLE[view]}
                </motion.h1>
              </AnimatePresence>
            </div>
            <div className="hidden items-center gap-2 font-mono text-[0.55rem] tracking-[0.2em] text-cyan/35 sm:flex">
              <span>RJV://{view.toUpperCase()}</span>
              <span className="jv-blink">▌</span>
            </div>
          </div>

          {/* view switch — panels power down, new module rails in */}
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              variants={variants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {view === 'home' && (
                <HomeView session={session} unread={comms.unread} onNavigate={navigate} />
              )}
              {view === 'profile' && <ProfileView />}
              {view === 'travel' && <TravelView />}
              {view === 'marmaris' && <MarmarisView />}
              {view === 'movies' && <MoviesView onOpenSettings={() => select('settings')} />}
              {view === 'fortnite' && <FortniteView />}
              {view === 'besiktas' && <BesiktasView />}
              {view === 'cinema' && <CinemaView />}
              {view === 'owner' && <OwnerView />}
              {view === 'tasks' && <TasksView />}
              {view === 'comms' && <CommsView comms={comms} />}
              {view === 'settings' && (
                <SettingsView
                  session={session}
                  onSignOut={onSignOut}
                  onReplayBoot={onReplayBoot}
                  onReplayFlightMode={() => {
                    cue('nav')
                    setCinematic('flight')
                  }}
                  onReplayArrival={() => {
                    cue('nav')
                    setCinematic('arrival')
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <JarvisConsole
        open={consoleOpen}
        unread={comms.unread}
        onClose={() => setConsoleOpen(false)}
        onNavigate={navigate}
      />

      {/* phase cinematics */}
      <AnimatePresence>
        {cinematic === 'flight' && (
          <FlightModeCinematic key="flight" onDone={() => setCinematic('none')} />
        )}
        {cinematic === 'arrival' && (
          <ArrivalSequence key="arrival" onDone={() => setCinematic('none')} />
        )}
      </AnimatePresence>
    </div>
  )
}

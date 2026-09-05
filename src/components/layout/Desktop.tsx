import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useComms } from '../../state/useComms'
import { TRIP } from '../../lib/config'
import { calmViewVariants, viewVariants } from '../../lib/motion'
import type { JarvisSession } from '../../lib/auth'
import { NavRail, type ViewId } from './NavRail'
import { TopBar } from './TopBar'
import { HomeView } from '../../views/HomeView'
import { TravelView } from '../../views/TravelView'
import { MarmarisView } from '../../views/MarmarisView'
import { MoviesView } from '../../views/MoviesView'
import { CommsView } from '../../views/CommsView'
import { SettingsView } from '../../views/SettingsView'
import { ArrivalSequence } from '../travel/ArrivalSequence'
import { FlightModeCinematic, FlightModeStrip } from '../travel/FlightModeBanner'

const VIEW_TITLE: Record<ViewId, string> = {
  home: 'CORE OVERVIEW',
  travel: 'TRAVEL OPERATIONS',
  marmaris: 'MARMARIS INTEL',
  movies: 'ENTERTAINMENT INDEX',
  comms: 'PRIVATE CHANNEL',
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
  const comms = useComms()
  const [view, setView] = useState<ViewId>('home')
  const [cinematic, setCinematic] = useState<'none' | 'flight' | 'arrival'>('none')
  const lastPhase = useRef(phase)

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

  const flightStrip = phase === 'flight_day' || phase === 'in_flight'
  const variants = calm ? calmViewVariants : viewVariants

  return (
    <div className="relative min-h-screen">
      <TopBar session={session} onSignOut={onSignOut} />

      <AnimatePresence>{flightStrip && <FlightModeStrip inFlight={phase === 'in_flight'} />}</AnimatePresence>

      <div className="flex">
        <NavRail active={view} onSelect={select} unread={comms.unread} />

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
              {view === 'home' && <HomeView session={session} />}
              {view === 'travel' && <TravelView />}
              {view === 'marmaris' && <MarmarisView />}
              {view === 'movies' && <MoviesView onOpenSettings={() => select('settings')} />}
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

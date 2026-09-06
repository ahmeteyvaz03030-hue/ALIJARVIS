import { useCallback, useRef } from 'react'
import { useStats, useSystem } from '../../state/SystemProvider'
import { useHub } from '../../state/DataHub'
import { useWatchlist } from '../../state/useWatchlist'
import { useTodos } from '../../state/useTodos'
import { useProfile } from '../../state/useProfile'
import { aimRecords } from '../fortnite/AimTrainer'
import { storedSens } from '../fortnite/SensFinder'
import { respond, type BrainContext } from '../../lib/jarvis/brain'
import type { JarvisAnswer } from '../../lib/jarvis/types'

/**
 * Assembles everything RonalJarvis is allowed to know and hands it back as a
 * stable getter.
 *
 * The context is read at call time through a ref: the telemetry tick would
 * otherwise rebuild it — and every callback depending on it — several times a
 * second, for an object nobody is looking at in between questions.
 */
export function useJarvisBrainContext(unreadFromTony = 0): () => BrainContext {
  const { settings, phase } = useSystem()
  const stats = useStats()
  const { ensure, mode } = useHub()
  const watchlist = useWatchlist()
  const { todos, open } = useTodos()
  const { profile } = useProfile()

  const ctxRef = useRef<BrainContext>(null as unknown as BrainContext)
  ctxRef.current = {
    ensure,
    settings,
    phase,
    mode,
    stats: { cpu: stats.cpu, network: stats.network, ping: stats.ping },
    watchlist: watchlist.entries,
    todos,
    openTodos: open,
    unreadFromTony,
    profile,
    aimBests: aimRecords(),
    sens: storedSens(),
  }

  return useCallback(() => ctxRef.current, [])
}

/**
 * One `ask` shared by the home dialogue and the global console, so the two can
 * never drift apart in what they are able to answer.
 */
export function useJarvisBrain(unreadFromTony = 0) {
  const getContext = useJarvisBrainContext(unreadFromTony)
  const { mode } = useHub()

  const ask = useCallback(
    (question: string): Promise<JarvisAnswer> => respond(question, getContext()),
    [getContext],
  )

  return { ask, mode }
}

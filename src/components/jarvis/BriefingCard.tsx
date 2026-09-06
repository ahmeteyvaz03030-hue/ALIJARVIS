import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { buildBriefing } from '../../lib/jarvis/brain'
import type { JarvisAnswer } from '../../lib/jarvis/types'
import { useJarvisBrainContext } from './useJarvisBrain'
import { AnswerBlocks } from './AnswerBlocks'
import { HoloCard } from '../hud/HoloCard'
import { HudButton } from '../hud/HudButton'

/**
 * The briefing, rendered without being asked for.
 *
 * It is the same call the console makes for "Was läuft heute?" — one function,
 * one answer, so the card and the chat can never tell Ali two different things.
 */
export function BriefingCard({
  index,
  unread,
  className,
  onAsk,
}: {
  index: number
  unread: number
  className?: string
  onAsk?: () => void
}) {
  const { calm } = useSystem()
  const getContext = useJarvisBrainContext(unread)
  const [answer, setAnswer] = useState<JarvisAnswer | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void buildBriefing(getContext()).then((result) => {
      if (cancelled) return
      setAnswer(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [getContext, nonce])

  return (
    <HoloCard
      index={index}
      tone="cyan"
      title="Today's Briefing"
      status={loading ? 'SAMMELT...' : 'LIVE'}
      className={className}
      scan
    >
      {loading && !answer ? (
        <div className="flex items-center gap-3 py-6">
          <motion.div
            className="h-5 w-5 rounded-full border border-cyan/25 border-t-cyan"
            animate={calm ? undefined : { rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <span className="font-mono text-[0.55rem] tracking-[0.18em] text-cyan/45">
            MODULE WERDEN ABGEFRAGT...
          </span>
        </div>
      ) : (
        answer && <AnswerBlocks blocks={answer.blocks} />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cyan/12 pt-3">
        <HudButton small variant="ghost" busy={loading} onClick={() => setNonce((n) => n + 1)}>
          Aktualisieren
        </HudButton>
        {onAsk && (
          <HudButton small variant="primary" onClick={onAsk}>
            RonalJarvis fragen
          </HudButton>
        )}
      </div>
    </HoloCard>
  )
}

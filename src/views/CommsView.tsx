import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useStats, useSystem } from '../state/SystemProvider'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { SegmentBar, StatusPill } from '../components/hud/Readout'
import { TonyComms } from '../components/comms/TonyComms'
import { JarvisChannel } from '../components/comms/JarvisChannel'
import type { useComms } from '../state/useComms'

export function CommsView({ comms }: { comms: ReturnType<typeof useComms> }) {
  const { calm } = useSystem()
  const stats = useStats()

  useEffect(() => {
    comms.setViewing(true)
    return () => comms.setViewing(false)
  }, [comms])

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      {/* The owner's channel comes first — it carries the messages that were
          actually written for Ali, rather than the simulated ones. */}
      <JarvisChannel index={0} className="lg:col-span-12" />

      <div className="lg:col-span-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE.out }}
          className="h-full"
        >
          <TonyComms
            messages={comms.messages}
            phase={comms.phase}
            tonyTyping={comms.tonyTyping}
            onConnect={comms.connect}
            onSend={comms.send}
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:col-span-4">
        <HoloCard index={1} tone="lime" title="Channel Integrity" status="E2E" scan>
          <div className="space-y-3">
            {[
              { k: 'VERSCHLÜSSELUNG', v: 'AES-256 / 4096', bar: 100 },
              { k: 'LATENZ', v: `${stats.ping} ms`, bar: Math.max(0, 100 - stats.ping) },
              { k: 'UPLINK', v: `${stats.uplink}%`, bar: stats.uplink },
            ].map((row, i) => (
              <motion.div
                key={row.k}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.08, duration: 0.4 }}
                className="space-y-1.5"
              >
                <div className="flex items-baseline justify-between">
                  <span className="hud-label">{row.k}</span>
                  <span className="font-mono text-[0.66rem] tabular-nums text-lime/90">
                    {row.v}
                  </span>
                </div>
                <SegmentBar value={row.bar} segments={16} tone="lime" />
              </motion.div>
            ))}

            <div className="flex items-center justify-between border-t border-lime/12 pt-3">
              <span className="hud-label">Session</span>
              <StatusPill tone={comms.phase === 'active' ? 'lime' : 'amber'}>
                {comms.phase === 'active' ? 'ACTIVE' : 'HANDSHAKE'}
              </StatusPill>
            </div>
          </div>
        </HoloCard>

        <HoloCard index={2} tone="cyan" title="Contact" status="TONY">
          <div className="flex items-center gap-3">
            <span className="relative flex h-12 w-12 items-center justify-center border border-lime/40 bg-lime/10 font-display text-sm font-black text-lime">
              TO
              {!calm && (
                <motion.span
                  className="absolute inset-0 border border-lime/50"
                  animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
            </span>
            <div>
              <div className="font-display text-[0.82rem] font-bold tracking-[0.12em] text-ice">
                TONY
              </div>
              <div className="mt-0.5 font-mono text-[0.55rem] tracking-[0.16em] text-cyan/50">
                MARMARIS · UTC+3
              </div>
              <div className="mt-1">
                <StatusPill tone="lime">ERREICHBAR</StatusPill>
              </div>
            </div>
          </div>

          <p className="mt-3 border-t border-cyan/10 pt-3 text-[0.76rem] leading-relaxed text-ice/60">
            Privater Kanal. Nachrichten werden lokal in der Session gehalten und sind Teil der
            Demo-Simulation — kein externer Dienst ist angebunden.
          </p>
        </HoloCard>
      </div>
    </div>
  )
}

import { motion } from 'framer-motion'
import { useSystem, type MotionPreference } from '../state/SystemProvider'
import { FLIGHT_PHASES, PHASE_LABEL, type FlightPhase } from '../lib/config'
import { authProvider, type JarvisSession } from '../lib/auth'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { StatusPill } from '../components/hud/Readout'

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan/10 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="font-display text-[0.68rem] font-bold tracking-[0.16em] text-ice/90">
          {label}
        </div>
        {hint && (
          <div className="mt-0.5 max-w-sm font-mono text-[0.58rem] leading-relaxed text-cyan/45">
            {hint}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  )
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex border border-cyan/20">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="relative px-2.5 py-1.5 font-display text-[0.55rem] font-bold tracking-[0.16em] transition-colors"
            style={{ color: active ? '#eafcff' : 'rgba(53,230,255,0.5)' }}
          >
            {active && (
              <motion.span
                layoutId={`choice-${options.map((o) => o.value).join('-')}`}
                className="absolute inset-0 border border-cyan/60 bg-cyan/15"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SettingsView({
  session,
  onSignOut,
  onReplayBoot,
  onReplayFlightMode,
  onReplayArrival,
}: {
  session: JarvisSession
  onSignOut: () => void
  onReplayBoot: () => void
  onReplayFlightMode: () => void
  onReplayArrival: () => void
}) {
  const { settings, patchSettings, motionLevel, perfTier, prefersReducedMotion, phase, pushLog } =
    useSystem()

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* --------------------------------------------------------- interface */}
      <HoloCard index={0} tone="cyan" title="Interface & Motion" status="SYS" className="lg:col-span-7">
        <Row
          label="ANIMATIONEN"
          hint="AUTO folgt der Systemeinstellung des Geräts. CALM deaktiviert alle starken Bewegungen."
        >
          <Choice<MotionPreference>
            value={settings.motion}
            onChange={(motion) => patchSettings({ motion })}
            options={[
              { value: 'auto', label: 'AUTO' },
              { value: 'full', label: 'FULL' },
              { value: 'calm', label: 'REDUCE' },
            ]}
          />
        </Row>

        <Row label="UI-SOUNDS" hint="Dezente, synthetisch erzeugte Interface-Töne. Standard: aus.">
          <Choice
            value={settings.sound ? 'on' : 'off'}
            onChange={(v) => patchSettings({ sound: v === 'on' })}
            options={[
              { value: 'off', label: 'AUS' },
              { value: 'on', label: 'AN' },
            ]}
          />
        </Row>

        <Row label="SCANLINES" hint="CRT-Overlay über der gesamten Oberfläche.">
          <Choice
            value={settings.scanlines ? 'on' : 'off'}
            onChange={(v) => patchSettings({ scanlines: v === 'on' })}
            options={[
              { value: 'off', label: 'AUS' },
              { value: 'on', label: 'AN' },
            ]}
          />
        </Row>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-cyan/10 pt-4">
          {[
            ['MOTION LEVEL', motionLevel.toUpperCase()],
            ['RENDER BUDGET', perfTier.toUpperCase()],
            ['OS PREFERENCE', prefersReducedMotion ? 'REDUCED' : 'NORMAL'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="hud-label mb-0.5">{k}</div>
              <div className="font-display text-[0.7rem] font-bold text-cyan">{v}</div>
            </div>
          ))}
        </div>
      </HoloCard>

      {/* ------------------------------------------------------------ identity */}
      <HoloCard index={1} tone="lime" title="Identity" status={session.accessLevel} className="lg:col-span-5">
        <div className="space-y-2.5">
          {[
            ['USER', session.displayName],
            ['ACCESS LEVEL', session.accessLevel],
            ['STATUS', 'AUTHORIZED'],
            ['PROVIDER', authProvider.label],
            [
              'SESSION BIS',
              session.expiresAt
                ? new Date(session.expiresAt).toLocaleString('de-DE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                : 'UNBEGRENZT',
            ],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <span className="hud-label">{k}</span>
              <span className="font-display text-[0.72rem] font-bold tracking-[0.1em] text-lime">
                {v}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-lime/12 pt-3 font-mono text-[0.58rem] leading-relaxed text-cyan/45">
          Das Demo-Gate prüft nur einen lokalen Signaturkode (als Digest im Build, nie im
          Klartext). Der Provider ist über <span className="text-cyan/70">src/lib/auth/index.ts</span>{' '}
          gegen Supabase oder Firebase austauschbar — die Oberfläche bleibt unverändert.
        </p>

        <div className="mt-4">
          <HudButton variant="danger" onClick={onSignOut}>
            Session beenden
          </HudButton>
        </div>
      </HoloCard>

      {/* ---------------------------------------------------------- simulation */}
      <HoloCard
        index={2}
        tone="amber"
        title="Mission Simulation"
        status="DEMO"
        className="lg:col-span-12"
        scan
      >
        <p className="mb-4 max-w-2xl text-[0.8rem] leading-relaxed text-ice/65">
          Für die Demo lassen sich alle Missionsphasen erzwingen — so sind Flight Mode und die
          Ankunfts-Cinematic sofort sichtbar, ohne auf den Reisetag zu warten. AUTO leitet die
          Phase wieder aus der echten Uhrzeit ab.
        </p>

        <Row label="PHASE" hint={`Aktuell aktiv: ${PHASE_LABEL[phase]}`}>
          <div className="flex flex-wrap gap-1.5">
            <HudButton
              small
              variant={settings.phaseOverride === null ? 'primary' : 'ghost'}
              onClick={() => patchSettings({ phaseOverride: null })}
            >
              AUTO
            </HudButton>
            {FLIGHT_PHASES.map((p: FlightPhase) => (
              <HudButton
                key={p}
                small
                variant={settings.phaseOverride === p ? 'primary' : 'ghost'}
                onClick={() => {
                  patchSettings({ phaseOverride: p })
                  pushLog(`Simulation → ${PHASE_LABEL[p]}`, 'warn')
                }}
              >
                {PHASE_LABEL[p]}
              </HudButton>
            ))}
          </div>
        </Row>

        <Row label="CINEMATICS" hint="Sequenzen erneut abspielen.">
          <div className="flex flex-wrap gap-1.5">
            <HudButton small variant="ghost" onClick={onReplayBoot}>
              Boot
            </HudButton>
            <HudButton small variant="ghost" onClick={onReplayFlightMode}>
              Flight Mode
            </HudButton>
            <HudButton small variant="ghost" onClick={onReplayArrival}>
              Arrival
            </HudButton>
          </div>
        </Row>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-amber/12 pt-4">
          <StatusPill tone={settings.phaseOverride ? 'amber' : 'lime'}>
            {settings.phaseOverride ? 'SIMULATION AKTIV' : 'ECHTZEIT'}
          </StatusPill>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE.out }}
            className="font-mono text-[0.58rem] tracking-[0.16em] text-cyan/45"
          >
            RJV 0.1.0-DEMO · BUILD LOCAL
          </motion.span>
        </div>
      </HoloCard>
    </div>
  )
}

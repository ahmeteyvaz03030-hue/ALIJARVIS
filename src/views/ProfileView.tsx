import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useHub, useSlice } from '../state/DataHub'
import { useProfile, type Profile } from '../state/useProfile'
import { useWatchlist } from '../state/useWatchlist'
import { useTodos } from '../state/useTodos'
import { aimRecords, DRILL_ORDER } from '../components/fortnite/AimTrainer'
import { storedSens } from '../components/fortnite/SensFinder'
import { cm360, eDPI } from '../lib/sensitivity'
import { DESTINATION, PHASE_LABEL, TRIP } from '../lib/config'
import { MODE_SPEC } from '../lib/jarvisModes'
import { isBesiktas } from '../lib/football'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { StatusPill } from '../components/hud/Readout'

/* -------------------------------------------------------------------------- */
/* The record itself                                                          */
/* -------------------------------------------------------------------------- */

function DataLine({
  label,
  value,
  tone = 'ice',
  delay = 0,
}: {
  label: string
  value: string
  tone?: 'ice' | 'lime' | 'amber' | 'violet' | 'cyan'
  delay?: number
}) {
  const color = {
    ice: '#d8f6ff',
    lime: '#8cff78',
    amber: '#ffb54d',
    violet: '#a97bff',
    cyan: '#35e6ff',
  }[tone]

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35, ease: EASE.out }}
      className="flex items-baseline justify-between gap-4 border-b border-cyan/[0.07] py-1.5 last:border-b-0"
    >
      <span className="font-mono text-[0.58rem] tracking-[0.18em] text-cyan/45">{label}</span>
      <span
        className="text-right font-display text-[0.76rem] font-black tracking-[0.08em]"
        style={{ color }}
      >
        {value}
      </span>
    </motion.div>
  )
}

/** The 0 → 100 % sync bar from the mock-up, animated once on entry. */
function SyncBar() {
  const { calm } = useSystem()
  const [value, setValue] = useState(calm ? 100 : 0)

  useEffect(() => {
    if (calm) return
    let raf = 0
    const started = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 1600)
      // ease-out so it races up and settles rather than crawling
      setValue(Math.round((1 - (1 - t) ** 3) * 100))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [calm])

  const filled = Math.round((value / 100) * 24)

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[0.58rem] tracking-[0.18em] text-cyan/45">
          RONALJARVIS SYNC
        </span>
        <span className="font-display text-[0.76rem] font-black tabular-nums text-lime">
          {value}%
        </span>
      </div>
      <div className="flex gap-[2px]" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="h-3 flex-1"
            style={{
              background: i < filled ? '#8cff78' : 'rgba(53,230,255,0.12)',
              boxShadow: i < filled && i >= filled - 2 ? '0 0 6px rgba(140,255,120,0.7)' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Editing                                                                    */
/* -------------------------------------------------------------------------- */

const EDITABLE: Array<{ key: keyof Profile; label: string; numeric: boolean }> = [
  { key: 'home', label: 'Heimat', numeric: false },
  { key: 'club', label: 'Lieblingsverein', numeric: false },
  { key: 'currentGame', label: 'Aktuelles Spiel', numeric: false },
  { key: 'nextDestination', label: 'Nächstes Ziel', numeric: false },
  { key: 'moviesWatched', label: 'Filme gesehen', numeric: true },
  { key: 'seriesWatched', label: 'Serien gesehen', numeric: true },
  { key: 'bjkMatches', label: 'BJK-Spiele live', numeric: true },
  { key: 'trips', label: 'Reisen', numeric: true },
]

function ProfileEditor({ onClose }: { onClose: () => void }) {
  const { profile, patch, reset } = useProfile()
  const { cue } = useSystem()

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: EASE.out }}
      className="overflow-hidden"
    >
      <div className="grid grid-cols-1 gap-2 border-t border-cyan/12 pt-3 sm:grid-cols-2">
        {EDITABLE.map((field) => (
          <div key={field.key}>
            <label className="hud-label mb-1 block" htmlFor={`profile-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`profile-${field.key}`}
              value={String(profile[field.key])}
              type={field.numeric ? 'number' : 'text'}
              min={field.numeric ? 0 : undefined}
              onChange={(e) =>
                patch({
                  [field.key]: field.numeric ? Math.max(0, Number(e.target.value) || 0) : e.target.value,
                } as Partial<Profile>)
              }
              className="hud-input text-left text-[0.8rem]"
              style={{ letterSpacing: 'normal' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <HudButton small variant="primary" onClick={onClose}>
          Fertig
        </HudButton>
        <HudButton
          small
          variant="ghost"
          onClick={() => {
            reset()
            cue('deny')
          }}
        >
          Zurücksetzen
        </HudButton>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* View                                                                       */
/* -------------------------------------------------------------------------- */

export function ProfileView() {
  const { phase, settings } = useSystem()
  const { mode } = useHub()
  const { profile } = useProfile()
  const watchlist = useWatchlist()
  const { todos, open } = useTodos()
  const football = useSlice('football')
  const player = useSlice('player', Boolean(settings.fortniteApiKey && settings.epicName))
  const [editing, setEditing] = useState(false)

  const records = aimRecords()
  const sens = storedSens()
  const ownRow = football.data?.table.find((r) => isBesiktas(r.team)) ?? null
  const nextMatch = football.data?.next.find((f) => f.kickoff) ?? null
  const daysToFlight = Math.max(
    0,
    Math.ceil((TRIP.departure.getTime() - Date.now()) / 86_400_000),
  )
  const done = todos.length - open.length

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      {/* ------------------------------------------------------------ record */}
      <HoloCard
        index={0}
        tone="cyan"
        title="Ali Database"
        status={`SUBJECT // ${profile.callsign}`}
        className="lg:col-span-5"
        scan
      >
        <div className="space-y-0.5">
          <DataLine label="STATUS" value="ONLINE" tone="lime" delay={0.02} />
          <DataLine label="ACCESS LEVEL" value="BROTHER" tone="lime" delay={0.05} />
          <DataLine label="HOME" value={profile.home} delay={0.08} />
          <DataLine label="FAVORITE CLUB" value={`${profile.club} 🦅`} delay={0.11} />
          <DataLine label="CURRENT GAME" value={profile.currentGame} tone="violet" delay={0.14} />
          <DataLine
            label="NEXT DESTINATION"
            value={`${profile.nextDestination} 🇹🇷`}
            tone="amber"
            delay={0.17}
          />
          <DataLine label="MISSION PHASE" value={PHASE_LABEL[phase]} tone="amber" delay={0.2} />
          <DataLine
            label="MOVIES WATCHED"
            value={profile.moviesWatched.toLocaleString('de-DE')}
            delay={0.23}
          />
          <DataLine
            label="SERIES WATCHED"
            value={profile.seriesWatched.toLocaleString('de-DE')}
            delay={0.26}
          />
          <DataLine label="BJK MATCHES" value={String(profile.bjkMatches)} delay={0.29} />
          <DataLine label="TRIPS" value={String(profile.trips)} delay={0.32} />
        </div>

        <div className="mt-4 border-t border-cyan/12 pt-4">
          <SyncBar />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill tone="cyan">{MODE_SPEC[mode].label}</StatusPill>
          <HudButton small variant="ghost" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Bearbeiten schließen' : 'Daten bearbeiten'}
          </HudButton>
        </div>

        {editing && <ProfileEditor onClose={() => setEditing(false)} />}
      </HoloCard>

      {/* ----------------------------------------------------------- live ops */}
      <div className="grid auto-rows-min grid-cols-1 content-start gap-3 lg:col-span-7">
        <HoloCard index={1} tone="lime" title="Live aus den Modulen" status="AUTO">
          <p className="mb-3 text-[0.74rem] leading-relaxed text-ice/55">
            Was RonalJarvis selbst zählen kann, zählt er selbst — die Werte oben sind deine
            eigenen Angaben, die hier unten kommen live aus den Modulen.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: 'MERKLISTE', v: String(watchlist.entries.length), hint: 'Filme & Serien' },
              { k: 'ERINNERUNGEN', v: `${open.length}/${todos.length}`, hint: `${done} erledigt` },
              { k: 'BIS ABFLUG', v: `${daysToFlight} T`, hint: TRIP.flightNumber },
              {
                k: 'BJK PLATZ',
                v: ownRow ? String(ownRow.rank) : '—',
                hint: ownRow ? `${ownRow.points} Punkte` : 'Tabelle offline',
              },
            ].map((row) => (
              <div key={row.k} className="border border-lime/14 bg-lime/[0.04] px-2.5 py-2">
                <div className="hud-label text-[0.42rem]">{row.k}</div>
                <div className="font-display text-[1.1rem] font-black tabular-nums text-ice">
                  {row.v}
                </div>
                <div className="font-mono text-[0.46rem] tracking-[0.08em] text-lime/50">
                  {row.hint}
                </div>
              </div>
            ))}
          </div>

          {nextMatch && (
            <div className="mt-3 border-t border-lime/12 pt-3 text-[0.76rem] leading-relaxed text-ice/70">
              Nächstes Beşiktaş-Spiel: <span className="text-ice">{nextMatch.home}</span> vs{' '}
              <span className="text-ice">{nextMatch.away}</span>
              {nextMatch.kickoff
                ? ` am ${nextMatch.kickoff.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
                : ''}
              .
            </div>
          )}
        </HoloCard>

        {/* ------------------------------------------------------ gaming card */}
        <HoloCard index={2} tone="violet" title="Gaming-Profil" status="FORTNITE">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="border border-violet/14 bg-violet/[0.05] px-2.5 py-2">
              <div className="hud-label text-[0.42rem]">EPIC-NAME</div>
              <div className="truncate font-display text-[0.8rem] font-black text-ice">
                {settings.epicName ?? '—'}
              </div>
            </div>
            <div className="border border-violet/14 bg-violet/[0.05] px-2.5 py-2">
              <div className="hud-label text-[0.42rem]">SIEGE</div>
              <div className="font-display text-[1.1rem] font-black tabular-nums text-lime">
                {player.data?.overall ? player.data.overall.wins.toLocaleString('de-DE') : '—'}
              </div>
            </div>
            <div className="border border-violet/14 bg-violet/[0.05] px-2.5 py-2">
              <div className="hud-label text-[0.42rem]">K/D</div>
              <div className="font-display text-[1.1rem] font-black tabular-nums text-ice">
                {player.data?.overall ? player.data.overall.kd.toFixed(2) : '—'}
              </div>
            </div>
            <div className="border border-violet/14 bg-violet/[0.05] px-2.5 py-2">
              <div className="hud-label text-[0.42rem]">eDPI</div>
              <div className="font-display text-[1.1rem] font-black tabular-nums text-ice">
                {Math.round(eDPI(sens.dpi, sens.sens)).toLocaleString('de-DE')}
              </div>
              <div className="font-mono text-[0.46rem] text-violet/50">
                {cm360(sens.dpi, sens.sens).toFixed(1)} cm/360°
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-violet/12 pt-3">
            {DRILL_ORDER.map((drill) => (
              <div key={drill}>
                <div className="hud-label text-[0.42rem]">{drill.toUpperCase()} BEST</div>
                <div className="font-display text-[0.95rem] font-black tabular-nums text-violet">
                  {records[drill]?.score ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </HoloCard>

        {/* --------------------------------------------------------- location */}
        <HoloCard index={3} tone="amber" title="Reiseakte" status={PHASE_LABEL[phase]}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['ZIEL', `${DESTINATION.city}, ${DESTINATION.country}`],
              ['FLUG', TRIP.flightNumber],
              ['SITZ', `${TRIP.seat} · GATE ${TRIP.gate}`],
              [
                'ABFLUG',
                TRIP.departure.toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              ],
              [
                'RÜCKFLUG',
                TRIP.returnFlight.toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              ],
              ['DISTANZ', `${TRIP.distanceKm.toLocaleString('de-DE')} KM`],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="hud-label text-[0.42rem]">{k}</div>
                <div className="font-display text-[0.74rem] font-bold text-ice">{v}</div>
              </div>
            ))}
          </div>
        </HoloCard>
      </div>
    </div>
  )
}

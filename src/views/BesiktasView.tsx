import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useHub, useSlice } from '../state/DataHub'
import { CLUB, isBesiktas, type Fixture, type TableRow } from '../lib/football'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { StatusPill } from '../components/hud/Readout'

const WEEKDAY = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

function kickoffLabel(f: Fixture): string {
  if (!f.kickoff) return `${f.dateLabel} · Anstoß offen`
  const d = f.kickoff
  return `${WEEKDAY[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}. · ${d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function until(target: Date, now: number): string {
  const ms = target.getTime() - now
  if (ms <= 0) return 'LÄUFT / ANGEPFIFFEN'
  const mins = Math.floor(ms / 60_000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `IN ${days} TAG${days === 1 ? '' : 'EN'} ${hours} H`
  if (hours > 0) return `IN ${hours} H ${mins % 60} MIN`
  return `IN ${mins} MIN`
}

/** W / U / N from Beşiktaş's point of view. */
function outcome(f: Fixture): 'win' | 'draw' | 'loss' | null {
  if (!f.score) return null
  const own = f.atHome ? f.score.home : f.score.away
  const other = f.atHome ? f.score.away : f.score.home
  if (own > other) return 'win'
  if (own < other) return 'loss'
  return 'draw'
}

const OUTCOME_STYLE: Record<'win' | 'draw' | 'loss', { label: string; color: string }> = {
  win: { label: 'S', color: '#8cff78' },
  draw: { label: 'U', color: '#ffb54d' },
  loss: { label: 'N', color: '#ff525c' },
}

function FixtureRow({ fixture, now, index }: { fixture: Fixture; now: number; index: number }) {
  const result = outcome(fixture)
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.35, ease: EASE.out }}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-cyan/10 py-2 last:border-b-0"
    >
      <span
        className="w-14 shrink-0 border px-1 py-0.5 text-center font-display text-[0.46rem] font-black tracking-[0.12em]"
        style={{
          borderColor: fixture.atHome ? 'rgba(216,246,255,0.4)' : 'rgba(53,230,255,0.25)',
          color: fixture.atHome ? '#d8f6ff' : 'rgba(53,230,255,0.7)',
        }}
      >
        {fixture.atHome ? 'HEIM' : 'AUSWÄRTS'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[0.72rem] font-bold text-ice">
          {fixture.home} <span className="text-cyan/35">vs</span> {fixture.away}
        </div>
        <div className="font-mono text-[0.52rem] tracking-[0.1em] text-cyan/45">
          {kickoffLabel(fixture)}
          {fixture.competition ? ` · ${fixture.competition}` : ''}
        </div>
      </div>

      {result ? (
        <span
          className="shrink-0 font-display text-[0.8rem] font-black tabular-nums"
          style={{ color: OUTCOME_STYLE[result].color }}
        >
          {fixture.score?.home}:{fixture.score?.away}
        </span>
      ) : fixture.kickoff ? (
        <span className="shrink-0 font-mono text-[0.55rem] tracking-[0.1em] text-amber/75">
          {until(fixture.kickoff, now)}
        </span>
      ) : null}
    </motion.div>
  )
}

function LeagueTable({ rows }: { rows: TableRow[] }) {
  const [full, setFull] = useState(false)
  const ownIndex = rows.findIndex((r) => isBesiktas(r.team))
  // Without expanding, show the top of the table plus Beşiktaş's neighbourhood —
  // the two things anyone actually opens a table for.
  const shown = full
    ? rows
    : rows.filter((_, i) => i < 6 || (ownIndex >= 0 && Math.abs(i - ownIndex) <= 1))

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-cyan/15 font-mono text-[0.48rem] tracking-[0.14em] text-cyan/45">
              <th className="py-1.5 pr-2 font-normal">#</th>
              <th className="py-1.5 pr-2 font-normal">VEREIN</th>
              <th className="py-1.5 pr-2 text-right font-normal">SP</th>
              <th className="py-1.5 pr-2 text-right font-normal">S</th>
              <th className="py-1.5 pr-2 text-right font-normal">U</th>
              <th className="py-1.5 pr-2 text-right font-normal">N</th>
              <th className="py-1.5 pr-2 text-right font-normal">TORE</th>
              <th className="py-1.5 pr-2 text-right font-normal">DIFF</th>
              <th className="py-1.5 text-right font-normal">PKT</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => {
              const own = isBesiktas(row.team)
              const gap = i > 0 && shown[i - 1].rank < row.rank - 1
              return (
                <tr
                  key={row.team + row.rank}
                  className="border-b border-cyan/[0.06] last:border-b-0"
                  style={{
                    background: own ? 'rgba(216,246,255,0.07)' : undefined,
                    borderTop: gap ? '1px dashed rgba(53,230,255,0.2)' : undefined,
                  }}
                >
                  <td className="py-1.5 pr-2 font-mono text-[0.62rem] tabular-nums text-cyan/55">
                    {row.rank}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span
                      className="font-display text-[0.66rem] font-bold"
                      style={{ color: own ? '#ffffff' : 'rgba(216,246,255,0.8)' }}
                    >
                      {own ? `${CLUB.crest} ` : ''}
                      {row.team}
                    </span>
                  </td>
                  {[row.played, row.win, row.draw, row.loss].map((v, j) => (
                    <td
                      key={j}
                      className="py-1.5 pr-2 text-right font-mono text-[0.62rem] tabular-nums text-ice/65"
                    >
                      {v}
                    </td>
                  ))}
                  <td className="py-1.5 pr-2 text-right font-mono text-[0.62rem] tabular-nums text-ice/55">
                    {row.goalsFor}:{row.goalsAgainst}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-[0.62rem] tabular-nums text-cyan/55">
                    {row.diff > 0 ? `+${row.diff}` : row.diff}
                  </td>
                  <td className="py-1.5 text-right font-display text-[0.72rem] font-black tabular-nums text-lime">
                    {row.points}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > shown.length && (
        <button
          type="button"
          onClick={() => setFull(true)}
          className="mt-2 font-mono text-[0.55rem] tracking-[0.14em] text-cyan/50 hover:text-cyan"
        >
          GANZE TABELLE ANZEIGEN ({rows.length} VEREINE)
        </button>
      )}
      {full && (
        <button
          type="button"
          onClick={() => setFull(false)}
          className="mt-2 font-mono text-[0.55rem] tracking-[0.14em] text-cyan/50 hover:text-cyan"
        >
          EINKLAPPEN
        </button>
      )}
    </div>
  )
}

export function BesiktasView() {
  const { calm } = useSystem()
  const { refresh } = useHub()
  const slice = useSlice('football')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const data = slice.data
  const next = data?.next ?? []
  const last = data?.last ?? []
  const table = data?.table ?? []
  const nextMatch = next.find((f) => f.kickoff) ?? next[0] ?? null
  const ownRow = table.find((r) => isBesiktas(r.team)) ?? null
  const form = last.slice(0, 5).map(outcome).filter((o): o is 'win' | 'draw' | 'loss' => o !== null)

  const loading = slice.status === 'loading' || slice.status === 'idle'

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      {/* ---------------------------------------------------------- overview */}
      <HoloCard
        index={0}
        tone="cyan"
        title="Beşiktaş JK"
        status={ownRow ? `PLATZ ${ownRow.rank}` : loading ? 'LADE...' : 'KARA KARTALLAR'}
        className="lg:col-span-4"
        scan
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <motion.span
              className="text-3xl"
              animate={calm ? undefined : { y: [0, -3, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            >
              {CLUB.crest}
            </motion.span>
            <div className="min-w-0">
              <div className="font-display text-[0.95rem] font-black tracking-[0.08em] text-ice">
                {CLUB.name}
              </div>
              <div className="font-mono text-[0.55rem] tracking-[0.14em] text-cyan/45">
                {CLUB.nickname} · {data?.team?.league ?? 'Süper Lig'}
              </div>
            </div>
          </div>

          {ownRow && (
            <div className="grid grid-cols-4 gap-1.5 border-t border-cyan/12 pt-3">
              {[
                ['PLATZ', String(ownRow.rank)],
                ['PUNKTE', String(ownRow.points)],
                ['SPIELE', String(ownRow.played)],
                ['DIFF', ownRow.diff > 0 ? `+${ownRow.diff}` : String(ownRow.diff)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="hud-label text-[0.42rem]">{k}</div>
                  <div className="font-display text-[1rem] font-black tabular-nums text-ice">{v}</div>
                </div>
              ))}
            </div>
          )}

          {form.length > 0 && (
            <div className="border-t border-cyan/12 pt-3">
              <div className="hud-label mb-1.5">Form · letzte {form.length}</div>
              <div className="flex gap-1">
                {form.map((o, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    className="flex h-5 w-5 items-center justify-center border font-display text-[0.55rem] font-black"
                    style={{
                      borderColor: `${OUTCOME_STYLE[o].color}66`,
                      color: OUTCOME_STYLE[o].color,
                      background: `${OUTCOME_STYLE[o].color}18`,
                    }}
                  >
                    {OUTCOME_STYLE[o].label}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {nextMatch && (
            <div className="border-t border-cyan/12 pt-3">
              <div className="hud-label mb-1">Nächstes Spiel</div>
              <div className="font-display text-[0.78rem] font-bold text-ice">
                {nextMatch.home} <span className="text-cyan/35">vs</span> {nextMatch.away}
              </div>
              <div className="mt-1 font-mono text-[0.55rem] tracking-[0.1em] text-cyan/50">
                {kickoffLabel(nextMatch)}
              </div>
              {nextMatch.kickoff && (
                <div className="mt-2">
                  <StatusPill tone="amber" pulse>
                    {until(nextMatch.kickoff, now)}
                  </StatusPill>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-cyan/12 pt-3">
            <HudButton small variant="ghost" busy={loading} onClick={() => void refresh('football')}>
              Aktualisieren
            </HudButton>
            <span className="font-mono text-[0.5rem] tracking-[0.12em] text-cyan/30">
              QUELLE: THESPORTSDB
            </span>
          </div>
        </div>
      </HoloCard>

      {/* ---------------------------------------------------------- fixtures */}
      <HoloCard
        index={1}
        tone="amber"
        title="Anstehende Spiele"
        status={loading ? 'LADE...' : `${next.length}`}
        className="lg:col-span-8"
      >
        {loading ? (
          <div className="flex items-center gap-3 py-6">
            <motion.div
              className="h-5 w-5 rounded-full border border-amber/25 border-t-amber"
              animate={calm ? undefined : { rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span className="font-mono text-[0.55rem] tracking-[0.18em] text-cyan/45">
              SPIELPLAN WIRD GELADEN...
            </span>
          </div>
        ) : slice.status === 'error' ? (
          <div className="py-4">
            <p className="text-[0.8rem] leading-relaxed text-ice/70">{slice.error}</p>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-cyan/45">
              Der Spielplan kommt von thesportsdb.com. Wenn die freie Schnittstelle gerade
              ausgelastet ist, hilft ein eigener Schlüssel in den Einstellungen — oder es später
              nochmal versuchen.
            </p>
            <div className="mt-3">
              <HudButton variant="ghost" onClick={() => void refresh('football')}>
                Erneut versuchen
              </HudButton>
            </div>
          </div>
        ) : next.length === 0 ? (
          <p className="py-4 text-[0.78rem] leading-relaxed text-ice/55">
            Für {CLUB.name} sind aktuell keine Spiele angesetzt — vermutlich Länderspielpause
            oder Saisonende.
          </p>
        ) : (
          <div>
            {next.map((f, i) => (
              <FixtureRow key={f.id} fixture={f} now={now} index={i} />
            ))}
          </div>
        )}

        {data?.notes.length ? (
          <p className="mt-3 border-t border-amber/12 pt-2 font-mono text-[0.52rem] leading-relaxed text-amber/50">
            {data.notes.join(' · ')}
          </p>
        ) : null}
      </HoloCard>

      {/* ------------------------------------------------------------- table */}
      <HoloCard
        index={2}
        tone="lime"
        title="Süper Lig Tabelle"
        status={data?.season ?? '—'}
        className="lg:col-span-8"
      >
        {table.length === 0 ? (
          <p className="py-4 text-[0.78rem] leading-relaxed text-ice/55">
            {loading
              ? 'Tabelle wird geladen...'
              : 'Für diese Saison liegt noch keine Tabelle vor.'}
          </p>
        ) : (
          <LeagueTable rows={table} />
        )}
      </HoloCard>

      {/* ----------------------------------------------------------- results */}
      <HoloCard
        index={3}
        tone="violet"
        title="Letzte Ergebnisse"
        status={`${last.length}`}
        className="lg:col-span-4"
      >
        {last.length === 0 ? (
          <p className="py-4 text-[0.78rem] leading-relaxed text-ice/55">
            {loading ? 'Ergebnisse werden geladen...' : 'Keine Ergebnisse hinterlegt.'}
          </p>
        ) : (
          <div>
            {last.slice(0, 6).map((f, i) => (
              <FixtureRow key={f.id} fixture={f} now={now} index={i} />
            ))}
          </div>
        )}
      </HoloCard>
    </div>
  )
}

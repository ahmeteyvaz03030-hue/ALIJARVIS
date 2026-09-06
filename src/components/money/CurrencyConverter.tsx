import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import {
  QUICK_EUR,
  cachedRate,
  eurToTry,
  fetchRate,
  formatEur,
  formatTry,
  parseAmount,
  saveManualRate,
  tryToEur,
  type FxRate,
} from '../../lib/currency'
import { EASE } from '../../lib/motion'
import { HoloCard } from '../hud/HoloCard'
import { HudButton } from '../hud/HudButton'
import { StatusPill } from '../hud/Readout'

const round2 = (n: number) => Math.round(n * 100) / 100
const toField = (n: number) => (Number.isFinite(n) ? round2(n).toString().replace('.', ',') : '')

/**
 * Both fields are live and both are editable — type Euro and the Lira field
 * follows, type Lira and the Euro field follows. Whichever the operator last
 * touched is the source of truth, so the number under the cursor never jumps.
 */
export function CurrencyConverter({ index = 0, className }: { index?: number; className?: string }) {
  const { cue, pushLog } = useSystem()
  const [rate, setRate] = useState<FxRate | null>(() => cachedRate())
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [eur, setEur] = useState('100')
  const [lira, setLira] = useState('')
  const [manual, setManual] = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchRate().then((result) => {
      if (cancelled) return
      setLoading(false)
      setRate(result.rate)
      setNotice(result.ok ? null : result.message)
      if (result.ok) pushLog(`Wechselkurs geladen: 1 € = ${result.rate.tryPerEur.toFixed(2)} ₺`, 'ok')
    })
    return () => {
      cancelled = true
    }
  }, [pushLog])

  const value = rate?.tryPerEur ?? 0

  // Seed the Lira field once a rate exists, without stomping on typed input.
  useEffect(() => {
    if (!value) return
    setLira((prev) => {
      if (prev) return prev
      const parsed = parseAmount(eur)
      return parsed === null ? '' : toField(eurToTry(parsed, value))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const onEur = (next: string) => {
    setEur(next)
    const parsed = parseAmount(next)
    setLira(parsed === null || !value ? '' : toField(eurToTry(parsed, value)))
  }

  const onLira = (next: string) => {
    setLira(next)
    const parsed = parseAmount(next)
    setEur(parsed === null || !value ? '' : toField(tryToEur(parsed, value)))
  }

  const applyManual = () => {
    const parsed = parseAmount(manual)
    if (parsed === null || parsed <= 0) {
      cue('deny')
      return
    }
    const saved = saveManualRate(parsed)
    setRate(saved)
    setNotice(null)
    setShowManual(false)
    cue('confirm')
    pushLog(`Wechselkurs manuell gesetzt: 1 € = ${parsed.toFixed(2)} ₺`, 'warn')
    const parsedEur = parseAmount(eur)
    setLira(parsedEur === null ? '' : toField(eurToTry(parsedEur, parsed)))
  }

  const sourceLabel =
    rate?.source === 'live'
      ? { tone: 'lime' as const, text: `EZB-KURS ${rate.date}` }
      : rate?.source === 'manual'
        ? { tone: 'amber' as const, text: 'MANUELLER KURS' }
        : rate
          ? { tone: 'amber' as const, text: `GESPEICHERT ${rate.date}` }
          : { tone: 'cyan' as const, text: 'LADE...' }

  return (
    <HoloCard
      index={index}
      tone="lime"
      title="Währungsrechner"
      status="EUR ⇄ TRY"
      className={className}
    >
      {/* the two fields ------------------------------------------------- */}
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <label className="hud-label mb-1.5 block" htmlFor="fx-eur">
            Euro
          </label>
          <div className="relative">
            <input
              id="fx-eur"
              value={eur}
              onChange={(e) => onEur(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className="hud-input pr-8 text-left text-[1rem] tabular-nums"
              style={{ letterSpacing: 'normal' }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-display text-[0.85rem] font-bold text-lime/70">
              €
            </span>
          </div>
        </div>

        <motion.div
          className="hidden justify-center pb-2.5 font-display text-[0.9rem] font-black text-cyan/50 sm:flex"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE.out }}
          aria-hidden="true"
        >
          ⇄
        </motion.div>

        <div>
          <label className="hud-label mb-1.5 block" htmlFor="fx-try">
            Türkische Lira
          </label>
          <div className="relative">
            <input
              id="fx-try"
              value={lira}
              onChange={(e) => onLira(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className="hud-input pr-8 text-left text-[1rem] tabular-nums"
              style={{ letterSpacing: 'normal' }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-display text-[0.85rem] font-bold text-amber/70">
              ₺
            </span>
          </div>
        </div>
      </div>

      {/* quick amounts --------------------------------------------------- */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK_EUR.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => {
              cue('nav')
              onEur(String(amount))
            }}
            className="border border-lime/20 bg-lime/[0.04] px-2 py-0.5 font-mono text-[0.58rem] tabular-nums tracking-[0.1em] text-lime/75 transition-colors hover:border-lime/50 hover:text-lime"
          >
            {amount} €
          </button>
        ))}
      </div>

      {/* rate line ------------------------------------------------------- */}
      <div className="mt-4 space-y-2 border-t border-lime/12 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={sourceLabel.tone}>{sourceLabel.text}</StatusPill>
          <span className="font-mono text-[0.6rem] tabular-nums tracking-[0.12em] text-cyan/55">
            {loading && !rate
              ? 'KURS WIRD GELADEN...'
              : `1 € = ${value.toFixed(2)} ₺ · 1 ₺ = ${value ? (1 / value).toFixed(4) : '—'} €`}
          </span>
          <button
            type="button"
            onClick={() => setShowManual((s) => !s)}
            className="ml-auto font-mono text-[0.55rem] tracking-[0.14em] text-cyan/45 hover:text-cyan"
          >
            {showManual ? 'ABBRECHEN' : 'KURS SELBST SETZEN'}
          </button>
        </div>

        {notice && (
          <p className="border-l-2 border-amber/50 pl-2.5 text-[0.68rem] leading-relaxed text-amber/70">
            {notice}
          </p>
        )}

        {showManual && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE.out }}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="flex-1">
              <label className="hud-label mb-1 block" htmlFor="fx-manual">
                Eigener Kurs — Lira pro Euro
              </label>
              <input
                id="fx-manual"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                inputMode="decimal"
                placeholder={value ? value.toFixed(2) : '47,00'}
                className="hud-input text-left text-[0.85rem] tabular-nums"
                style={{ letterSpacing: 'normal' }}
              />
            </div>
            <HudButton small variant="primary" onClick={applyManual}>
              Übernehmen
            </HudButton>
          </motion.div>
        )}

        {/* a small table so a price tag can be read at a glance */}
        {value > 0 && (
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 pt-1 font-mono text-[0.58rem] tabular-nums text-cyan/45">
            {[1, 5, 10, 20, 50, 100].map((lirasAmount) => (
              <span key={lirasAmount}>
                {formatTry(lirasAmount * 10)} ≈ {formatEur(tryToEur(lirasAmount * 10, value))}
              </span>
            ))}
          </div>
        )}
      </div>
    </HoloCard>
  )
}

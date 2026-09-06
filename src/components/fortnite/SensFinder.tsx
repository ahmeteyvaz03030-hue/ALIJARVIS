import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import {
  BANDS,
  PRESETS,
  bandFor,
  cm360,
  eDPI,
  inches360,
  judgeFlicks,
  sensForCm360,
  type FlickSample,
  type FlickVerdict,
} from '../../lib/sensitivity'
import { HudButton } from '../hud/HudButton'
import { StatusPill } from '../hud/Readout'

const STORAGE_KEY = 'ronaljarvis.sens.v1'

interface SensConfig {
  dpi: number
  sens: number
  ads: number
  scope: number
}

const DEFAULTS: SensConfig = { dpi: 800, sens: 7, ads: 55, scope: 45 }

function loadConfig(): SensConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SensConfig>) }
  } catch {
    return DEFAULTS
  }
}

function saveConfig(config: SensConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* storage unavailable */
  }
}

/** Read the stored sensitivity without mounting the panel. */
export function storedSens(): SensConfig {
  return loadConfig()
}

const TONE_HEX: Record<string, string> = {
  danger: '#ff525c',
  amber: '#ffb54d',
  lime: '#8cff78',
  cyan: '#35e6ff',
  violet: '#a97bff',
}

function NumberField({
  id,
  label,
  suffix,
  value,
  step = 0.1,
  min = 0,
  onChange,
}: {
  id: string
  label: string
  suffix: string
  value: number
  step?: number
  min?: number
  onChange: (next: number) => void
}) {
  return (
    <div>
      <label className="hud-label mb-1 block" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="hud-input pr-10 text-left text-[0.9rem] tabular-nums"
          style={{ letterSpacing: 'normal' }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.55rem] tracking-[0.1em] text-cyan/45">
          {suffix}
        </span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Flick calibration                                                          */
/* -------------------------------------------------------------------------- */

const ROUNDS = 12

/**
 * Measures the one thing a browser honestly can: whether flicks land past the
 * target or short of it. It cannot know the desk, the pad or the game — so it
 * reports a tendency and a percentage to nudge, never an absolute sensitivity.
 */
function FlickCalibration({ onSuggestion }: { onSuggestion: (percent: number) => void }) {
  const { cue } = useSystem()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [running, setRunning] = useState(false)
  const [samples, setSamples] = useState<FlickSample[]>([])
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const [verdict, setVerdict] = useState<FlickVerdict | null>(null)

  const place = useCallback((from: { x: number; y: number }) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const pad = 34
    // Push the target well away from the crosshair so the shot is a flick and
    // not a nudge — a 20 px correction says nothing about sensitivity.
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = pad + Math.random() * (rect.width - pad * 2)
      const y = pad + Math.random() * (rect.height - pad * 2)
      const d = Math.hypot(x - from.x, y - from.y)
      if (d > Math.min(rect.width, rect.height) * 0.42) {
        setTarget({ x, y })
        return
      }
    }
    setTarget({ x: rect.width / 2, y: rect.height / 2 })
  }, [])

  const start = () => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const centre = { x: rect.width / 2, y: rect.height / 2 }
    setSamples([])
    setVerdict(null)
    setOrigin(centre)
    setRunning(true)
    place(centre)
    cue('process')
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!running || !target || !origin) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Project the shot onto the line from the crosshair to the target: how far
    // along that line it landed is exactly the over/undershoot.
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance < 1) return
    const along = ((x - origin.x) * dx + (y - origin.y) * dy) / distance
    const overshoot = along - distance

    const next = [...samples, { distance, overshoot }]
    setSamples(next)
    cue(Math.abs(overshoot) < 26 ? 'panel' : 'deny')

    if (next.length >= ROUNDS) {
      setRunning(false)
      setTarget(null)
      setVerdict(judgeFlicks(next))
      cue('confirm')
      return
    }
    setOrigin({ x: target.x, y: target.y })
    place(target)
  }

  const progress = samples.length / ROUNDS

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="hud-label">Flick-Kalibrierung</span>
        <span className="font-mono text-[0.55rem] tabular-nums tracking-[0.12em] text-cyan/45">
          {samples.length} / {ROUNDS}
        </span>
      </div>

      <div
        ref={wrapRef}
        onClick={onClick}
        className="relative h-52 w-full overflow-hidden border border-violet/20 bg-void/70"
        style={{ cursor: running ? 'crosshair' : 'default' }}
      >
        {/* crosshair the flick starts from */}
        {origin && running && (
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 border border-amber/70"
            style={{ left: origin.x, top: origin.y, borderRadius: '50%' }}
          />
        )}

        {target && running && (
          <motion.span
            key={`${target.x}-${target.y}`}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ice bg-lime/70"
            style={{ left: target.x, top: target.y }}
          />
        )}

        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-void/60 px-4 text-center">
            {verdict ? (
              <>
                <div
                  className="font-display text-[0.78rem] font-black tracking-[0.06em]"
                  style={{ color: verdict.suggestion === 0 ? '#8cff78' : '#ffb54d' }}
                >
                  {verdict.headline}
                </div>
                <p className="max-w-md text-[0.72rem] leading-relaxed text-ice/65">
                  {verdict.detail}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {verdict.suggestion !== 0 && (
                    <HudButton small variant="primary" onClick={() => onSuggestion(verdict.suggestion)}>
                      Übernehmen
                    </HudButton>
                  )}
                  <HudButton small variant="ghost" onClick={start}>
                    Nochmal messen
                  </HudButton>
                </div>
              </>
            ) : (
              <>
                <p className="max-w-md text-[0.72rem] leading-relaxed text-ice/60">
                  {ROUNDS} Flicks. Vom Ring aus so schnell wie möglich auf den grünen Punkt
                  klicken — nicht korrigieren, der erste Zug zählt. RonalJarvis misst, ob du im
                  Schnitt über das Ziel hinausziehst oder davor stehen bleibst.
                </p>
                <HudButton small variant="primary" onClick={start}>
                  Messung starten
                </HudButton>
              </>
            )}
          </div>
        )}
      </div>

      <div className="h-1 w-full bg-cyan/10">
        <motion.div
          className="h-full bg-violet"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.25, ease: EASE.out }}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function SensFinder() {
  const { cue, pushLog } = useSystem()
  const [config, setConfig] = useState<SensConfig>(loadConfig)
  const [targetCm, setTargetCm] = useState(32)

  useEffect(() => {
    saveConfig(config)
  }, [config])

  const patch = (changes: Partial<SensConfig>) => setConfig((prev) => ({ ...prev, ...changes }))

  const cm = cm360(config.dpi, config.sens)
  const band = bandFor(cm)
  const edpi = eDPI(config.dpi, config.sens)
  const suggestedSens = sensForCm360(config.dpi, targetCm)

  const applySuggestion = (percent: number) => {
    const next = Math.max(0.5, Math.round(config.sens * (1 + percent / 100) * 100) / 100)
    patch({ sens: next })
    cue('confirm')
    pushLog(`Sensitivität angepasst: ${config.sens} % → ${next} %`, 'ok')
  }

  return (
    <div className="space-y-4">
      {/* inputs ---------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumberField
          id="sens-dpi"
          label="Maus-DPI"
          suffix="DPI"
          step={50}
          min={100}
          value={config.dpi}
          onChange={(v) => patch({ dpi: v })}
        />
        <NumberField
          id="sens-x"
          label="Sensitivität X/Y"
          suffix="%"
          value={config.sens}
          onChange={(v) => patch({ sens: v })}
        />
        <NumberField
          id="sens-ads"
          label="Zielen (ADS)"
          suffix="%"
          value={config.ads}
          onChange={(v) => patch({ ads: v })}
        />
        <NumberField
          id="sens-scope"
          label="Zielfernrohr"
          suffix="%"
          value={config.scope}
          onChange={(v) => patch({ scope: v })}
        />
      </div>

      {/* readouts -------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: 'eDPI', v: Math.round(edpi).toLocaleString('de-DE'), hint: 'DPI × Sens' },
          { k: 'CM / 360°', v: cm ? cm.toFixed(1) : '—', hint: 'volle Drehung' },
          { k: 'ZOLL / 360°', v: cm ? inches360(config.dpi, config.sens).toFixed(1) : '—', hint: 'gleiche Strecke' },
          {
            k: 'ADS EFFEKTIV',
            v: cm ? (cm / (config.ads / 100 || 1)).toFixed(1) : '—',
            hint: 'cm/360 beim Zielen',
          },
        ].map((row) => (
          <div key={row.k} className="border border-cyan/12 bg-cyan/[0.03] px-2.5 py-2">
            <div className="hud-label text-[0.44rem]">{row.k}</div>
            <div className="font-display text-[1.05rem] font-black tabular-nums text-ice">{row.v}</div>
            <div className="font-mono text-[0.46rem] tracking-[0.08em] text-cyan/35">{row.hint}</div>
          </div>
        ))}
      </div>

      {/* band ------------------------------------------------------------ */}
      <div className="space-y-2 border-t border-violet/12 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={band.tone}>{band.label}</StatusPill>
          <span className="text-[0.74rem] leading-relaxed text-ice/65">{band.blurb}</span>
        </div>

        {/* where the current setting sits on the scale */}
        <div className="relative h-7">
          <div className="absolute inset-x-0 top-3 flex h-1.5 overflow-hidden">
            {BANDS.map((b) => (
              <span
                key={b.id}
                className="h-full"
                style={{
                  flex: b.to === Infinity ? 1.2 : b.to - b.from,
                  background: TONE_HEX[b.tone],
                  opacity: b.id === band.id ? 0.85 : 0.22,
                }}
              />
            ))}
          </div>
          {cm > 0 && (
            <motion.span
              className="absolute top-1 h-5 w-[3px] bg-ice shadow-[0_0_8px_rgba(216,246,255,0.9)]"
              animate={{ left: `${Math.min(98, (Math.min(cm, 60) / 60) * 100)}%` }}
              transition={{ duration: 0.35, ease: EASE.out }}
            />
          )}
        </div>
        <div className="flex justify-between font-mono text-[0.46rem] tracking-[0.1em] text-cyan/30">
          <span>0 CM</span>
          <span>30 CM</span>
          <span>60 CM+</span>
        </div>
      </div>

      {/* dpi converter ---------------------------------------------------- */}
      <div className="space-y-2 border-t border-violet/12 pt-3">
        <div className="hud-label">Zielwert umrechnen</div>
        <p className="text-[0.72rem] leading-relaxed text-ice/60">
          Wenn du eine bestimmte Armbewegung pro Drehung willst — oder die DPI wechselst —
          rechnet RonalJarvis die passende In-Game-Sensitivität aus.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <NumberField
              id="sens-target"
              label="Wunsch cm / 360°"
              suffix="CM"
              step={0.5}
              min={5}
              value={targetCm}
              onChange={setTargetCm}
            />
          </div>
          <div className="pb-1.5">
            <div className="hud-label mb-0.5">Ergibt bei {config.dpi} DPI</div>
            <div className="font-display text-[1.05rem] font-black tabular-nums text-lime">
              {suggestedSens > 0 ? `${suggestedSens.toFixed(2)} %` : '—'}
            </div>
          </div>
          <HudButton
            small
            variant="ghost"
            onClick={() => {
              patch({ sens: Math.round(suggestedSens * 100) / 100 })
              cue('confirm')
            }}
          >
            Übernehmen
          </HudButton>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                patch({ dpi: preset.dpi, sens: preset.sens })
                cue('nav')
              }}
              className="border border-violet/20 bg-violet/[0.05] px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.08em] text-violet/75 transition-colors hover:border-violet/50 hover:text-violet"
            >
              {preset.name} · {preset.dpi}/{preset.sens}
            </button>
          ))}
        </div>
      </div>

      {/* calibration ------------------------------------------------------ */}
      <div className="border-t border-violet/12 pt-3">
        <FlickCalibration onSuggestion={applySuggestion} />
        <p className="mt-2 font-mono text-[0.5rem] leading-relaxed text-cyan/30">
          Die Messung läuft im Browser und kennt weder dein Mauspad noch die Spieleinstellung —
          sie erkennt, ob du systematisch über das Ziel hinausziehst, und schlägt daraus eine
          prozentuale Korrektur vor. Die endgültige Feinabstimmung passiert im Spiel.
        </p>
      </div>
    </div>
  )
}

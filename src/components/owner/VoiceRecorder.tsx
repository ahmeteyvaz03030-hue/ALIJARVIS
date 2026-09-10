import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { HudButton } from '../hud/HudButton'

/** Long enough for a proper message, short enough to travel in a link. */
const MAX_SECONDS = 45

type Phase = 'idle' | 'recording' | 'done' | 'denied' | 'unsupported'

/**
 * Records the owner's actual voice and hands it back as a data: URL.
 *
 * This is the honest answer to "can RonalJarvis talk in my voice": a
 * synthesiser cannot become someone, but a recording *is* them. The clip
 * travels inside the message, so Ali hears Ahmet, not an imitation.
 */
export function VoiceRecorder({
  value,
  onChange,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const { cue } = useSystem()
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef(0)
  const rafRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const cleanup = useCallback(() => {
    window.clearInterval(timerRef.current)
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const start = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setPhase('denied')
      cue('deny')
      return
    }
    streamRef.current = stream

    // A live level meter, so it is obvious the microphone is actually open.
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = ctx
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        rafRef.current = requestAnimationFrame(tick)
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
        setLevel(Math.min(1, peak / 60))
      }
      tick()
    } catch {
      /* the meter is decoration — recording still works without it */
    }

    // Opus in WebM where available; Safari falls back to its own default.
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
      (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
    )
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined,
    )
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      cleanup()
      setLevel(0)
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const reader = new FileReader()
      reader.onload = () => {
        onChange(typeof reader.result === 'string' ? reader.result : null)
        setPhase('done')
        cue('confirm')
      }
      reader.readAsDataURL(blob)
    }

    recorder.start()
    recorderRef.current = recorder
    setPhase('recording')
    setSeconds(0)
    cue('process')
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop()
        return s + 1
      })
    }, 1000)
  }

  const sizeKb = value ? Math.round((value.length * 3) / 4 / 1024) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="hud-label">Sprachnachricht — deine echte Stimme</span>
        {phase === 'recording' && (
          <span className="font-mono text-[0.58rem] tabular-nums text-danger">
            ● {seconds}s / {MAX_SECONDS}s
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {phase === 'recording' ? (
          <HudButton small variant="danger" onClick={stop}>
            Aufnahme stoppen
          </HudButton>
        ) : (
          <HudButton small variant="ghost" onClick={() => void start()}>
            {value ? 'Neu aufnehmen' : 'Aufnehmen'}
          </HudButton>
        )}
        {value && phase !== 'recording' && (
          <>
            <audio src={value} controls className="h-8 max-w-[16rem] flex-1" />
            <HudButton
              small
              variant="ghost"
              onClick={() => {
                onChange(null)
                setPhase('idle')
              }}
            >
              Entfernen
            </HudButton>
          </>
        )}
      </div>

      {phase === 'recording' && (
        <div className="flex h-6 items-end gap-[2px]">
          {Array.from({ length: 40 }, (_, i) => (
            <motion.span
              key={i}
              className="flex-1 bg-danger/70"
              animate={{ height: 3 + level * 20 * (0.4 + ((i * 13) % 10) / 10) }}
              transition={{ duration: 0.08 }}
            />
          ))}
        </div>
      )}

      {phase === 'denied' && (
        <p className="text-[0.7rem] leading-relaxed text-danger/80">
          Der Browser hat kein Mikrofon freigegeben. In den Seiteneinstellungen erlauben und
          nochmal versuchen.
        </p>
      )}
      {phase === 'unsupported' && (
        <p className="text-[0.7rem] leading-relaxed text-amber/80">
          Dieser Browser kann nicht aufnehmen. Über HTTPS klappt es in Chrome, Firefox und Safari.
        </p>
      )}
      {value && (
        <p className="font-mono text-[0.5rem] leading-relaxed text-cyan/35">
          {sizeKb} KB · reist mit der Nachricht mit. Über ~200 KB wird der Teilen-Link für
          manche Messenger zu lang — dann lieber über comms.json schicken.
        </p>
      )}
    </div>
  )
}

/**
 * Tiny WebAudio synth for the interface sounds. No audio assets are shipped —
 * every blip is generated, so the whole layer costs a few hundred bytes and is
 * silent until the operator enables it.
 */

export type Cue =
  | 'key'
  | 'boot-line'
  | 'scan'
  | 'confirm'
  | 'deny'
  | 'unlock'
  | 'panel'
  | 'nav'
  | 'notify'
  | 'process'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = false
let noiseBuffer: AudioBuffer | null = null

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.16
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
  return ctx
}

function getNoise(context: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer
  const length = Math.floor(context.sampleRate * 0.6)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

export function setAudioEnabled(next: boolean): void {
  enabled = next
  if (!next) return
  const context = ensureContext()
  void context?.resume()
}

export function isAudioEnabled(): boolean {
  return enabled
}

interface ToneOptions {
  freq: number
  to?: number
  dur: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

function tone(context: AudioContext, o: ToneOptions): void {
  const t0 = context.currentTime + (o.delay ?? 0)
  const osc = context.createOscillator()
  const g = context.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.to && o.to !== o.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur)
  }
  const peak = o.gain ?? 0.5
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, o.dur * 0.3))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(g)
  g.connect(master!)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.02)
}

function sweep(context: AudioContext, dur: number, gain = 0.22): void {
  const t0 = context.currentTime
  const src = context.createBufferSource()
  src.buffer = getNoise(context)
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(320, t0)
  filter.frequency.exponentialRampToValueAtTime(4200, t0 + dur)
  const g = context.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master!)
  src.start(t0)
  src.stop(t0 + dur + 0.05)
}

/** Fire an interface cue. No-ops entirely when sound is off. */
export function playCue(cue: Cue): void {
  if (!enabled) return
  const context = ensureContext()
  if (!context || !master) return
  if (context.state === 'suspended') void context.resume()

  switch (cue) {
    case 'key':
      tone(context, { freq: 1750, to: 1500, dur: 0.035, type: 'square', gain: 0.1 })
      break
    case 'boot-line':
      tone(context, { freq: 880, to: 1320, dur: 0.06, type: 'triangle', gain: 0.16 })
      break
    case 'scan':
      sweep(context, 0.75, 0.14)
      tone(context, { freq: 420, to: 900, dur: 0.7, type: 'sine', gain: 0.1 })
      break
    case 'confirm':
      tone(context, { freq: 660, dur: 0.1, type: 'sine', gain: 0.3 })
      tone(context, { freq: 990, dur: 0.14, type: 'sine', gain: 0.28, delay: 0.09 })
      tone(context, { freq: 1320, dur: 0.4, type: 'sine', gain: 0.22, delay: 0.19 })
      break
    case 'deny':
      tone(context, { freq: 220, to: 130, dur: 0.26, type: 'sawtooth', gain: 0.22 })
      break
    case 'unlock':
      sweep(context, 1.1, 0.1)
      tone(context, { freq: 130, to: 520, dur: 0.9, type: 'triangle', gain: 0.24 })
      tone(context, { freq: 1560, dur: 0.5, type: 'sine', gain: 0.14, delay: 0.5 })
      break
    case 'panel':
      tone(context, { freq: 1240, to: 1480, dur: 0.05, type: 'triangle', gain: 0.09 })
      break
    case 'nav':
      tone(context, { freq: 520, to: 780, dur: 0.09, type: 'triangle', gain: 0.14 })
      break
    case 'notify':
      tone(context, { freq: 1480, dur: 0.08, type: 'sine', gain: 0.2 })
      tone(context, { freq: 1980, dur: 0.16, type: 'sine', gain: 0.16, delay: 0.1 })
      break
    case 'process':
      tone(context, { freq: 340, to: 620, dur: 0.22, type: 'sine', gain: 0.12 })
      break
  }
}

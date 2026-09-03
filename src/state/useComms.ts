import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from './SystemProvider'

export interface CommMessage {
  id: number
  from: 'ali' | 'tony'
  text: string
  at: Date
}

/** Tony's side of the conversation — canned, but context-aware and warm. */
const TONY_OPENERS = [
  'Kardeşim! Alles klar bei dir? Ich zähle die Tage. 😎',
  'Ich hab die Karte vom Strandclub gecheckt — wir sind gesetzt.',
  'Sag mal, nehmen wir das Boot nach Turunç oder chillen wir in der Bucht?',
  'Der Wetterbericht sieht stabil aus. 33 Grad, kein Regen.',
  'Ich hab uns eine Liste mit Lokantas gemacht. Du wirst sie lieben.',
]

const TONY_REPLIES: Array<{ match: RegExp; reply: string }> = [
  { match: /(hallo|hi|selam|hey|moin)/i, reply: 'Selam Ali! Bin da. Was gibts? 🙌' },
  { match: /(wetter|warm|regen|sonne)/i, reply: 'Hier ist es traumhaft — 33 Grad und das Meer bei 27. Bring keine Jacke mit. 😄' },
  { match: /(flug|flight|ankunft|landung|abflug|airport|dalaman)/i, reply: 'Ich hol dich in Dalaman ab, keine Diskussion. Schick mir nur die Landezeit.' },
  { match: /(boot|strand|beach|bucht|meer|schwimmen)/i, reply: 'Boot ist gebucht. Wir starten früh, dann haben wir die Bucht für uns.' },
  { match: /(essen|lokanta|restaurant|hungrig|kebab|balık)/i, reply: 'Ich kenne einen Fischladen am Hafen. Vertrau mir einfach.' },
  { match: /(film|kino|movie|serie)/i, reply: 'Wenn du Filme mitbringst, machen wir Kinoabend auf der Terrasse.' },
  { match: /(danke|teşekkür|thx)/i, reply: 'Immer, Kardeşim. ❤️' },
]

function tonyRespond(text: string): string {
  for (const rule of TONY_REPLIES) {
    if (rule.match.test(text)) return rule.reply
  }
  return 'Verstanden. Ich kümmere mich drum — mach dir keinen Kopf. 👊'
}

export type CommsPhase = 'offline' | 'connecting' | 'active'

/**
 * Tony's private channel. Lives above the views so unread counts survive
 * navigation and the nav badge can pulse from anywhere.
 */
export function useComms() {
  const { cue, pushLog, calm } = useSystem()
  const [messages, setMessages] = useState<CommMessage[]>([])
  const [phase, setPhase] = useState<CommsPhase>('offline')
  const [unread, setUnread] = useState(0)
  const [tonyTyping, setTonyTyping] = useState(false)
  const idRef = useRef(0)
  const viewingRef = useRef(false)
  const timers = useRef<number[]>([])

  const push = useCallback((from: CommMessage['from'], text: string) => {
    setMessages((prev) => [
      ...prev.slice(-60),
      { id: ++idRef.current, from, text, at: new Date() },
    ])
  }, [])

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  /** Runs the CONNECTING → PRIVATE CHANNEL → SESSION ACTIVE handshake once. */
  const connect = useCallback(() => {
    if (phase !== 'offline') return
    setPhase('connecting')
    cue('process')
    pushLog('Opening private channel to Tony', 'info')
    timers.current.push(
      window.setTimeout(
        () => {
          setPhase('active')
          cue('confirm')
          pushLog('Tony channel — session active', 'ok')
          push('tony', TONY_OPENERS[Math.floor(Math.random() * TONY_OPENERS.length)])
        },
        calm ? 500 : 2600,
      ),
    )
  }, [calm, cue, phase, push, pushLog])

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      push('ali', trimmed)
      cue('key')
      setTonyTyping(true)
      timers.current.push(
        window.setTimeout(
          () => {
            setTonyTyping(false)
            push('tony', tonyRespond(trimmed))
            cue('notify')
            if (!viewingRef.current) setUnread((u) => u + 1)
          },
          calm ? 400 : 1100 + Math.random() * 1200,
        ),
      )
    },
    [calm, cue, push],
  )

  /** Ambient messages while Ali is elsewhere in the OS. */
  useEffect(() => {
    if (phase !== 'active') return
    let timer: number
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          if (!viewingRef.current) {
            push('tony', TONY_OPENERS[Math.floor(Math.random() * TONY_OPENERS.length)])
            setUnread((u) => u + 1)
            cue('notify')
            pushLog('New message from Tony', 'warn')
          }
          schedule()
        },
        45_000 + Math.random() * 40_000,
      )
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [phase, push, cue, pushLog])

  const setViewing = useCallback((viewing: boolean) => {
    viewingRef.current = viewing
    if (viewing) setUnread(0)
  }, [])

  return { messages, phase, unread, tonyTyping, connect, send, setViewing }
}

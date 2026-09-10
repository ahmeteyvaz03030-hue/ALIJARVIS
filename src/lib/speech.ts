/**
 * RonalJarvis's voice.
 *
 * Uses the browser's own speech synthesis — no key, no upload, no network:
 * the text never leaves the device. Which voices exist depends entirely on
 * the operating system, so the picker lists what is actually installed rather
 * than promising a particular one.
 *
 * Note on cloning: a synthesiser cannot *become* someone's voice. To have
 * RonalJarvis speak in Ahmet's own voice, the owner console records a real
 * voice note and sends it with the message — that is his actual voice, not an
 * imitation of it.
 */

export interface VoiceOption {
  uri: string
  name: string
  lang: string
  local: boolean
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Voices load asynchronously in most browsers and the first call often
 * returns an empty list, so callers subscribe instead of asking once.
 */
export function onVoices(callback: (voices: VoiceOption[]) => void): () => void {
  if (!speechSupported()) {
    callback([])
    return () => {}
  }

  const read = () => {
    const list = window.speechSynthesis
      .getVoices()
      .map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang, local: v.localService }))
      // German first — this is a German interface — then everything else.
      .sort((a, b) => {
        const ad = a.lang.toLowerCase().startsWith('de') ? 0 : 1
        const bd = b.lang.toLowerCase().startsWith('de') ? 0 : 1
        return ad - bd || a.name.localeCompare(b.name)
      })
    callback(list)
  }

  read()
  window.speechSynthesis.addEventListener('voiceschanged', read)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', read)
}

/** The voice a fresh install should get: a local German one, if there is one. */
export function preferredVoice(voices: VoiceOption[]): VoiceOption | null {
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith('de') && v.local) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('de')) ??
    voices[0] ??
    null
  )
}

export interface SpeakOptions {
  voiceURI?: string | null
  rate?: number
  pitch?: number
  onEnd?: () => void
}

/** Everything the synthesiser should not try to pronounce. */
function speakable(text: string): string {
  return text
    // Emoji and box-drawing glyphs read as long garbage strings.
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, ' ')
    .replace(/[·•▌◈■□▶★]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function speak(text: string, options: SpeakOptions = {}): void {
  if (!speechSupported()) return
  const clean = speakable(text)
  if (!clean) return

  // A queued utterance would still be talking over the next answer.
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(clean)
  utterance.lang = 'de-DE'
  utterance.rate = options.rate ?? 1
  utterance.pitch = options.pitch ?? 1
  if (options.voiceURI) {
    const match = window.speechSynthesis.getVoices().find((v) => v.voiceURI === options.voiceURI)
    if (match) {
      utterance.voice = match
      utterance.lang = match.lang
    }
  }
  if (options.onEnd) {
    utterance.addEventListener('end', options.onEnd)
    utterance.addEventListener('error', options.onEnd)
  }
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}

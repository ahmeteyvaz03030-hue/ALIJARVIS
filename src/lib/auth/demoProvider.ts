import { matchesDigest, type DigestPair } from './digest'
import type { AuthProvider, JarvisSession, SignInResult } from './types'

const SESSION_KEY = 'ronaljarvis.session.v1'
const ATTEMPTS_KEY = 'ronaljarvis.attempts.v1'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30_000

/**
 * Digest of the first-demo passcode. The plaintext lives only in the private
 * hand-off note — never in this repository, the bundle or the UI.
 *
 * Override for a different local passcode by setting
 * `VITE_DEMO_PASSCODE_SHA256` to `sha256("RJV1:" + yourPasscode)`.
 */
const DEMO_DIGEST: DigestPair = {
  strong:
    (import.meta.env.VITE_DEMO_PASSCODE_SHA256 as string | undefined) ??
    '9904991519c44c1b35fcc13f387d0fe431efd6969fe0051b9ffde25d42d88b6b',
  // Only valid for the built-in passcode; cleared when a custom digest is set.
  weak: import.meta.env.VITE_DEMO_PASSCODE_SHA256
    ? ''
    : '7d70849ff8d83df654d0c7e788970f02',
}

interface AttemptState {
  count: number
  lockedUntil: number
}

function readAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY)
    if (!raw) return { count: 0, lockedUntil: 0 }
    const parsed = JSON.parse(raw) as Partial<AttemptState>
    return {
      count: Number(parsed.count) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    }
  } catch {
    return { count: 0, lockedUntil: 0 }
  }
}

function writeAttempts(state: AttemptState): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable — throttling degrades to in-memory only */
  }
}

function persistSession(session: JarvisSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* non-fatal: the session simply won't survive a reload */
  }
}

/**
 * Local passcode gate for the first demo.
 *
 * Replacing it with a real backend:
 *
 *   // src/lib/auth/index.ts
 *   import { createSupabaseAuthProvider } from './supabaseProvider'
 *   export const authProvider = createSupabaseAuthProvider()
 *
 * The provider only has to return a `JarvisSession`; every animation, gate and
 * greeting in the UI is driven off that object.
 */
export function createDemoPasscodeProvider(): AuthProvider {
  return {
    id: 'demo-passcode',
    label: 'LOCAL DEMO GATE',

    async signIn(secret: string): Promise<SignInResult> {
      const candidate = secret.trim().toUpperCase()
      if (!candidate) {
        return { ok: false, code: 'EMPTY', message: 'NO SIGNATURE PROVIDED' }
      }

      const attempts = readAttempts()
      const now = Date.now()
      if (attempts.lockedUntil > now) {
        return {
          ok: false,
          code: 'LOCKED',
          message: 'TOO MANY FAILED SCANS — GATE COOLING DOWN',
          retryAfterMs: attempts.lockedUntil - now,
        }
      }

      const verdict = await matchesDigest(candidate, DEMO_DIGEST)
      if (verdict === 'unsupported') {
        return {
          ok: false,
          code: 'UNSUPPORTED',
          message: 'CRYPTO MODULE UNAVAILABLE IN THIS CONTEXT',
        }
      }

      if (!verdict) {
        const count = attempts.count + 1
        const locked = count >= MAX_ATTEMPTS
        writeAttempts({
          count: locked ? 0 : count,
          lockedUntil: locked ? now + LOCKOUT_MS : 0,
        })
        return locked
          ? {
              ok: false,
              code: 'LOCKED',
              message: 'SIGNATURE REJECTED — GATE COOLING DOWN',
              retryAfterMs: LOCKOUT_MS,
            }
          : {
              ok: false,
              code: 'INVALID_CREDENTIALS',
              message: `SIGNATURE MISMATCH — ${MAX_ATTEMPTS - count} ATTEMPT(S) LEFT`,
            }
      }

      writeAttempts({ count: 0, lockedUntil: 0 })
      const session: JarvisSession = {
        userId: 'ali',
        displayName: 'ALI',
        accessLevel: 'BROTHER',
        issuedAt: now,
        expiresAt: now + SESSION_TTL_MS,
        provider: 'demo-passcode',
      }
      persistSession(session)
      return { ok: true, session }
    },

    async restore(): Promise<JarvisSession | null> {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) return null
        const session = JSON.parse(raw) as JarvisSession
        if (!session?.userId) return null
        if (session.expiresAt && session.expiresAt < Date.now()) {
          localStorage.removeItem(SESSION_KEY)
          return null
        }
        return session
      } catch {
        return null
      }
    },

    async signOut(): Promise<void> {
      try {
        localStorage.removeItem(SESSION_KEY)
      } catch {
        /* nothing to clean up */
      }
    },
  }
}

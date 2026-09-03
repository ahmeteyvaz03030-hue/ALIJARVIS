/**
 * Auth contract for RonalJarvis.
 *
 * The whole UI talks to this interface and nothing else. The demo build wires
 * in `createDemoPasscodeProvider()`; swapping to Supabase or Firebase later is
 * a one-line change in `src/lib/auth/index.ts` — no component has to change.
 */

export type AccessLevel = 'BROTHER' | 'FAMILY' | 'GUEST'

export interface JarvisSession {
  /** Stable identifier of the operator. */
  userId: string
  /** Name RonalJarvis greets on screen. */
  displayName: string
  accessLevel: AccessLevel
  /** Epoch ms. */
  issuedAt: number
  /** Epoch ms; `null` means "until sign-out". */
  expiresAt: number | null
  /** Which provider minted this session. */
  provider: string
}

export type SignInFailureCode =
  | 'EMPTY'
  | 'INVALID_CREDENTIALS'
  | 'LOCKED'
  | 'NETWORK'
  | 'UNSUPPORTED'
  | 'UNKNOWN'

export type SignInResult =
  | { ok: true; session: JarvisSession }
  | {
      ok: false
      code: SignInFailureCode
      /** Short, screen-ready message. Never echoes the secret. */
      message: string
      /** Present when `code === 'LOCKED'`. */
      retryAfterMs?: number
    }

export interface AuthProvider {
  /** Machine id, e.g. `demo-passcode`, `supabase`, `firebase`. */
  readonly id: string
  /** Human label shown in the settings module. */
  readonly label: string
  /**
   * Verify a credential. For the demo this is the passcode; for Supabase or
   * Firebase it becomes an email/password or OTP payload — widen the argument
   * type there and the call sites keep working.
   */
  signIn(secret: string): Promise<SignInResult>
  /** Rehydrate a previously stored session, or `null`. */
  restore(): Promise<JarvisSession | null>
  signOut(): Promise<void>
}

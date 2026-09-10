/**
 * A second, separate lock for the owner console.
 *
 * The demo gate lets Ali in. This one keeps the *composer* out of his hands,
 * so a message written through it still reads as RonalJarvis speaking rather
 * than as something he could have typed himself.
 *
 * There is no shipped code: the owner sets one the first time on their own
 * device, and only its digest is stored. Nothing here is a secret RonalJarvis
 * carries around — it is a lid on a drawer, not a vault.
 */

import { computeDigest, matchesDigest, safeEqual, type DigestPair } from './digest'

const CODE_KEY = 'ronaljarvis.owner.code.v1'
const SESSION_KEY = 'ronaljarvis.owner.session.v1'

/** How long an unlocked console stays unlocked in this tab. */
const SESSION_MS = 6 * 60 * 60 * 1000

export function ownerCodeSet(): boolean {
  try {
    return Boolean(localStorage.getItem(CODE_KEY))
  } catch {
    return false
  }
}

export type SetCodeResult = 'ok' | 'too-short' | 'unsupported'

export async function setOwnerCode(code: string): Promise<SetCodeResult> {
  if (code.trim().length < 4) return 'too-short'
  const digest = await computeDigest(code.trim())
  if (!digest) return 'unsupported'
  try {
    localStorage.setItem(CODE_KEY, JSON.stringify(digest))
  } catch {
    return 'unsupported'
  }
  return 'ok'
}

export function clearOwnerCode(): void {
  try {
    localStorage.removeItem(CODE_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export async function verifyOwnerCode(code: string): Promise<boolean> {
  let stored: DigestPair | null = null
  try {
    const raw = localStorage.getItem(CODE_KEY)
    stored = raw ? (JSON.parse(raw) as DigestPair) : null
  } catch {
    return false
  }
  if (!stored) return false
  const result = await matchesDigest(code.trim(), stored)
  if (result === 'unsupported') return false
  if (!result) return false
  try {
    sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS))
  } catch {
    /* ignore */
  }
  return true
}

export function ownerUnlocked(): boolean {
  try {
    const until = Number(sessionStorage.getItem(SESSION_KEY) ?? 0)
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

export function lockOwner(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export { safeEqual }

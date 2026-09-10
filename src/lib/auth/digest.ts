/**
 * The demo passcode is never stored, shipped or logged in plaintext — only its
 * digest is compiled into the bundle, so it cannot be read out of devtools or
 * the source map either.
 */

const DOMAIN = 'RJV1:'

/** SHA-256 hex. Requires a secure context (https or localhost). */
async function strongDigest(input: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const bytes = new TextEncoder().encode(DOMAIN + input)
  const hash = await subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Fallback for insecure contexts (e.g. previewing the demo over plain http on
 * the local network) where `crypto.subtle` is unavailable. Deliberately only
 * used as a fallback — it is a demo gate, not a password store.
 */
function weakDigest(input: string): string {
  let cur = DOMAIN + input
  let acc = ''
  for (let round = 0; round < 4; round++) {
    cur = `${fnv1a(cur).toString(16).padStart(8, '0')}:${cur}`
    acc += fnv1a(cur).toString(16).padStart(8, '0')
  }
  return acc
}

export interface DigestPair {
  strong: string
  weak: string
}

/** Produce a digest pair for a value the *user* chose (see ownerGate.ts). */
export async function computeDigest(input: string): Promise<DigestPair | null> {
  const strong = await strongDigest(input)
  if (strong) return { strong, weak: '' }
  return { strong: '', weak: weakDigest(input) }
}

/** Length-independent comparison so timing does not leak the prefix. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0)
  }
  return diff === 0
}

/**
 * Compare a candidate against the compiled digests.
 * Returns `'unsupported'` when neither digest path can run.
 */
export async function matchesDigest(
  candidate: string,
  expected: DigestPair,
): Promise<boolean | 'unsupported'> {
  const strong = await strongDigest(candidate)
  if (strong) return safeEqual(strong, expected.strong)
  if (expected.weak) return safeEqual(weakDigest(candidate), expected.weak)
  return 'unsupported'
}

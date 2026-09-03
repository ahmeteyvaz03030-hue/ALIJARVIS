import { createDemoPasscodeProvider } from './demoProvider'
import type { AuthProvider } from './types'

/**
 * The single wiring point for authentication.
 *
 * Demo build → local passcode gate.
 * Production → swap the right-hand side for `createSupabaseAuthProvider()` or
 * `createFirebaseAuthProvider()`. Nothing else in the app needs to change,
 * because every consumer only depends on the `AuthProvider` interface and on
 * the `JarvisSession` it returns.
 */
export const authProvider: AuthProvider = createDemoPasscodeProvider()

export * from './types'

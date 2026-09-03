import { AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { AuthGate } from './components/auth/AuthGate'
import { BootSequence } from './components/boot/BootSequence'
import { UnlockSequence } from './components/boot/UnlockSequence'
import { Desktop } from './components/layout/Desktop'
import { ParticleField } from './components/fx/ParticleField'
import { authProvider, type JarvisSession } from './lib/auth'
import { useSystem } from './state/SystemProvider'

type Stage = 'boot' | 'auth' | 'unlock' | 'desktop'

export function App() {
  const { settings, calm, pushLog } = useSystem()
  const [stage, setStage] = useState<Stage>('boot')
  const [session, setSession] = useState<JarvisSession | null>(null)
  const [restored, setRestored] = useState(false)

  /* A stored session skips the gate but never the hand-off animation. */
  useEffect(() => {
    void authProvider.restore().then((s) => {
      setSession(s)
      setRestored(true)
      if (s) pushLog('Existing session restored', 'ok')
    })
  }, [pushLog])

  const onBooted = useCallback(() => {
    setStage(session ? 'unlock' : 'auth')
  }, [session])

  const onAuthorized = useCallback((next: JarvisSession) => {
    setSession(next)
    setStage('unlock')
  }, [])

  const signOut = useCallback(() => {
    void authProvider.signOut().then(() => {
      pushLog('Session terminated by operator', 'warn')
      setSession(null)
      setStage('auth')
    })
  }, [pushLog])

  const replayBoot = useCallback(() => {
    try {
      sessionStorage.removeItem('ronaljarvis.booted')
    } catch {
      /* ignore */
    }
    setStage('boot')
  }, [])

  return (
    <div className="relative min-h-screen">
      <ParticleField />
      {settings.scanlines && !calm && <div className="crt-overlay" aria-hidden="true" />}
      <div className="vignette" aria-hidden="true" />

      <div className="relative z-10">
        {stage === 'desktop' && session && (
          <Desktop session={session} onSignOut={signOut} onReplayBoot={replayBoot} />
        )}

        <AnimatePresence mode="wait">
          {stage === 'boot' && restored && (
            <BootSequence key="boot" onComplete={onBooted} />
          )}
          {stage === 'auth' && <AuthGate key="auth" onAuthorized={onAuthorized} />}
          {stage === 'unlock' && (
            <UnlockSequence key="unlock" onComplete={() => setStage('desktop')} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

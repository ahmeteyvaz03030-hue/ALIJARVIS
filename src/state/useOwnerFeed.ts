import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  fetchRemoteFeed,
  newId,
  takeSharedFromLocation,
  type OwnerMessage,
} from '../lib/ownerFeed'

const STORAGE_KEY = 'ronaljarvis.ownerfeed.v1'
const READ_KEY = 'ronaljarvis.ownerfeed.read.v1'

/** How often the deployed feed is re-checked. */
const POLL_MS = 90_000

interface FeedState {
  messages: OwnerMessage[]
  readIds: string[]
  /** Whether the last poll found the feed file at all. */
  reachable: boolean
  lastPoll: number
}

function loadMessages(): OwnerMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as OwnerMessage[]) : []
  } catch {
    return []
  }
}

function loadRead(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

let state: FeedState = {
  messages: loadMessages(),
  readIds: loadRead(),
  reachable: false,
  lastPoll: 0,
}

const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages))
    localStorage.setItem(READ_KEY, JSON.stringify(state.readIds.slice(-300)))
  } catch {
    /* storage unavailable — the channel still works for this session */
  }
}

const byNewest = (a: OwnerMessage, b: OwnerMessage) => b.at - a.at

/**
 * Merge without ever losing a message: the deployed feed and the locally
 * imported copies can each hold rows the other has never seen, and a later
 * edit to the same id should win.
 */
function merge(incoming: OwnerMessage[]): boolean {
  const map = new Map(state.messages.map((m) => [m.id, m]))
  let changed = false
  for (const message of incoming) {
    const existing = map.get(message.id)
    if (!existing || JSON.stringify(existing) !== JSON.stringify(message)) {
      map.set(message.id, message)
      changed = true
    }
  }
  if (!changed) return false
  state = { ...state, messages: [...map.values()].sort(byNewest).slice(0, 200) }
  persist()
  emit()
  return true
}

/* -------------------------------------------------------------------------- */
/* Polling                                                                    */
/* -------------------------------------------------------------------------- */

let pollTimer: number | null = null
let pollers = 0

async function pollOnce() {
  const result = await fetchRemoteFeed()
  state = { ...state, reachable: result.reachable, lastPoll: Date.now() }
  if (!merge(result.messages)) emit()
}

function startPolling() {
  pollers += 1
  if (pollTimer !== null) return
  void pollOnce()
  pollTimer = window.setInterval(() => void pollOnce(), POLL_MS)
}

function stopPolling() {
  pollers = Math.max(0, pollers - 1)
  if (pollers === 0 && pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

// A share link is a one-shot delivery: take it before anything renders.
if (typeof window !== 'undefined') {
  const shared = takeSharedFromLocation()
  if (shared.length) merge(shared)

  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY && e.key !== READ_KEY) return
    state = { ...state, messages: loadMessages(), readIds: loadRead() }
    emit()
  })
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const getSnapshot = () => state

export interface OwnerFeedApi {
  messages: OwnerMessage[]
  /** Owner messages Ali has not opened yet. */
  unread: OwnerMessage[]
  reachable: boolean
  lastPoll: number
  markAllRead: () => void
  isRead: (id: string) => boolean
  /** Add a message composed on this device (owner console, or Ali's reply). */
  add: (message: Omit<OwnerMessage, 'id' | 'at'> & Partial<Pick<OwnerMessage, 'id' | 'at'>>) => OwnerMessage
  remove: (id: string) => void
  importMessages: (incoming: OwnerMessage[]) => number
  refresh: () => Promise<void>
  clear: () => void
}

/**
 * @param poll set on the components that should keep the feed warm; the
 *             composer does not need to poll while it is being written in.
 */
export function useOwnerFeed(poll = false): OwnerFeedApi {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!poll) return
    startPolling()
    return stopPolling
  }, [poll])

  const markAllRead = useCallback(() => {
    const ids = new Set(state.readIds)
    for (const m of state.messages) ids.add(m.id)
    state = { ...state, readIds: [...ids] }
    persist()
    emit()
  }, [])

  const isRead = useCallback((id: string) => state.readIds.includes(id), [])

  const add = useCallback((partial: Parameters<OwnerFeedApi['add']>[0]) => {
    const message: OwnerMessage = {
      id: partial.id ?? newId(partial.kind ?? 'message'),
      at: partial.at ?? Date.now(),
      kind: partial.kind ?? 'message',
      text: partial.text ?? '',
      film: partial.film,
      event: partial.event,
      voice: partial.voice,
      from: partial.from ?? 'owner',
    }
    merge([message])
    return message
  }, [])

  const remove = useCallback((id: string) => {
    state = { ...state, messages: state.messages.filter((m) => m.id !== id) }
    persist()
    emit()
  }, [])

  const importMessages = useCallback((incoming: OwnerMessage[]) => {
    const before = state.messages.length
    merge(incoming)
    return state.messages.length - before
  }, [])

  const refresh = useCallback(() => pollOnce(), [])

  const clear = useCallback(() => {
    state = { ...state, messages: [] }
    persist()
    emit()
  }, [])

  const unread = snapshot.messages.filter(
    (m) => m.from !== 'ali' && !snapshot.readIds.includes(m.id),
  )

  return {
    messages: snapshot.messages,
    unread,
    reachable: snapshot.reachable,
    lastPoll: snapshot.lastPoll,
    markAllRead,
    isRead,
    add,
    remove,
    importMessages,
    refresh,
    clear,
  }
}

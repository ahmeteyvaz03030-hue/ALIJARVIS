import { useCallback, useEffect, useRef, useState } from 'react'

export interface Todo {
  id: string
  text: string
  done: boolean
  createdAt: number
  doneAt: number | null
}

const STORAGE_KEY = 'ronaljarvis.todos.v1'

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is Todo => typeof t === 'object' && t !== null && typeof (t as Todo).id === 'string',
    )
  } catch {
    return []
  }
}

function saveTodos(todos: Todo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  } catch {
    /* storage unavailable — the list simply won't survive a reload */
  }
}

/**
 * Ali's reminder list for the trip — packing, bookings, things to tell Tony.
 * Lives only in this browser's localStorage; there is no server for it.
 */
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(loadTodos)
  const idRef = useRef(0)

  useEffect(() => {
    saveTodos(todos)
  }, [todos])

  const add = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    idRef.current += 1
    // Counter plus timestamp: unique within a session and across reloads
    // without needing to reconstruct a "highest id so far" from storage.
    const todo: Todo = {
      id: `${idRef.current}-${Date.now().toString(36)}`,
      text: trimmed,
      done: false,
      createdAt: Date.now(),
      doneAt: null,
    }
    setTodos((prev) => [...prev, todo])
  }, [])

  const toggle = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : Date.now() } : t)),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clearDone = useCallback(() => {
    setTodos((prev) => prev.filter((t) => !t.done))
  }, [])

  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  return { todos, open, done, add, toggle, remove, clearDone }
}

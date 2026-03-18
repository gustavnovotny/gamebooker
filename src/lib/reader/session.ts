import type { Item } from '@/lib/supabase/types'

export interface GameSession {
  gamebookId: string
  currentNodeId: string
  hp: number        // current HP
  maxHp: number     // sila + 10, computed at character creation
  stats: {
    sila: number
    inteligence: number
    obratnost: number
    stesti: number
  }
  inventory: Item[] // full Item objects for offline display
}

const key = (gamebookId: string) => `gamebooker_session_${gamebookId}`

export function getSession(gamebookId: string): GameSession | null {
  try {
    const raw = localStorage.getItem(key(gamebookId))
    return raw ? (JSON.parse(raw) as GameSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: GameSession): void {
  try {
    localStorage.setItem(key(session.gamebookId), JSON.stringify(session))
  } catch {
    // SecurityError or QuotaExceededError — silently ignore
  }
}

export function clearSession(gamebookId: string): void {
  try {
    localStorage.removeItem(key(gamebookId))
  } catch {
    // ignore
  }
}

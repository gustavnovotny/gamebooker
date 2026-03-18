import { getSession, saveSession, clearSession } from './session'
import type { GameSession } from './session'

const session: GameSession = {
  gamebookId: 'g1',
  currentNodeId: 'n1',
  hp: 15,
  maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

beforeEach(() => localStorage.clear())

describe('session helpers', () => {
  it('returns null when no session exists', () => {
    expect(getSession('g1')).toBeNull()
  })

  it('saves and retrieves a session', () => {
    saveSession(session)
    expect(getSession('g1')).toEqual(session)
  })

  it('clears a session', () => {
    saveSession(session)
    clearSession('g1')
    expect(getSession('g1')).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    localStorage.setItem('gamebooker_session_g1', 'not-json')
    expect(getSession('g1')).toBeNull()
  })
})

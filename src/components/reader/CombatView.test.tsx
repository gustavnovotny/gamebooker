import { render, screen } from '@testing-library/react'
import CombatView, { resolveRound, resolveLuck, computeItemBonus } from './CombatView'
import type { CombatState } from './CombatView'
import type { CombatConfig } from '@/lib/supabase/types'
import type { GameSession } from '@/lib/reader/session'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/reader/session', () => ({ saveSession: jest.fn() }))

// --- Pure function tests ---

const initial: CombatState = {
  playerHp: 15, enemyHp: 10,
  playerRoundWins: 0, enemyRoundWins: 0,
  log: [], phase: 'idle', luckUsed: false, pendingLoss: null,
}

describe('resolveRound', () => {
  it('player wins: reduces enemy HP and increments playerRoundWins', () => {
    const s = resolveRound(initial, 10, 5)
    expect(s.enemyHp).toBe(5)     // 10 - max(1, 10-5)
    expect(s.playerRoundWins).toBe(1)
    expect(s.phase).toBe('idle')
  })

  it('tie: no HP change, no round wins', () => {
    const s = resolveRound(initial, 7, 7)
    expect(s.playerHp).toBe(15)
    expect(s.enemyHp).toBe(10)
    expect(s.playerRoundWins).toBe(0)
    expect(s.enemyRoundWins).toBe(0)
    expect(s.phase).toBe('idle')
  })

  it('player loses: enters luck_prompt with pendingLoss when luck unused', () => {
    const s = resolveRound(initial, 5, 10)
    expect(s.phase).toBe('luck_prompt')
    expect(s.pendingLoss).toEqual({ damage: 5 })
    expect(s.playerHp).toBe(15) // HP not applied yet
  })

  it('player loses: applies HP directly when luck already used', () => {
    const state = { ...initial, luckUsed: true }
    const s = resolveRound(state, 5, 10)
    expect(s.playerHp).toBe(10) // 15 - max(1, 10-5)
    expect(s.enemyRoundWins).toBe(1)
    expect(s.phase).toBe('idle')
  })

  it('damage is at least 1', () => {
    const s = resolveRound(initial, 6, 5) // diff = 1
    expect(s.enemyHp).toBe(9)             // 10 - 1
  })

  it('victory when player reaches 2 round wins', () => {
    const state = { ...initial, playerRoundWins: 1 }
    const s = resolveRound(state, 10, 5)
    expect(s.phase).toBe('victory')
  })

  it('victory when enemy HP reaches 0', () => {
    const state = { ...initial, enemyHp: 3 }
    const s = resolveRound(state, 10, 5)
    expect(s.enemyHp).toBe(0)
    expect(s.phase).toBe('victory')
  })

  it('defeat when enemy reaches 2 round wins (luck used)', () => {
    const state = { ...initial, enemyRoundWins: 1, luckUsed: true }
    const s = resolveRound(state, 5, 10)
    expect(s.phase).toBe('defeat')
  })

  it('defeat when player HP reaches 0 (luck used)', () => {
    const state = { ...initial, playerHp: 3, luckUsed: true }
    const s = resolveRound(state, 5, 10)
    expect(s.playerHp).toBe(0)
    expect(s.phase).toBe('defeat')
  })
})

describe('resolveLuck', () => {
  const stateWithPending: CombatState = {
    ...initial, phase: 'luck_prompt', pendingLoss: { damage: 5 },
  }

  it('roll >= 7: loss becomes draw, no HP applied, luckUsed set', () => {
    const s = resolveLuck(stateWithPending, 7)
    expect(s.playerHp).toBe(15)
    expect(s.enemyRoundWins).toBe(0)
    expect(s.luckUsed).toBe(true)
    expect(s.phase).toBe('idle')
  })

  it('roll < 7: pending loss applied, luckUsed set', () => {
    const s = resolveLuck(stateWithPending, 6)
    expect(s.playerHp).toBe(10) // 15 - 5
    expect(s.enemyRoundWins).toBe(1)
    expect(s.luckUsed).toBe(true)
  })

  it('roll < 7: defeat if applying loss would finish combat', () => {
    const state = { ...stateWithPending, enemyRoundWins: 1 }
    const s = resolveLuck(state, 6)
    expect(s.phase).toBe('defeat')
  })
})

describe('computeItemBonus', () => {
  it('sums bonus values for matching attribute', () => {
    const items = [
      { id: 'i1', gamebook_id: 'g1', name: 'Sword', description: '', stat_bonus_attribute: 'sila' as const, stat_bonus_value: 2 },
      { id: 'i2', gamebook_id: 'g1', name: 'Ring', description: '', stat_bonus_attribute: 'sila' as const, stat_bonus_value: 1 },
      { id: 'i3', gamebook_id: 'g1', name: 'Shield', description: '', stat_bonus_attribute: 'obratnost' as const, stat_bonus_value: 3 },
    ]
    expect(computeItemBonus(items, 'sila')).toBe(3)
    expect(computeItemBonus(items, 'obratnost')).toBe(3)
    expect(computeItemBonus(items, 'inteligence')).toBe(0)
  })
})

// --- Component render tests ---

const baseConfig: CombatConfig = {
  id: 'cc1', node_id: 'n1',
  enemy_name: 'Goblin', enemy_hp: 10,
  enemy_sila: 4, enemy_inteligence: 3, enemy_obratnost: 3, enemy_stesti: 3,
  player_attribute: 'sila', enemy_attribute: 'sila',
  victory_node_id: 'nv', defeat_node_id: 'nd',
}

const baseSession: GameSession = {
  gamebookId: 'g1', currentNodeId: 'n1', hp: 15, maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

const node = { id: 'n1', gamebook_id: 'g1', type: 'combat' as const, title: 'Souboj', content: 'Goblin útočí.', summary: '', is_start: false, x: 0, y: 0 }

describe('CombatView render', () => {
  it('shows enemy name and roll button in idle phase', () => {
    render(<CombatView gamebookId="g1" node={node} combatConfig={baseConfig} session={baseSession} />)
    expect(screen.getByText('Goblin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hodit kostky/i })).toBeInTheDocument()
  })

  it('shows error when victory_node_id is null', () => {
    const config = { ...baseConfig, victory_node_id: null }
    render(<CombatView gamebookId="g1" node={node} combatConfig={config} session={baseSession} />)
    expect(screen.getByText(/souboj není správně nakonfigurován/i)).toBeInTheDocument()
  })

  it('shows error when defeat_node_id is null', () => {
    const config = { ...baseConfig, defeat_node_id: null }
    render(<CombatView gamebookId="g1" node={node} combatConfig={config} session={baseSession} />)
    expect(screen.getByText(/souboj není správně nakonfigurován/i)).toBeInTheDocument()
  })
})

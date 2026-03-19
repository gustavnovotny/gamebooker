import { render, screen } from '@testing-library/react'
import type { Item, Node, Choice } from '@/lib/supabase/types'
import type { GameSession } from '@/lib/reader/session'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/reader/session', () => ({ saveSession: jest.fn() }))

import ItemDiscoveryNodeView from './ItemDiscoveryNodeView'
import { saveSession } from '@/lib/reader/session'
const mockSaveSession = saveSession as jest.Mock

const item1: Item = { id: 'i1', gamebook_id: 'g1', name: 'Zlatý meč', description: '', stat_bonus_attribute: null, stat_bonus_value: 0 }
const item2: Item = { id: 'i2', gamebook_id: 'g1', name: 'Štít', description: '', stat_bonus_attribute: null, stat_bonus_value: 0 }

const node: Node = { id: 'n1', gamebook_id: 'g1', type: 'item_discovery', title: 'Poklad', content: 'Najdeš truhlu.', summary: '', is_start: false, x: 0, y: 0 }
const choices: Choice[] = [{ id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Pokračovat', condition_item_id: null }]

const emptySession: GameSession = {
  gamebookId: 'g1', currentNodeId: 'n1', hp: 15, maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

beforeEach(() => mockSaveSession.mockClear())

describe('ItemDiscoveryNodeView', () => {
  it('adds new items to session on mount', () => {
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1]} session={emptySession} />)
    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({ inventory: [item1] })
    )
  })

  it('shows toast for each new item', () => {
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1]} session={emptySession} />)
    expect(screen.getByText('Získal jsi: Zlatý meč')).toBeInTheDocument()
  })

  it('skips items already in inventory', () => {
    const sessionWithItem = { ...emptySession, inventory: [item1] }
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1, item2]} session={sessionWithItem} />)
    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({ inventory: [item1, item2] })
    )
    expect(mockSaveSession).toHaveBeenCalledTimes(1)
  })

  it('does not call saveSession when all items already owned', () => {
    const sessionWithItem = { ...emptySession, inventory: [item1] }
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1]} session={sessionWithItem} />)
    expect(mockSaveSession).not.toHaveBeenCalled()
  })

  it('renders node content and choices', () => {
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[]} session={emptySession} />)
    expect(screen.getByText('Najdeš truhlu.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pokračovat' })).toBeInTheDocument()
  })
})

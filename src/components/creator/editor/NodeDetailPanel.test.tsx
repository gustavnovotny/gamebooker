import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NodeDetailPanel from './NodeDetailPanel'
import type { Node } from '@/lib/supabase/types'

const mockNode: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'story',
  title: 'Lesní cesta', content: 'Jdeš lesem.',
  summary: '', is_start: false, x: 0, y: 0,
}

const baseProps = {
  node: mockNode,
  allNodes: [mockNode],
  combatConfig: null,
  onSave: jest.fn(),
  onGenerateText: jest.fn(),
  onClose: jest.fn(),
  onAddNode: jest.fn(),
  onSaveCombatConfig: jest.fn(),
  assignedItems: [],
  allGamebookItems: [],
  onAssignItem: jest.fn().mockResolvedValue(undefined),
  onUnassignItem: jest.fn().mockResolvedValue(undefined),
  onCreateItem: jest.fn().mockResolvedValue({ id: 'i1', gamebook_id: 'g1', name: 'Test', description: '', stat_bonus_attribute: null, stat_bonus_value: 0 }),
  onUpdateItem: jest.fn().mockResolvedValue(undefined),
}

describe('NodeDetailPanel', () => {
  it('shows node title and content', () => {
    render(<NodeDetailPanel {...baseProps} />)
    expect(screen.getByDisplayValue('Lesní cesta')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jdeš lesem.')).toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', async () => {
    const onSave = jest.fn()
    render(<NodeDetailPanel {...baseProps} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: /uložit uzel/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', title: 'Lesní cesta' })
    )
  })

  it('calls onGenerateText when generate button is clicked', async () => {
    const onGenerateText = jest.fn()
    render(<NodeDetailPanel {...baseProps} onGenerateText={onGenerateText} />)
    await userEvent.click(screen.getByRole('button', { name: /generovat/i }))
    expect(onGenerateText).toHaveBeenCalledWith('n1')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NodeDetailPanel from './NodeDetailPanel'
import type { Node } from '@/lib/supabase/types'

const mockNode: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'story',
  title: 'Lesní cesta', content: 'Jdeš lesem.',
  is_start: false, x: 0, y: 0,
}

describe('NodeDetailPanel', () => {
  it('shows node title and content', () => {
    render(<NodeDetailPanel node={mockNode} onSave={jest.fn()} onGenerateText={jest.fn()} />)
    expect(screen.getByDisplayValue('Lesní cesta')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jdeš lesem.')).toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', async () => {
    const onSave = jest.fn()
    render(<NodeDetailPanel node={mockNode} onSave={onSave} onGenerateText={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /uložit/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', title: 'Lesní cesta' })
    )
  })

  it('calls onGenerateText when generate button is clicked', async () => {
    const onGenerateText = jest.fn()
    render(<NodeDetailPanel node={mockNode} onSave={jest.fn()} onGenerateText={onGenerateText} />)
    await userEvent.click(screen.getByRole('button', { name: /generovat/i }))
    expect(onGenerateText).toHaveBeenCalledWith('n1')
  })
})

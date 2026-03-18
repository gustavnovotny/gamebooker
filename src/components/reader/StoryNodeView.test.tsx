import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StoryNodeView from './StoryNodeView'
import type { Node, Choice } from '@/lib/supabase/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const node: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'story',
  title: 'Lesní cesta', content: 'Jdeš lesem.', summary: '', is_start: true, x: 0, y: 0,
}
const choices: Choice[] = [
  { id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Jít doleva', condition_item_id: null },
  { id: 'c2', from_node_id: 'n1', to_node_id: 'n3', text: 'Jít doprava', condition_item_id: null },
]

beforeEach(() => mockPush.mockClear())

describe('StoryNodeView', () => {
  it('renders title, content and choices', () => {
    render(<StoryNodeView gamebookId="g1" node={node} choices={choices} />)
    expect(screen.getByText('Lesní cesta')).toBeInTheDocument()
    expect(screen.getByText('Jdeš lesem.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jít doleva' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jít doprava' })).toBeInTheDocument()
  })

  it('navigates to choice target on click', async () => {
    render(<StoryNodeView gamebookId="g1" node={node} choices={choices} />)
    await userEvent.click(screen.getByRole('button', { name: 'Jít doleva' }))
    expect(mockPush).toHaveBeenCalledWith('/hrat/g1/uzel/n2')
  })
})

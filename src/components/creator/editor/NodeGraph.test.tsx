import { render, screen } from '@testing-library/react'
import NodeGraph from './NodeGraph'
import type { Node, Choice } from '@/lib/supabase/types'

// React Flow uses ResizeObserver which is not available in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const mockNodes: Node[] = [
  { id: 'n1', gamebook_id: 'g1', type: 'story', title: 'Začátek', content: '', is_start: true, x: 0, y: 0 },
  { id: 'n2', gamebook_id: 'g1', type: 'ending', title: 'Konec', content: '', is_start: false, x: 200, y: 200 },
]
const mockChoices: Choice[] = [
  { id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Pokračuj', condition_item_id: null },
]

describe('NodeGraph', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <NodeGraph
        nodes={mockNodes}
        choices={mockChoices}
        selectedNodeId={null}
        onNodeSelect={jest.fn()}
        onNodesChange={jest.fn()}
        onChoicesChange={jest.fn()}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

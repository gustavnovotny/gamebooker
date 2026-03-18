import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@/lib/supabase/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

jest.mock('@/lib/reader/session')

import EndingView from './EndingView'
import * as sessionModule from '@/lib/reader/session'

const mockClear = sessionModule.clearSession as jest.Mock

const node: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'ending',
  title: 'Konec', content: 'Příběh skončil.', summary: '', is_start: false, x: 0, y: 0,
}

beforeEach(() => { mockPush.mockClear(); mockClear.mockClear() })

describe('EndingView', () => {
  it('renders ending title, content and restart button', () => {
    render(<EndingView gamebookId="g1" node={node} />)
    expect(screen.getByText('Konec')).toBeInTheDocument()
    expect(screen.getByText('Příběh skončil.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hrát znovu/i })).toBeInTheDocument()
  })

  it('clears session and redirects to start on restart', async () => {
    render(<EndingView gamebookId="g1" node={node} />)
    await userEvent.click(screen.getByRole('button', { name: /hrát znovu/i }))
    expect(mockClear).toHaveBeenCalledWith('g1')
    expect(mockPush).toHaveBeenCalledWith('/hrat/g1')
  })
})

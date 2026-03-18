import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionBar from './SessionBar'
import type { GameSession } from '@/lib/reader/session'

const session: GameSession = {
  gamebookId: 'g1', currentNodeId: 'n1',
  hp: 12, maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

describe('SessionBar', () => {
  it('shows current and max HP', () => {
    render(<SessionBar session={session} />)
    expect(screen.getByText(/zdraví.*12.*15/i)).toBeInTheDocument()
  })

  it('opens inventory modal on button click', async () => {
    render(<SessionBar session={session} />)
    await userEvent.click(screen.getByRole('button', { name: /inventář/i }))
    expect(screen.getByRole('heading', { name: /inventář/i })).toBeInTheDocument()
  })

  it('closes inventory modal on close button', async () => {
    render(<SessionBar session={session} />)
    await userEvent.click(screen.getByRole('button', { name: /inventář/i }))
    await userEvent.click(screen.getByRole('button', { name: /zavřít/i }))
    expect(screen.queryByRole('heading', { name: /inventář/i })).not.toBeInTheDocument()
  })
})

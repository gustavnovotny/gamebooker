import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CharacterCreation from './CharacterCreation'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/lib/reader/session', () => ({ saveSession: jest.fn() }))

import { saveSession } from '@/lib/reader/session'
const mockSaveSession = saveSession as jest.Mock

const baseProps = { gamebookId: 'g1', startNodeId: 'n1', gamebookTitle: 'Lesní dobrodružství' }

beforeEach(() => { mockPush.mockClear(); mockSaveSession.mockClear() })

describe('CharacterCreation', () => {
  it('shows 5 remaining bonus points initially', () => {
    render(<CharacterCreation {...baseProps} />)
    expect(screen.getByText('Zbývá bodů: 5')).toBeInTheDocument()
  })

  it('"Začít hrát" is disabled when pool > 0', () => {
    render(<CharacterCreation {...baseProps} />)
    expect(screen.getByRole('button', { name: /začít hrát/i })).toBeDisabled()
  })

  it('pool decrements when + is clicked', async () => {
    render(<CharacterCreation {...baseProps} />)
    const plusButtons = screen.getAllByText('+')
    await userEvent.click(plusButtons[0]) // add to Síla
    expect(screen.getByText('Zbývá bodů: 4')).toBeInTheDocument()
  })

  it('"Začít hrát" is enabled when pool reaches 0', async () => {
    render(<CharacterCreation {...baseProps} />)
    const plusButtons = screen.getAllByText('+')
    for (let i = 0; i < 5; i++) await userEvent.click(plusButtons[0])
    expect(screen.getByRole('button', { name: /začít hrát/i })).not.toBeDisabled()
  })

  it('saves session and navigates on submit', async () => {
    render(<CharacterCreation {...baseProps} />)
    const plusButtons = screen.getAllByText('+')
    for (let i = 0; i < 5; i++) await userEvent.click(plusButtons[0])
    await userEvent.click(screen.getByRole('button', { name: /začít hrát/i }))
    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({ gamebookId: 'g1', currentNodeId: 'n1' })
    )
    expect(mockPush).toHaveBeenCalledWith('/hrat/g1/uzel/n1')
  })
})

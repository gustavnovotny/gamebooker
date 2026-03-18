import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BrainstormChat from './BrainstormChat'

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ message: 'Jaký žánr tě zajímá?' }),
})

describe('BrainstormChat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows initial greeting', () => {
    render(<BrainstormChat gamebookId="g1" onOutlineGenerated={jest.fn()} />)
    expect(screen.getByText(/ahoj/i)).toBeInTheDocument()
  })

  it('sends message and shows response', async () => {
    render(<BrainstormChat gamebookId="g1" onOutlineGenerated={jest.fn()} />)
    const input = screen.getByPlaceholderText(/napiš/i)
    await userEvent.type(input, 'Chci fantasy gamebook')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Jaký žánr tě zajímá?')).toBeInTheDocument()
  })
})

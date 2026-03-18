import { render, screen } from '@testing-library/react'
import GamebookCard from './GamebookCard'
import type { Gamebook } from '@/lib/supabase/types'

const mockGamebook: Gamebook = {
  id: 'abc-123',
  creator_id: 'user-1',
  creator_display_name: 'Jana Nováková',
  title: 'Záhadný hrad',
  description: 'Příběh o starém hradě plném tajemství.',
  cover_image_url: null,
  genre: 'Fantasy',
  status: 'published',
  created_at: '2026-03-17T10:00:00Z',
  updated_at: '2026-03-17T10:00:00Z',
}

describe('GamebookCard', () => {
  it('renders gamebook title', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText('Záhadný hrad')).toBeInTheDocument()
  })

  it('renders creator name', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText('Jana Nováková')).toBeInTheDocument()
  })

  it('renders genre badge', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText('Fantasy')).toBeInTheDocument()
  })

  it('renders node count', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText(/12 uzlů/i)).toBeInTheDocument()
  })

  it('renders a play link to the correct URL', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    const link = screen.getByRole('link', { name: /hrát/i })
    expect(link).toHaveAttribute('href', '/hrat/abc-123')
  })

  it('renders fallback when no cover image', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })
})

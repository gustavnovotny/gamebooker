import { render, screen } from '@testing-library/react'
import GamebookList from './GamebookList'
import type { Gamebook } from '@/lib/supabase/types'

const mockGamebooks: Gamebook[] = [
  {
    id: 'g1', creator_id: 'u1', creator_display_name: 'Test',
    title: 'Záhadný hrad', description: 'Popis', cover_image_url: null,
    genre: 'Fantasy', status: 'draft', created_at: '2026-03-17T00:00:00Z',
    updated_at: '2026-03-17T00:00:00Z',
  },
  {
    id: 'g2', creator_id: 'u1', creator_display_name: 'Test',
    title: 'Temný les', description: 'Popis 2', cover_image_url: null,
    genre: null, status: 'published', created_at: '2026-03-17T00:00:00Z',
    updated_at: '2026-03-17T00:00:00Z',
  },
]

describe('GamebookList', () => {
  it('renders all gamebook titles', () => {
    render(<GamebookList gamebooks={mockGamebooks} />)
    expect(screen.getByText('Záhadný hrad')).toBeInTheDocument()
    expect(screen.getByText('Temný les')).toBeInTheDocument()
  })

  it('shows draft/published status badges', () => {
    render(<GamebookList gamebooks={mockGamebooks} />)
    expect(screen.getByText('Koncept')).toBeInTheDocument()
    expect(screen.getByText('Publikováno')).toBeInTheDocument()
  })

  it('renders edit links for each gamebook', () => {
    render(<GamebookList gamebooks={mockGamebooks} />)
    const editLinks = screen.getAllByRole('link', { name: /upravit/i })
    expect(editLinks).toHaveLength(2)
    expect(editLinks[0]).toHaveAttribute('href', '/tvorit/g1')
  })

  it('shows empty state when no gamebooks', () => {
    render(<GamebookList gamebooks={[]} />)
    expect(screen.getByText(/zatím žádné/i)).toBeInTheDocument()
  })
})

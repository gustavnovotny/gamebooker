import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from './LoginForm'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
    },
  })),
}))

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/heslo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /přihlásit/i })).toBeInTheDocument()
  })

  it('shows error when fields are empty and form is submitted', async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /přihlásit/i }))
    expect(screen.getByText(/vyplňte e-mail/i)).toBeInTheDocument()
  })

  it('shows error message when Supabase returns an error', async () => {
    const { createClient } = require('@/lib/supabase/client')
    createClient.mockReturnValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          error: { message: 'Invalid credentials' },
        }),
      },
    })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/heslo/i), 'wrongpassword')
    await userEvent.click(screen.getByRole('button', { name: /přihlásit/i }))

    expect(await screen.findByText(/nesprávný e-mail nebo heslo/i)).toBeInTheDocument()
  })
})

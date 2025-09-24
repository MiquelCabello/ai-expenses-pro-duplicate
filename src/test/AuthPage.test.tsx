import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { expect, describe, it, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AuthPage from '@/pages/AuthPage'
import { AuthProvider } from '@/hooks/useAuth'

const {
  mockUnsubscribe,
  mockOnAuthStateChange,
  mockGetSession,
  mockSignInWithPassword,
  mockSignUp,
  mockSignOut,
  mockMaybeSingle,
  mockEq,
  mockSelect,
  mockFrom,
} = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockGetSession = vi.fn()
  const mockSignInWithPassword = vi.fn()
  const mockSignUp = vi.fn()
  const mockSignOut = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()

  return {
    mockUnsubscribe,
    mockOnAuthStateChange,
    mockGetSession,
    mockSignInWithPassword,
    mockSignUp,
    mockSignOut,
    mockMaybeSingle,
    mockEq,
    mockSelect,
    mockFrom,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
}))

beforeEach(() => {
  mockUnsubscribe.mockReset()
  mockOnAuthStateChange.mockReset()
  mockGetSession.mockReset()
  mockSignInWithPassword.mockReset()
  mockSignUp.mockReset()
  mockSignOut.mockReset()
  mockMaybeSingle.mockReset()
  mockEq.mockReset()
  mockSelect.mockReset()
  mockFrom.mockReset()

  mockOnAuthStateChange.mockReturnValue({
    data: {
      subscription: {
        unsubscribe: mockUnsubscribe,
      },
    },
  })
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: null })
  mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null })
  mockSignOut.mockResolvedValue({ error: null })

  mockMaybeSingle.mockResolvedValue({ data: null, error: null })
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
})

const AuthPageWrapper = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  </BrowserRouter>
)

describe('AuthPage', () => {
  it('renders login form by default', async () => {
    render(<AuthPageWrapper />)
    expect(await screen.findByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(await screen.findByLabelText(/contraseña/i)).toBeInTheDocument()
    expect(await screen.findAllByRole('button', { name: /iniciar sesión/i })).not.toHaveLength(0)
  })

  it('can switch to register form', async () => {
    const user = userEvent.setup()
    render(<AuthPageWrapper />)
    const registerTab = screen.getByRole('tab', { name: /registrarse/i })
    await user.click(registerTab)

    expect(await screen.findByLabelText(/nombre completo/i)).toBeInTheDocument()
  })
})

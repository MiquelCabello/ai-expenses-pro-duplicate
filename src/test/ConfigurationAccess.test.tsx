import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Sidebar from '@/components/Sidebar';
import CompanyProfilePage from '@/pages/CompanyProfilePage';
import type { Account, Profile } from '@/hooks/useAuth';

const {
  mockUseAuth,
  mockFrom,
  mockSelect,
  mockEq,
} = vi.hoisted(() => {
  const mockUseAuth = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();

  return {
    mockUseAuth,
    mockFrom,
    mockSelect,
    mockEq,
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

const baseAccount: Account = {
  id: 'account-123',
  name: 'Acme Corp',
  plan: 'PROFESSIONAL',
  owner_user_id: 'owner-1',
  max_employees: 15,
  can_assign_roles: true,
  can_assign_department: true,
  can_assign_region: true,
  can_add_custom_categories: true,
  monthly_expense_limit: 5000,
};

const buildProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'profile-123',
  user_id: 'user-123',
  name: 'Test User',
  role: 'ADMIN',
  department: null,
  region: null,
  status: 'ACTIVE',
  account_id: baseAccount.id,
  ...overrides,
});

const buildAuthValue = (profileOverrides: Partial<Profile> = {}) => ({
  account: { ...baseAccount },
  profile: buildProfile(profileOverrides),
  isMaster: false,
  user: null,
  session: null,
  loading: false,
  signOut: vi.fn(),
});

describe('Configuration access control', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();

    mockFrom.mockImplementation(() => ({
      select: mockSelect,
    }));
    mockSelect.mockImplementation(() => ({
      eq: mockEq,
    }));
    mockEq.mockResolvedValue({ data: [], error: null });
  });

  it('does not render the configuration navigation item for employees', () => {
    mockUseAuth.mockReturnValue(buildAuthValue({ role: 'EMPLOYEE' }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /configuración/i })).not.toBeInTheDocument();
  });

  it('renders the configuration navigation item for admins', () => {
    mockUseAuth.mockReturnValue(buildAuthValue({ role: 'ADMIN' }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /configuración/i })).toBeInTheDocument();
  });

  it('hides the company configuration shortcut for employees', async () => {
    mockUseAuth.mockReturnValue(buildAuthValue({ role: 'EMPLOYEE' }));

    render(
      <MemoryRouter initialEntries={['/empresa']}>
        <CompanyProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockEq).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: /configurar empresa/i })).not.toBeInTheDocument();
  });

  it('shows the company configuration shortcut for admins', async () => {
    mockUseAuth.mockReturnValue(buildAuthValue({ role: 'ADMIN' }));

    render(
      <MemoryRouter initialEntries={['/empresa']}>
        <CompanyProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockEq).toHaveBeenCalled());

    expect(await screen.findByRole('button', { name: /configurar empresa/i })).toBeInTheDocument();
  });
});

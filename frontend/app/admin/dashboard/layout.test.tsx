/**
 * @jest-environment jsdom
 */
import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AdminLayout from '../layout';
import { logoutRequest, refreshRequest } from '@/services/authService';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/admin/dashboard',
}));

jest.mock('@/components/layout/Banner', () => ({ Banner: () => null }));
jest.mock('@/components/layout/AdminNavbar', () => ({ AdminNavbar: () => null }));
jest.mock('@/components/layout/AdminFooter', () => ({ AdminFooter: () => null }));
jest.mock('@/components/admin/WelcomeBanner', () => ({ WelcomeBanner: () => null }));
jest.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/services/authService', () => ({
  loginRequest: jest.fn(),
  logoutRequest: jest.fn(),
  refreshRequest: jest.fn(),
  decodeTokenPayload: jest.fn((token: string) => {
    if (token === 'not.a.jwt') throw new Error('malformed');
    return {
      userId: 2,
      email: 'dev@test.com',
      firstName: 'Dev',
      lastName: 'Admin',
      isExecutive: true,
      isSuperuser: true,
      permissionData: {},
    };
  }),
}));

const VALID_TOKEN = `header.${btoa(JSON.stringify({ exp: 4_102_444_800 }))}.signature`;

function renderLayout() {
  return render(
    <AuthProvider>
      <AdminLayout>
        <div>admin content</div>
      </AdminLayout>
    </AuthProvider>,
  );
}

function LogoutControl() {
  const { logout } = useAuth();

  return <button type="button" onClick={() => void logout()}>Log out</button>;
}

describe('admin session gating', () => {
  beforeEach(() => {
    jest.mocked(refreshRequest).mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('redirects to / when refresh-cookie restoration fails', async () => {
    jest.mocked(refreshRequest).mockRejectedValueOnce(new Error('expired refresh cookie'));
    renderLayout();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('admin content')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('notifies an admin when a previously active session cannot be renewed', async () => {
    sessionStorage.setItem('msscc_admin_session_active', 'true');
    jest.mocked(refreshRequest).mockRejectedValueOnce(new Error('expired refresh cookie'));
    renderLayout();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your session has expired. Please sign in again.',
    );
    expect(sessionStorage.getItem('msscc_admin_session_active')).toBeNull();
  });

  it('keeps the expiration notice visible after Strict Mode retries a failed refresh', async () => {
    sessionStorage.setItem('msscc_admin_session_active', 'true');
    jest.mocked(refreshRequest).mockRejectedValue(new Error('expired refresh cookie'));
    render(
      <StrictMode>
        <AuthProvider>
          <AdminLayout>
            <div>admin content</div>
          </AdminLayout>
        </AuthProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(refreshRequest).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your session has expired. Please sign in again.',
    );
  });

  it('removes legacy browser storage instead of treating it as a session', async () => {
    localStorage.setItem('msscc_access_token', 'legacy-access-token');
    localStorage.setItem('msscc_user', '{}');
    jest.mocked(refreshRequest).mockRejectedValueOnce(new Error('expired refresh cookie'));
    renderLayout();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(localStorage.getItem('msscc_access_token')).toBeNull();
    expect(localStorage.getItem('msscc_user')).toBeNull();
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('renders admin content after refresh-cookie session restoration', async () => {
    jest.mocked(refreshRequest).mockResolvedValue({ access: VALID_TOKEN });
    renderLayout();

    expect(await screen.findByText('admin content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('msscc_admin_session_active')).toBe('true');
  });

  it('does not show the expiration notice after an explicit logout', async () => {
    jest.mocked(refreshRequest).mockResolvedValue({ access: VALID_TOKEN });
    jest.mocked(logoutRequest).mockResolvedValue(undefined);
    render(
      <AuthProvider>
        <LogoutControl />
      </AuthProvider>,
    );

    await waitFor(() => expect(sessionStorage.getItem('msscc_admin_session_active')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sessionStorage.getItem('msscc_admin_session_active')).toBeNull();
  });
});

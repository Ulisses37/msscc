/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider } from '@/context/AuthContext';
import AdminLayout from '../layout';
import { refreshRequest } from '@/services/authService';

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

describe('admin session gating', () => {
  beforeEach(() => {
    jest.mocked(refreshRequest).mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('redirects to / when refresh-cookie restoration fails', async () => {
    jest.mocked(refreshRequest).mockRejectedValueOnce(new Error('expired refresh cookie'));
    renderLayout();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('admin content')).toBeNull();
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
  });
});

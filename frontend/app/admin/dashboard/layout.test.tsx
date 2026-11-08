/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider } from '@/context/AuthContext';
import AdminLayout from '../layout';

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
  decodeTokenPayload: jest.fn((token: string) => {
    if (token === 'not.a.jwt') throw new Error('malformed');
    return { userId: '2', email: 'dev@test.com', isExecutive: true, permissionData: {} };
  }),
}));

const VALID_TOKEN = 'header.payload.signature';
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

/** In-memory localStorage so tests can inspect exactly what is left behind. */
function installStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => void data.set(key, value)),
    removeItem: jest.fn((key: string) => void data.delete(key)),
    clear: jest.fn(() => data.clear()),
    get length() {
      return data.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return storage;
}

/** Mimics the Django verify endpoint: only VALID_TOKEN passes. */
function mockVerifyEndpoint() {
  globalThis.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { token } = JSON.parse(String(init?.body));
    const ok = token === VALID_TOKEN;
    return { ok, status: ok ? 200 : 401, json: async () => ({}) } as Response;
  });
}

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
    mockVerifyEndpoint();
  });

  afterEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  });

  it('redirects to / with empty storage when storage is blank', async () => {
    const storage = installStorage({});
    renderLayout();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(storage.length).toBe(0);
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('redirects when only a fake msscc_user is present (the original bug)', async () => {
    const storage = installStorage({ msscc_user: '{}' });
    renderLayout();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(storage.getItem('msscc_user')).toBeNull();
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('redirects and clears storage for a garbage token', async () => {
    const storage = installStorage({ msscc_access_token: 'not.a.jwt' });
    renderLayout();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(storage.length).toBe(0);
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('redirects and clears storage when the server rejects a tampered token', async () => {
    const storage = installStorage({ msscc_access_token: 'header.payload.tampered' });
    renderLayout();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(storage.length).toBe(0);
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('renders the admin content for a valid token', async () => {
    installStorage({ msscc_access_token: VALID_TOKEN });
    renderLayout();

    expect(await screen.findByText('admin content')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

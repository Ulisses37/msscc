/**
 * @jest-environment jsdom
 *
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand components/layout/PublicNavbar.test.tsx
 */

import '@testing-library/jest-dom';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslations } from 'next-intl';

import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';

import { PublicNavbar } from './PublicNavbar';

type Locale = 'en' | 'ja';

interface MockLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  href: string;
}

const mockNavigate = jest.fn();
let mockLocale: Locale = 'en';
let mockPathname = '/';

jest.mock('next-intl', () => ({
  useTranslations: jest.fn(),
}));

jest.mock('@/i18n/routing', () => ({
  Link: ({ children, href, onClick, ...props }: MockLinkProps) => {
    const localizedHref = href === '/' ? `/${mockLocale}` : `/${mockLocale}${href}`;

    return (
      <a
        {...props}
        href={localizedHref}
        onClick={(event) => {
          event.preventDefault();
          mockNavigate(localizedHref);
          onClick?.(event);
        }}
      >
        {children}
      </a>
    );
  },
  usePathname: () => mockPathname,
}));

const messagesByLocale = {
  en: enMessages.Navbar,
  ja: jaMessages.Navbar,
};

const expectedLinks = {
  en: [
    [enMessages.Navbar.home, '/en'],
    [enMessages.Navbar.events, '/en/events'],
    [enMessages.Navbar.support, '/en/support'],
    [enMessages.Navbar.membership, '/en/membership'],
    [enMessages.Navbar.about, '/en/about'],
    [enMessages.Navbar.partners, '/en/partners'],
  ],
  ja: [
    [jaMessages.Navbar.home, '/ja'],
    [jaMessages.Navbar.events, '/ja/events'],
    [jaMessages.Navbar.support, '/ja/support'],
    [jaMessages.Navbar.membership, '/ja/membership'],
    [jaMessages.Navbar.about, '/ja/about'],
    [jaMessages.Navbar.partners, '/ja/partners'],
  ],
} as const;

const activeRouteCases = [
  ['en', '/en', '/', enMessages.Navbar.home],
  ['en', '/en/about', '/about', enMessages.Navbar.about],
  ['en', '/en/events', '/events', enMessages.Navbar.events],
  ['en', '/en/events/history', '/events/history', enMessages.Navbar.events],
  ['en', '/en/support', '/support', enMessages.Navbar.support],
  ['en', '/en/membership', '/membership', enMessages.Navbar.membership],
  ['en', '/en/partners', '/partners', enMessages.Navbar.partners],
  ['ja', '/ja', '/', jaMessages.Navbar.home],
  ['ja', '/ja/about', '/about', jaMessages.Navbar.about],
  ['ja', '/ja/events', '/events', jaMessages.Navbar.events],
  ['ja', '/ja/events/history', '/events/history', jaMessages.Navbar.events],
  ['ja', '/ja/support', '/support', jaMessages.Navbar.support],
  ['ja', '/ja/membership', '/membership', jaMessages.Navbar.membership],
  ['ja', '/ja/partners', '/partners', jaMessages.Navbar.partners],
] as const;

function renderNavbar(locale: Locale, pathname = '/') {
  mockLocale = locale;
  mockPathname = pathname;
  const messages = messagesByLocale[locale];
  jest.mocked(useTranslations).mockReturnValue(
    ((key: keyof typeof messages) => messages[key]) as ReturnType<typeof useTranslations>,
  );

  return render(<PublicNavbar />);
}

describe('PublicNavbar', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it.each(['en', 'ja'] as const)(
    'renders every main public link with the correct %s label and localized path',
    (locale) => {
      // Tests: actual Navbar message keys and locale-aware links for every main public page.
      // Expected output: six translated links point to the matching en or ja route.
      renderNavbar(locale);

      expectedLinks[locale].forEach(([label, href]) => {
        expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
      });
    },
  );

  it.each(['en', 'ja'] as const)(
    'uses the expected localized destination when each %s navigation link is clicked',
    async (locale) => {
      // Tests: user interaction delegates every public link to localized router navigation.
      // Expected output: each click records its unchanged locale and expected public path once.
      const user = userEvent.setup();
      renderNavbar(locale);

      for (const [label, href] of expectedLinks[locale]) {
        mockNavigate.mockReset();
        await user.click(screen.getByRole('link', { name: label }));
        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith(href);
      }
    },
  );

  it.each(activeRouteCases)(
    'marks the correct link active for %s route %s',
    (locale, _localizedRoute, pathname, activeLabel) => {
      // Tests: every required localized route maps to one active main-navigation destination.
      // Expected output: only the matching link has aria-current, including Events on history.
      renderNavbar(locale, pathname);

      const activeLinks = screen.getAllByRole('link').filter(
        (link) => link.getAttribute('aria-current') === 'page',
      );

      expect(activeLinks).toHaveLength(1);
      expect(activeLinks[0]).toHaveAccessibleName(activeLabel);
    },
  );

  it('opens and closes the localized mobile menu with accessible state updates', async () => {
    // Tests: the Japanese mobile toggle, aria attributes, and conditional mobile link list.
    // Expected output: the menu starts closed, opens with six ja links, and closes on a second click.
    const user = userEvent.setup();
    renderNavbar('ja', '/events');

    const menuButton = screen.getByRole('button', { name: jaMessages.Navbar.menu });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'public-mobile-menu');
    expect(document.getElementById('public-mobile-menu')).not.toBeInTheDocument();

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const mobileMenu = document.getElementById('public-mobile-menu');
    expect(mobileMenu).toBeInTheDocument();
    expect(within(mobileMenu as HTMLElement).getAllByRole('link')).toHaveLength(6);
    expect(
      within(mobileMenu as HTMLElement).getByRole('link', { name: jaMessages.Navbar.events }),
    ).toHaveAttribute('href', '/ja/events');

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('public-mobile-menu')).not.toBeInTheDocument();
  });

  it('closes the mobile menu after the public pathname changes', async () => {
    // Tests: navigation-triggered pathname updates collapse the mobile menu automatically.
    // Expected output: rerendering on /support closes the menu and resets aria-expanded to false.
    const user = userEvent.setup();
    const { rerender } = renderNavbar('en', '/events');
    const menuButton = screen.getByRole('button', { name: enMessages.Navbar.menu });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    mockPathname = '/support';
    rerender(<PublicNavbar />);

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('public-mobile-menu')).not.toBeInTheDocument();
  });

  it('does not expose admin-only destinations in public navigation', () => {
    // Tests: public navigation stays separate from protected admin navigation.
    // Expected output: no admin dashboard, permissions, documentation, or media links appear.
    renderNavbar('en');

    ['Admin', 'Dashboard', 'Permissions', 'Documentation', 'Media'].forEach((label) => {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });
});
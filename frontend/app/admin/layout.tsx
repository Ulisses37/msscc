'use client'

import { Banner } from '@/components/layout/Banner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { usePathname, useRouter } from 'next/navigation';
import { AdminNavbar } from "@/components/layout/AdminNavbar";
import { AdminFooter } from "@/components/layout/AdminFooter";
import { hasPermission } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks, adminSubPages } from '@/config/adminNavLinks';
import { verifySession } from '@/context/verifySession';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

const DASHBOARD = '/admin/dashboard';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const isDashboard = pathname === DASHBOARD;
  const [urlChecked, setUrlChecked] = useState(false);

  useEffect(() => {
    let cancelled = false; // ignore stale results if the user navigates mid-request
    setUrlChecked(false);

    (async () => {
      // 1. Ask the backend whether the token is real
      const session = await verifySession();
      if (cancelled) return;

      if (!session.ok) {
        if (session.reason === 'network') {
          router.replace('/'); // server unreachable: leave, but don't wipe a possibly valid session
        } else {
          logout(); // clears storage and state, redirects to '/'
        }
        return;
      }

      // 2. /admin itself redirects server-side to the dashboard
      if (pathname === '/admin') {
        setUrlChecked(true);
        return;
      }

      // 3. Find the matching nav link / subpage
      const currentLink =
        adminNavLinks.find((link) => link.href === pathname) ??
        adminSubPages.find((link) => pathname.startsWith(link.href));

      if (!currentLink) {
        router.replace(DASHBOARD);
        return;
      }

      // 4. Permission check using the verified token claims, not msscc_user
      const eligible = hasPermission({
        adminPermissions: session.user.permissionData,
        permissionNeeded: currentLink.label,
        isExecutive: session.user.isExecutive ?? false,
      });

      if (!eligible) {
        if (pathname === DASHBOARD) logout(); // can't see the dashboard: out, no loop
        else router.replace(DASHBOARD);
        return;
      }

      setUrlChecked(true);
    })();

    return () => { cancelled = true; };
  }, [pathname, router, logout]);

  if (!urlChecked) return null;

  return (
    <div className="flex min-h-screen flex-col bg-msscc-white">
      <Banner />
      <AdminNavbar />
      <div className="border-b-2 border-msscc-pink" />
      {isDashboard && <WelcomeBanner />}
      <main className="mx-auto w-full max-w-content flex-grow px-6 py-10">
        <ProtectedRoute>{children}</ProtectedRoute>
      </main>
      <AdminFooter />
    </div>
  );
}

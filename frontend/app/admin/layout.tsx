'use client'

import { Banner } from '@/components/layout/Banner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { usePathname, useRouter } from 'next/navigation';
import { AdminNavbar } from "@/components/layout/AdminNavbar";
import { AdminFooter } from "@/components/layout/AdminFooter";
import { hasPermission } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks, adminSubPages } from '@/config/adminNavLinks';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

const DASHBOARD = '/admin/dashboard';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, user } = useAuth();
  const isDashboard = pathname === DASHBOARD;
  const [urlChecked, setUrlChecked] = useState(false);

  useEffect(() => {
    setUrlChecked(false);

    if (isLoading) return;

    if (!user) {
      router.replace('/');
      return;
    }

    // 1. /admin itself redirects server-side to the dashboard
    if (pathname === '/admin') {
      setUrlChecked(true);
      return;
    }

    // 2. Find the matching nav link / subpage
    const currentLink =
      adminNavLinks.find((link) => link.href === pathname) ??
      adminSubPages.find((link) => pathname.startsWith(link.href));

    if (!currentLink) {
      router.replace(DASHBOARD);
      return;
    }

    // 3. Use claims restored from the protected refresh-token session.
    const eligible = hasPermission({
      adminPermissions: user.permissionData,
      permissionNeeded: currentLink.label,
      isExecutive: user.isExecutive,
    });

    if (!eligible) {
      router.replace(DASHBOARD);
      return;
    }

    setUrlChecked(true);
  }, [isLoading, pathname, router, user]);

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

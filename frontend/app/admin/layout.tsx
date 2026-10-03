'use client'

import { Banner } from '@/components/layout/Banner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { usePathname, redirect } from 'next/navigation';
import { AdminNavbar } from "@/components/layout/AdminNavbar";
import { AdminFooter } from "@/components/layout/AdminFooter";
import { fetchLocalStorageAdmin, hasPermission } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks, adminSubPages } from '@/config/adminNavLinks';
import { useEffect, useState } from 'react';

export default function AdminLayout({
                                      children,
                                    }: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isDashboard = pathname === '/admin/dashboard';
  const [urlChecked, setUrlChecked] = useState(false);

  useEffect(() => {
      if (pathname != "/admin"){
        let currentLink = adminNavLinks.find((link) => link.href === pathname); //returns if link is in navbar

        if (!currentLink) { // page is not in navbar but is subpage
          currentLink = adminSubPages.find((link) => pathname.startsWith(link.href));
        }

        if (!currentLink) redirect ('/admin'); // page is not real (or not added to \frontend\config\adminNavLinks.ts)

        const localAdmin = fetchLocalStorageAdmin();

        const eligible = hasPermission ({
          adminPermissions: localAdmin?.permissionData,
          permissionNeeded: currentLink.label,
          isExecutive: localAdmin?.isExecutive ?? false,
        })

        if (!eligible) redirect('/admin');
      }
    setUrlChecked(true);
  }, [pathname]);

  if(!urlChecked) return null;

  return (
    <div className="flex min-h-screen flex-col bg-msscc-white">
      <Banner />
      <AdminNavbar />

      <div className="border-b-2 border-msscc-pink" />



      {isDashboard && <WelcomeBanner />}

      <main className="mx-auto w-full max-w-content flex-grow px-6 py-10">
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </main>
      <AdminFooter />
    </div>
  );
}

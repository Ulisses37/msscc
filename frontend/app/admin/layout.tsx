'use client'

import { Banner } from '@/components/layout/Banner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { usePathname, redirect } from 'next/navigation';
import { AdminNavbar } from "@/components/layout/AdminNavbar";
import { AdminFooter } from "@/components/layout/AdminFooter";
import { fetchLocalStorageAdmin, hasPermission } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks, adminSubLinks } from '@/config/adminNavLinks';

export default function AdminLayout({
                                      children,
                                    }: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isDashboard = pathname === '/admin/dashboard';

  if (pathname != "/admin"){
    let currentLink = adminNavLinks.find((link) => link.href === pathname); // check if page is in navbar

    if (!currentLink) { // page is not in navbar but is subpage
      currentLink = adminSubLinks.find((link) => pathname.startsWith(link.href));
    }

    if (!currentLink) redirect('/admin'); // page is not real

    const localAdmin = fetchLocalStorageAdmin();
    const eligible = hasPermission ({
      adminPermissions: localAdmin?.permissionData,
      permissionNeeded: currentLink.label,
      isExecutive: localAdmin?.isExecutive ?? false,
    })
    if (!eligible) redirect('/admin');
  }


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

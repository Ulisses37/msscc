'use client'

import { Banner } from '@/components/layout/Banner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { usePathname, useRouter } from 'next/navigation';
import { AdminNavbar } from "@/components/layout/AdminNavbar";
import { AdminFooter } from "@/components/layout/AdminFooter";
import { fetchLocalStorageAdmin, hasPermission } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks } from '@/config/adminNavLinks';
import { useEffect } from 'react';

export default function AdminLayout({
                                      children,
                                    }: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isDashboard = pathname === '/admin/dashboard';
  const router = useRouter();

  useEffect(() => {
    console.log(pathname);
    verifyPermissions({pathname: pathname, router: router});
  }, [pathname]);

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

function verifyPermissions(
  {
    pathname,
    router,
  } : {
    pathname: string;
    router: ReturnType<typeof useRouter>
  }
){
  // If link does not exist
  const currentLink = adminNavLinks.find((link) => link.href === pathname);
  if (!currentLink){
    router.push("/admin");
    return false;
  }

  // check if page link is eligible for this admin
  const eligible = hasPermission(
    {
      adminPermissions: fetchLocalStorageAdmin()?.permissionData,
      permissionNeeded: currentLink.label
      })

  if (!eligible) router.push("/admin");
}

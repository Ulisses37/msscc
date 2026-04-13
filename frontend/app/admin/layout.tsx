'use client'

import { Banner } from '@/components/layout/Banner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { usePathname } from 'next/navigation';
import { AdminNavbar } from "@/components/layout/AdminNavbar";
import { AdminFooter } from "@/components/layout/AdminFooter";

export default function AdminLayout({
                                      children,
                                    }: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isDashboard = pathname === '/admin/dashboard';

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

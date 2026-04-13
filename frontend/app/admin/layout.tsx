import { AdminNavbar } from '@/components/layout/AdminNavbar';
// may be changed to admin banner eventually
import { Banner } from '@/components/layout/Banner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Story 212: Renders below the admin banner */}
      <Banner />
      <AdminNavbar />

      <main className="flex-1 p-8 bg-gray-50">
        {children}
      </main>
    </div>
  );
}

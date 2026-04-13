import { Banner } from '@/components/layout/Banner';

export default function AdminLayout({
                                      children,
                                    }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-msscc-white">
      <Banner />

      <div className="border-b-2 border-msscc-pink" />

      <main className="mx-auto w-full max-w-content flex-grow px-6 py-10">
        {children}
      </main>
    </div>
  );
}

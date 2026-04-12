import { Banner } from '@/components/layout/Banner';

export default function AdminLayout({
                                      children,
                                    }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Banner />
      <main>{children}</main>
    </>
  );
}

// frontend/components/layout/AdminFooter.tsx
import Link from 'next/link';

export const AdminFooter = () => {
  // Start with compact mobile padding and restore a roomier footer on desktop.
  return (
    <footer className="mt-auto w-full bg-msscc-pink px-4 py-3 text-white md:px-8 md:py-5">
      {/* Stack tightly on phones; place copyright and links side by side from `sm`. */}
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 sm:flex-row sm:justify-between sm:gap-4">
        <div className="text-caption font-medium sm:text-body-sm">
          © {new Date().getFullYear()} Admin Portal
        </div>
        
        <nav aria-label="Admin footer navigation" className="flex flex-wrap justify-center gap-x-4 gap-y-1 sm:gap-x-6">
          <Link 
            href="/admin/documentation" 
            className="text-caption !text-white transition-colors hover:underline sm:text-body-sm"
          >
            Documentation
          </Link>
          <Link 
            href="/admin/help" 
            className="text-caption !text-white transition-colors hover:underline sm:text-body-sm"
          >
            Help Support
          </Link>
        </nav>
      </div>
    </footer>
  );
};

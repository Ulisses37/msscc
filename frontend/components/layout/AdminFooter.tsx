// frontend/components/layout/AdminFooter.tsx
import Link from 'next/link';

export const AdminFooter = () => {
  return (
    <footer className="w-full bg-msscc-pink text-white py-6 px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-sm font-medium">
          © {new Date().getFullYear()} Admin Portal
        </div>
        
        <nav className="flex gap-6">
          <Link 
            href="/admin/documentation" 
            className="text-sm hover:underline hover:text-pink-100 transition-colors"
          >
            Documentation
          </Link>
          <Link 
            href="#" 
            className="text-sm hover:underline hover:text-pink-100 transition-colors"
          >
            Help Support
          </Link>
        </nav>
      </div>
    </footer>
  );
};
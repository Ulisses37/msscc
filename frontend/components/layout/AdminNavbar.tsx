'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavLinks } from '@/config/adminNavLinks';

export const AdminNavbar = () => {
  const pathname = usePathname();

  return (
    /* bg-pink-500 provides the pink background, justify-center centers the links */
    <nav className="w-full bg-pink-500">
      <div className="container mx-auto flex h-16 items-center justify-center space-x-8 px-4">
        {adminNavLinks.map((link) => {
          const isActive = 
            pathname === link.href || 
            (link.href !== '/admin' && pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm font-medium transition-colors hover:text-white ${
                isActive
                  ? 'text-white border-b-2 border-white pb-1'   
                  : 'text-white'                                      
              }`}

            >
              {link.label}

              {isActive && (
                <span className="absolute bottom-0 left-0 w-full border-b-[1.5px] border-white" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
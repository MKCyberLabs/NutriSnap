'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, UserCircle, Settings, Bell } from 'lucide-react';
import { getAuthSession, clearAuthSession } from '@/lib/auth-mock';
import { useEffect, useState } from 'react';
import { User } from '@/lib/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Partial<User> | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    setUser(session);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    clearAuthSession();
    router.push('/');
  };

  if (pathname === '/') return null;

  return (
    <nav className="glass-nav sticky top-0 z-50 w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            N
          </div>
          <span className="text-xl font-bold tracking-tight text-primary">NutriSnap</span>
        </Link>

        <div className="flex items-center gap-4">
          {user?.role === 'ADMIN' && (
            <Link href="/admin">
              <Button variant="ghost" className="hidden md:flex gap-2 rounded-xl">
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[100px] truncate">{user?.name || 'User'}</span>
          </div>
          
          {/* New Settings Link replaces both the modal and the old bell icon */}
          <Link href="/settings">
            <Button variant="outline" size="icon" aria-label="Settings" className="rounded-full h-10 w-10 border-white/40 hover:bg-white/40 text-primary">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>

          <Button variant="outline" size="icon" aria-label="Log out" onClick={handleLogout} className="rounded-full h-10 w-10 border-white/40 hover:bg-white/40">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

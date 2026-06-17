
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, UserCircle, Settings } from 'lucide-react';
import { getAuthSession, clearAuthSession } from '@/lib/auth-mock';
import { useEffect, useState } from 'react';
import { User } from '@/lib/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getAuthSession());
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/');
  };

  if (pathname === '/') return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-headline font-bold text-lg">
            N
          </div>
          <span className="font-headline text-xl font-bold tracking-tight text-primary">NutriSnap</span>
        </Link>

        <div className="flex items-center gap-4">
          {user?.role === 'ADMIN' && (
            <Link href="/admin">
              <Button variant="ghost" className="hidden md:flex gap-2">
                <Settings className="h-4 w-4" />
                Admin Panel
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-sm font-medium">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[100px] truncate">{user?.name || 'User'}</span>
          </div>
          <Button variant="outline" size="icon" onClick={handleLogout} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

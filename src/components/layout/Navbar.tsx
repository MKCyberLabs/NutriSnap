'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, UserCircle, Settings, Droplets } from 'lucide-react';
import { getAuthSession, clearAuthSession } from '@/lib/auth-mock';
import { useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { SettingsModal } from '@/components/SettingsModal';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Partial<User> | null>(null);

  const isHydration = pathname.startsWith('/hydration');

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

  // Show toggle only on dashboard or hydration pages
  const showToggle = pathname === '/dashboard' || pathname.startsWith('/hydration');

  return (
    <nav className="glass-nav sticky top-0 z-50 w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${isHydration ? 'bg-sky-500 shadow-sky-500/20' : 'bg-primary shadow-primary/20'}`}>
            {isHydration ? <Droplets className="h-5 w-5" /> : 'N'}
          </div>
          <span className={`text-xl font-bold tracking-tight ${isHydration ? 'text-sky-600' : 'text-primary'}`}>NutriSnap</span>
        </Link>

        {/* Center: NutriSnap / Hydration Hub Toggle */}
        {showToggle && (
          <div className="hidden md:flex bg-white rounded-full p-1 shadow-sm border border-gray-100">
            <Link href="/dashboard">
              <button className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!isHydration ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 opacity-60 hover:opacity-100'}`}>
                NutriSnap
              </button>
            </Link>
            <Link href="/hydration">
              <button className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${isHydration ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 opacity-60 hover:opacity-100'}`}>
                Hydration Hub
              </button>
            </Link>
          </div>
        )}

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
          
          <SettingsModal>
            <Button variant="outline" size="icon" aria-label="Settings" className={`rounded-full h-10 w-10 border-white/40 hover:bg-white/40 ${isHydration ? 'text-sky-500' : 'text-primary'}`}>
              <Settings className="h-4 w-4" />
            </Button>
          </SettingsModal>

          <Button variant="outline" size="icon" aria-label="Log out" onClick={handleLogout} className="rounded-full h-10 w-10 border-white/40 hover:bg-white/40">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

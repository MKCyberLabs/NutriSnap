'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  UserCircle,
  Settings,
  Calendar,
  Utensils,
  Droplets,
  Wallet,
  Bell,
  Plus
} from 'lucide-react';
import { getAuthSession, clearAuthSession } from '@/lib/auth-mock';
import { useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { SettingsModal } from '@/components/SettingsModal';
import { MODULE_REGISTRY, NavItem } from '@/lib/navigation';
import { QuickAddModal } from '@/components/quick-add/QuickAddModal';

function getNavIcon(iconName: NavItem['iconName'], className: string) {
  switch (iconName) {
    case 'Calendar':
      return <Calendar className={className} aria-hidden="true" />;
    case 'Utensils':
      return <Utensils className={className} aria-hidden="true" />;
    case 'Droplets':
      return <Droplets className={className} aria-hidden="true" />;
    case 'Wallet':
      return <Wallet className={className} aria-hidden="true" />;
    case 'Bell':
      return <Bell className={className} aria-hidden="true" />;
    default:
      return null;
  }
}

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

  const isItemActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    }
    return pathname === path || (path !== '/' && pathname.startsWith(path + '/'));
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="glass-nav sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto flex h-16 items-center justify-between px-3 sm:px-4">
          {/* Logo */}
          <Link
            href="/today"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
            aria-label="NutriSnap Home"
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg bg-primary shadow-primary/20 shrink-0">
              N
            </div>
            <span className="text-xl font-bold tracking-tight text-primary hidden xs:inline">
              NutriSnap
            </span>
          </Link>

          {/* Desktop Navigation Modules */}
          <div className="hidden md:flex items-center gap-1 bg-gray-100/90 p-1 rounded-full border border-gray-200/60 shadow-inner">
            {MODULE_REGISTRY.map((item) => {
              const active = isItemActive(item.path);
              return (
                <Link
                  key={item.key}
                  href={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active
                      ? 'bg-white text-primary shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  {getNavIcon(item.iconName, 'h-3.5 w-3.5')}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Actions & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Add Button */}
            <QuickAddModal>
              <Button
                size="sm"
                className="rounded-full gap-1.5 h-8 sm:h-9 px-3 text-xs bg-primary text-white hover:bg-primary/90 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Open Quick Add Modal"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline font-semibold">Quick Add</span>
              </Button>
            </QuickAddModal>

            {user?.role === 'ADMIN' && (
              <Button asChild variant="ghost" size="sm" className="hidden lg:flex gap-1.5 rounded-xl text-xs">
                <Link href="/admin">
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                  Admin
                </Link>
              </Button>
            )}

            <div className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 bg-white/60 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm">
              <UserCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="max-w-[90px] truncate">{user?.name || 'User'}</span>
            </div>

            <SettingsModal>
              <Button
                variant="outline"
                size="icon"
                aria-label="Settings"
                className="rounded-full h-8 w-8 sm:h-9 sm:w-9 border-gray-200 text-gray-700 hover:bg-gray-100"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Button>
            </SettingsModal>

            <Button
              variant="outline"
              size="icon"
              aria-label="Log out"
              onClick={handleLogout}
              className="rounded-full h-8 w-8 sm:h-9 sm:w-9 border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (360px viewport tested, no horizontal overflow) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg px-1 py-1 safe-bottom"
      >
        <div className="flex items-center justify-around w-full max-w-md mx-auto">
          {MODULE_REGISTRY.map((item) => {
            const active = isItemActive(item.path);
            return (
              <Link
                key={item.key}
                href={item.path}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active
                    ? 'text-primary font-bold'
                    : 'text-gray-500 hover:text-gray-900 font-medium'
                }`}
              >
                {getNavIcon(item.iconName, `h-5 w-5 ${active ? 'text-primary' : 'text-gray-500'}`)}
                <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

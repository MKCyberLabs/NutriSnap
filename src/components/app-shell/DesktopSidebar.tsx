'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  House,
  Utensils,
  Droplets,
  WalletCards,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { Brand } from '@/components/design-system/Brand';
import { clearAuthSession } from '@/lib/auth-mock';
import { User } from '@/lib/types';

interface DesktopSidebarProps {
  user: Partial<User> | null;
}

export function DesktopSidebar({ user }: DesktopSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    clearAuthSession();
    router.push('/');
  };

  const isMoneyActive = pathname.startsWith('/finance');

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <aside
      className="hidden md:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 bg-white border-r border-[#E5ECE8] z-30 select-none justify-between"
      aria-label="Main Navigation"
    >
      {/* Top region: Logo & Navigation */}
      <div className="flex flex-col">
        {/* Brand header */}
        <div className="h-[72px] px-5 flex items-center border-b border-[#E5ECE8]/60">
          <Brand size="md" href="/today" />
        </div>

        {/* Primary nav items */}
        <nav className="p-3 space-y-1 text-sm font-medium">
          {/* Today */}
          <Link
            href="/today"
            className={`flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${
              pathname === '/today'
                ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold'
                : 'text-[#344054] hover:bg-[#F7FAF8] hover:text-[#111827]'
            }`}
          >
            <House className={`h-4 w-4 shrink-0 ${pathname === '/today' ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
            <span>Today</span>
          </Link>

          {/* Food */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${
              pathname.startsWith('/dashboard')
                ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold'
                : 'text-[#344054] hover:bg-[#F7FAF8] hover:text-[#111827]'
            }`}
          >
            <Utensils className={`h-4 w-4 shrink-0 ${pathname.startsWith('/dashboard') ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
            <span>Food</span>
          </Link>

          {/* Water */}
          <Link
            href="/hydration"
            className={`flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${
              pathname.startsWith('/hydration')
                ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold'
                : 'text-[#344054] hover:bg-[#F7FAF8] hover:text-[#111827]'
            }`}
          >
            <Droplets className={`h-4 w-4 shrink-0 ${pathname.startsWith('/hydration') ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
            <span>Water</span>
          </Link>

          {/* Money (Parent Group) */}
          <div className="space-y-0.5">
            <Link
              href="/finance"
              className={`flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${
                isMoneyActive
                  ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold'
                  : 'text-[#344054] hover:bg-[#F7FAF8] hover:text-[#111827]'
              }`}
            >
              <WalletCards className={`h-4 w-4 shrink-0 ${isMoneyActive ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
              <span>Money</span>
            </Link>

            {/* Money sub-links (Indented 28px) */}
            <div className="pl-7 pr-1 space-y-0.5 pt-0.5">
              <Link
                href="/finance"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance'
                    ? 'text-[#0F7A38] font-semibold bg-[#EAF8EF]/60'
                    : 'text-[#667085] hover:text-[#111827] hover:bg-[#F7FAF8]'
                }`}
              >
                Overview
              </Link>
              <Link
                href="/finance/accounts"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/accounts'
                    ? 'text-[#0F7A38] font-semibold bg-[#EAF8EF]/60'
                    : 'text-[#667085] hover:text-[#111827] hover:bg-[#F7FAF8]'
                }`}
              >
                Accounts
              </Link>
              <Link
                href="/finance/transactions"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/transactions'
                    ? 'text-[#0F7A38] font-semibold bg-[#EAF8EF]/60'
                    : 'text-[#667085] hover:text-[#111827] hover:bg-[#F7FAF8]'
                }`}
              >
                Transactions
              </Link>
              <Link
                href="/finance/bills"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/bills'
                    ? 'text-[#0F7A38] font-semibold bg-[#EAF8EF]/60'
                    : 'text-[#667085] hover:text-[#111827] hover:bg-[#F7FAF8]'
                }`}
              >
                Bills &amp; Subscriptions
              </Link>
            </div>
          </div>

          {/* Reminders */}
          <Link
            href="/reminders"
            className={`flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${
              pathname.startsWith('/reminders')
                ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold'
                : 'text-[#344054] hover:bg-[#F7FAF8] hover:text-[#111827]'
            }`}
          >
            <Bell className={`h-4 w-4 shrink-0 ${pathname.startsWith('/reminders') ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
            <span>Reminders</span>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${
              pathname.startsWith('/settings')
                ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold'
                : 'text-[#344054] hover:bg-[#F7FAF8] hover:text-[#111827]'
            }`}
          >
            <Settings className={`h-4 w-4 shrink-0 ${pathname.startsWith('/settings') ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
            <span>Settings</span>
          </Link>
        </nav>
      </div>

      {/* Bottom region: Admin + Profile footer */}
      <div className="p-3 border-t border-[#E5ECE8] space-y-2">
        {user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors ${
              pathname.startsWith('/admin')
                ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold'
                : 'text-[#344054] hover:bg-[#F7FAF8] hover:text-[#111827]'
            }`}
          >
            <ShieldCheck className={`h-4 w-4 shrink-0 ${pathname.startsWith('/admin') ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
            <span>Admin</span>
          </Link>
        )}

        {/* User Card & Logout */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-[10px] bg-[#F7FAF8] border border-[#E5ECE8]/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-[#16A34A]/10 text-[#0F7A38] font-bold text-xs flex items-center justify-center shrink-0 border border-[#C3EAD0]">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#111827] truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-[10px] text-[#667085] truncate">
                {user?.role === 'ADMIN' ? 'Administrator' : user?.email || 'Active'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#EF4444] hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

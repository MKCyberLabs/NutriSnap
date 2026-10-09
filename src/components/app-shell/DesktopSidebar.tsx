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
      className="hidden md:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 bg-white border-r border-[#E2E8F0] z-30 select-none justify-between"
      aria-label="Main Navigation"
    >
      {/* Top region: Logo & Navigation */}
      <div className="flex flex-col">
        {/* Brand header */}
        <div className="h-[72px] px-5 flex items-center border-b border-[#E2E8F0]">
          <Brand size="md" href="/today" />
        </div>

        {/* Primary nav items */}
        <nav className="p-3 space-y-1 text-sm font-medium">
          {/* Today */}
          <Link
            href="/today"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              pathname === '/today'
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:bg-[#F5F3FF] hover:text-[#1E293B]'
            }`}
          >
            <House className={`h-4 w-4 shrink-0 ${pathname === '/today' ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
            <span>Today</span>
          </Link>

          {/* Food */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              pathname.startsWith('/dashboard')
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:bg-[#F5F3FF] hover:text-[#1E293B]'
            }`}
          >
            <Utensils className={`h-4 w-4 shrink-0 ${pathname.startsWith('/dashboard') ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
            <span>Food</span>
          </Link>

          {/* Water */}
          <Link
            href="/hydration"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              pathname.startsWith('/hydration')
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:bg-[#F5F3FF] hover:text-[#1E293B]'
            }`}
          >
            <Droplets className={`h-4 w-4 shrink-0 ${pathname.startsWith('/hydration') ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
            <span>Water</span>
          </Link>

          {/* Money (Parent Group) */}
          <div className="space-y-0.5">
            <Link
              href="/finance"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                isMoneyActive
                  ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                  : 'text-[#64748B] hover:bg-[#F5F3FF] hover:text-[#1E293B]'
              }`}
            >
              <WalletCards className={`h-4 w-4 shrink-0 ${isMoneyActive ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
              <span>Money</span>
            </Link>

            {/* Money sub-links (Indented 28px) */}
            <div className="pl-7 pr-1 space-y-0.5 pt-0.5 border-l border-[#E2E8F0] ml-5">
              <Link
                href="/finance"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance'
                    ? 'text-[#6D28D9] font-semibold bg-[#F5F3FF]'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F5F3FF]'
                }`}
              >
                Overview
              </Link>
              <Link
                href="/finance/accounts"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/accounts'
                    ? 'text-[#6D28D9] font-semibold bg-[#F5F3FF]'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F5F3FF]'
                }`}
              >
                Accounts
              </Link>
              <Link
                href="/finance/transactions"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/transactions'
                    ? 'text-[#6D28D9] font-semibold bg-[#F5F3FF]'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F5F3FF]'
                }`}
              >
                Transactions
              </Link>
              <Link
                href="/finance/bills"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/bills'
                    ? 'text-[#6D28D9] font-semibold bg-[#F5F3FF]'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F5F3FF]'
                }`}
              >
                Bills &amp; Subscriptions
              </Link>
              <Link
                href="/finance/loans"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/loans'
                    ? 'text-[#6D28D9] font-semibold bg-[#F5F3FF]'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F5F3FF]'
                }`}
              >
                Loans &amp; EMIs
              </Link>
              <Link
                href="/finance/debts"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/debts'
                    ? 'text-[#6D28D9] font-semibold bg-[#F5F3FF]'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F5F3FF]'
                }`}
              >
                Friends &amp; Family
              </Link>
              <Link
                href="/finance/wishlist"
                className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pathname === '/finance/wishlist'
                    ? 'text-[#6D28D9] font-semibold bg-[#F5F3FF]'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F5F3FF]'
                }`}
              >
                Wishlist
              </Link>
            </div>
          </div>

          {/* Reminders */}
          <Link
            href="/reminders"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              pathname.startsWith('/reminders')
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:bg-[#F5F3FF] hover:text-[#1E293B]'
            }`}
          >
            <Bell className={`h-4 w-4 shrink-0 ${pathname.startsWith('/reminders') ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
            <span>Reminders</span>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              pathname.startsWith('/settings')
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:bg-[#F5F3FF] hover:text-[#1E293B]'
            }`}
          >
            <Settings className={`h-4 w-4 shrink-0 ${pathname.startsWith('/settings') ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
            <span>Settings</span>
          </Link>
        </nav>
      </div>

      {/* Bottom region: Admin + Profile footer */}
      <div className="p-3 border-t border-[#E2E8F0] space-y-2">
        {user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              pathname.startsWith('/admin')
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:bg-[#F5F3FF] hover:text-[#1E293B]'
            }`}
          >
            <ShieldCheck className={`h-4 w-4 shrink-0 ${pathname.startsWith('/admin') ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
            <span>Admin</span>
          </Link>
        )}

        {/* User Card & Logout */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FAFAFC] border border-[#E2E8F0]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-[#F5F3FF] text-[#6D28D9] font-bold text-xs flex items-center justify-center shrink-0 border border-[#DDD6FE]">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#1E293B] truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-[10px] text-[#64748B] truncate">
                {user?.role === 'ADMIN' ? 'Administrator' : user?.email || 'Active'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  MoreHorizontal,
  User as UserIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { clearAuthSession } from '@/lib/auth-mock';
import { User } from '@/lib/types';

interface MobileMoreSheetProps {
  user: Partial<User> | null;
  isActive: boolean;
}

export function MobileMoreSheet({ user, isActive }: MobileMoreSheetProps) {
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

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${
            isActive
              ? 'text-[#6D28D9] font-bold'
              : 'text-[#64748B] hover:text-[#1E293B] font-medium'
          }`}
          aria-label="More navigation options"
        >
          <MoreHorizontal className={`h-5 w-5 ${isActive ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
          <span className="text-[11px] mt-0.5 tracking-tight">More</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[20px] bg-white p-5 border-t border-[#E2E8F0] max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left pb-3 border-b border-[#E2E8F0]">
          <SheetTitle className="text-base font-semibold text-[#1E293B]">
            More Options
          </SheetTitle>
        </SheetHeader>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 mt-3 rounded-xl bg-[#FAFAFC] border border-[#E2E8F0]">
          <div className="h-10 w-10 rounded-full bg-[#F5F3FF] text-[#6D28D9] font-bold text-sm flex items-center justify-center shrink-0 border border-[#DDD6FE]">
            {getInitials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#1E293B] truncate">
              {user?.name || 'User'}
            </div>
            <div className="text-xs text-[#64748B] truncate">
              {user?.email || (user?.role === 'ADMIN' ? 'Administrator' : 'Active Account')}
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="py-3 space-y-1 text-sm font-medium">
          <SheetClose asChild>
            <Link
              href="/reminders"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F3FF] text-[#1E293B] transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[#1E293B]">Reminders</div>
                <div className="text-xs text-[#64748B]">Health &amp; finance schedules</div>
              </div>
            </Link>
          </SheetClose>

          <SheetClose asChild>
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F3FF] text-[#1E293B] transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-[#F1F5F9] text-[#64748B] flex items-center justify-center shrink-0">
                <Settings className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[#1E293B]">Settings</div>
                <div className="text-xs text-[#64748B]">Profile, notifications &amp; telegram</div>
              </div>
            </Link>
          </SheetClose>

          {user?.role === 'ADMIN' && (
            <SheetClose asChild>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F3FF] text-[#1E293B] transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[#1E293B]">Admin Management</div>
                  <div className="text-xs text-[#64748B]">Manage users and access</div>
                </div>
              </Link>
            </SheetClose>
          )}
        </div>

        {/* Logout */}
        <div className="pt-2 border-t border-[#E2E8F0]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#DC2626] bg-[#FEF2F2]/60 hover:bg-[#FEF2F2] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

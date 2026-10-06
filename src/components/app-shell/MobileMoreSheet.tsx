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
          className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] ${
            isActive
              ? 'text-[#0F7A38] font-bold'
              : 'text-[#667085] hover:text-[#111827] font-medium'
          }`}
          aria-label="More navigation options"
        >
          <MoreHorizontal className={`h-5 w-5 ${isActive ? 'text-[#16A34A]' : 'text-[#667085]'}`} />
          <span className="text-[11px] mt-0.5 tracking-tight">More</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[20px] bg-white p-5 border-t border-[#E5ECE8] max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left pb-3 border-b border-[#E5ECE8]">
          <SheetTitle className="text-base font-semibold text-[#111827]">
            More Options
          </SheetTitle>
        </SheetHeader>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 mt-3 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8]">
          <div className="h-10 w-10 rounded-full bg-[#16A34A]/10 text-[#0F7A38] font-bold text-sm flex items-center justify-center shrink-0 border border-[#C3EAD0]">
            {getInitials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#111827] truncate">
              {user?.name || 'User'}
            </div>
            <div className="text-xs text-[#667085] truncate">
              {user?.email || (user?.role === 'ADMIN' ? 'Administrator' : 'Active Account')}
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="py-3 space-y-1 text-sm font-medium">
          <SheetClose asChild>
            <Link
              href="/reminders"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F7FAF8] text-[#344054] transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-[#EAF8EF] text-[#16A34A] flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[#111827]">Reminders</div>
                <div className="text-xs text-[#667085]">Health &amp; finance schedules</div>
              </div>
            </Link>
          </SheetClose>

          <SheetClose asChild>
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F7FAF8] text-[#344054] transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-[#EAF3FF] text-[#2F80ED] flex items-center justify-center shrink-0">
                <Settings className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[#111827]">Settings</div>
                <div className="text-xs text-[#667085]">Profile, notifications &amp; telegram</div>
              </div>
            </Link>
          </SheetClose>

          {user?.role === 'ADMIN' && (
            <SheetClose asChild>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F7FAF8] text-[#344054] transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-[#FFF4DF] text-[#F59E0B] flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[#111827]">Admin Management</div>
                  <div className="text-xs text-[#667085]">Manage users and access</div>
                </div>
              </Link>
            </SheetClose>
          )}
        </div>

        {/* Logout */}
        <div className="pt-2 border-t border-[#E5ECE8]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#EF4444] bg-[#FDECEC]/50 hover:bg-[#FDECEC] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

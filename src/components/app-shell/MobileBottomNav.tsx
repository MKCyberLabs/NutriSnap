'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  Utensils,
  Droplets,
  WalletCards,
} from 'lucide-react';
import { MobileMoreSheet } from './MobileMoreSheet';
import { User } from '@/lib/types';

interface MobileBottomNavProps {
  user: Partial<User> | null;
}

export function MobileBottomNav({ user }: MobileBottomNavProps) {
  const pathname = usePathname();

  const isToday = pathname === '/today';
  const isFood = pathname.startsWith('/dashboard');
  const isWater = pathname.startsWith('/hydration');
  const isMoney = pathname.startsWith('/finance');
  const isMoreActive =
    pathname.startsWith('/reminders') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/admin');

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-[0_-2px_6px_rgba(15,23,42,0.03)] px-1 py-1 safe-bottom h-16 flex items-center justify-around"
    >
      {/* 1. Today */}
      <Link
        href="/today"
        aria-current={isToday ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${
          isToday
            ? 'text-[#6D28D9] font-bold'
            : 'text-[#64748B] hover:text-[#1E293B] font-medium'
        }`}
      >
        <House className={`h-5 w-5 ${isToday ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
        <span className="text-[11px] mt-0.5 tracking-tight">Today</span>
      </Link>

      {/* 2. Food */}
      <Link
        href="/dashboard"
        aria-current={isFood ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${
          isFood
            ? 'text-[#6D28D9] font-bold'
            : 'text-[#64748B] hover:text-[#1E293B] font-medium'
        }`}
      >
        <Utensils className={`h-5 w-5 ${isFood ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
        <span className="text-[11px] mt-0.5 tracking-tight">Food</span>
      </Link>

      {/* 3. Water */}
      <Link
        href="/hydration"
        aria-current={isWater ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${
          isWater
            ? 'text-[#6D28D9] font-bold'
            : 'text-[#64748B] hover:text-[#1E293B] font-medium'
        }`}
      >
        <Droplets className={`h-5 w-5 ${isWater ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
        <span className="text-[11px] mt-0.5 tracking-tight">Water</span>
      </Link>

      {/* 4. Money */}
      <Link
        href="/finance"
        aria-current={isMoney ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${
          isMoney
            ? 'text-[#6D28D9] font-bold'
            : 'text-[#64748B] hover:text-[#1E293B] font-medium'
        }`}
      >
        <WalletCards className={`h-5 w-5 ${isMoney ? 'text-[#6D28D9]' : 'text-[#64748B]'}`} />
        <span className="text-[11px] mt-0.5 tracking-tight">Money</span>
      </Link>

      {/* 5. More */}
      <MobileMoreSheet user={user} isActive={isMoreActive} />
    </nav>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { getAuthSession } from '@/lib/auth-mock';
import { User } from '@/lib/types';

interface AppShellProps {
  children: React.ReactNode;
  contentClassName?: string;
}

export function AppShell({ children, contentClassName = '' }: AppShellProps) {
  const [user, setUser] = useState<Partial<User> | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    setUser(session);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7FAF8] flex flex-col md:flex-row text-[#111827] antialiased">
      {/* Desktop Sidebar: 232px persistent */}
      <DesktopSidebar user={user} />

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <MobileTopBar user={user} />

        {/* Content canvas */}
        <main
          className={`flex-1 px-4 sm:px-6 md:px-7 py-6 max-w-[1440px] w-full mx-auto pb-24 md:pb-8 ${contentClassName}`}
        >
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <MobileBottomNav user={user} />
      </div>
    </div>
  );
}

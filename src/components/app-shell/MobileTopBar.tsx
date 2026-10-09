'use client';

import React from 'react';
import { Brand } from '@/components/design-system/Brand';
import { QuickAddModal } from '@/components/quick-add/QuickAddModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { User } from '@/lib/types';

interface MobileTopBarProps {
  user: Partial<User> | null;
}

export function MobileTopBar({ user }: MobileTopBarProps) {
  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-4 h-14 flex items-center justify-between">
      <Brand size="sm" href="/today" />

      <div className="flex items-center gap-2">
        <QuickAddModal>
          <Button
            size="sm"
            className="rounded-full gap-1 h-8 px-2.5 text-xs bg-[#6D28D9] text-white hover:bg-[#5B21B6] shadow-xs"
            aria-label="Quick Add"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="font-semibold text-xs">Add</span>
          </Button>
        </QuickAddModal>

        <div
          className="h-8 w-8 rounded-full bg-[#F5F3FF] text-[#6D28D9] font-bold text-xs flex items-center justify-center shrink-0 border border-[#DDD6FE]"
          title={user?.name || 'User'}
          aria-label="User profile"
        >
          {getInitials(user?.name)}
        </div>
      </div>
    </header>
  );
}

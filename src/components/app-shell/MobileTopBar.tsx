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
    <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5ECE8] px-4 h-14 flex items-center justify-between">
      <Brand size="sm" href="/today" />

      <div className="flex items-center gap-2">
        <QuickAddModal>
          <Button
            size="sm"
            className="rounded-full gap-1 h-8 px-2.5 text-xs bg-[#16A34A] text-white hover:bg-[#0F7A38] shadow-xs"
            aria-label="Quick Add"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="font-semibold text-xs">Add</span>
          </Button>
        </QuickAddModal>

        <div
          className="h-8 w-8 rounded-full bg-[#16A34A]/10 text-[#0F7A38] font-bold text-xs flex items-center justify-center shrink-0 border border-[#C3EAD0]"
          title={user?.name || 'User'}
          aria-label="User profile"
        >
          {getInitials(user?.name)}
        </div>
      </div>
    </header>
  );
}

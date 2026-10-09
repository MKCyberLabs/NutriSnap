'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  ReceiptText,
  Users,
  BadgePercent,
  Sparkles,
} from 'lucide-react';

export function FinanceTabs() {
  const pathname = usePathname();

  const tabs = [
    {
      label: 'Overview',
      href: '/finance',
      active: pathname === '/finance',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: 'Accounts',
      href: '/finance/accounts',
      active: pathname === '/finance/accounts',
      icon: <Landmark className="h-4 w-4" />,
    },
    {
      label: 'Transactions',
      href: '/finance/transactions',
      active: pathname === '/finance/transactions',
      icon: <ArrowLeftRight className="h-4 w-4" />,
    },
    {
      label: 'Bills & Subscriptions',
      href: '/finance/bills',
      active: pathname === '/finance/bills',
      icon: <ReceiptText className="h-4 w-4" />,
    },
    {
      label: 'Friends & Family',
      href: '/finance/debts',
      active: pathname === '/finance/debts',
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Loans & EMI',
      href: '/finance/loans',
      active: pathname === '/finance/loans',
      icon: <BadgePercent className="h-4 w-4" />,
    },
    {
      label: 'Wishlist',
      href: '/finance/wishlist',
      active: pathname === '/finance/wishlist',
      icon: <Sparkles className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#E2E8F0] overflow-x-auto max-w-full shadow-xs mb-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${
            tab.active
              ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold shadow-xs'
              : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F8FAFC]'
          }`}
        >
          <span className={tab.active ? 'text-[#6D28D9]' : 'text-[#64748B]'}>
            {tab.icon}
          </span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  ReceiptText,
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
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#E5ECE8] overflow-x-auto max-w-full shadow-xs mb-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] ${
            tab.active
              ? 'bg-[#EAF8EF] text-[#0F7A38] font-semibold shadow-xs'
              : 'text-[#667085] hover:text-[#111827] hover:bg-[#F7FAF8]'
          }`}
        >
          <span className={tab.active ? 'text-[#16A34A]' : 'text-[#667085]'}>
            {tab.icon}
          </span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </div>
  );
}

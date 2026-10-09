import React from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/design-system/SectionCard';
import { MoneyAmount } from '@/components/design-system/MoneyAmount';
import { EmptyState } from '@/components/design-system/EmptyState';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  ReceiptText,
  ChevronRight,
} from 'lucide-react';
import { TodayRecentTransaction } from '@/app/today/actions';
import { format, parseISO } from 'date-fns';

interface RecentTransactionsProps {
  transactions: TodayRecentTransaction[];
  loading?: boolean;
}

export function RecentTransactions({
  transactions,
  loading = false,
}: RecentTransactionsProps) {
  const getIconAndStyle = (type: string) => {
    switch (type) {
      case 'INCOME':
        return {
          icon: <ArrowUpRight className="h-4 w-4" />,
          bg: 'bg-[#ECFDF5] text-[#059669]',
          moneyType: 'INCOME' as const,
        };
      case 'TRANSFER':
        return {
          icon: <ArrowLeftRight className="h-4 w-4" />,
          bg: 'bg-[#F5F3FF] text-[#6D28D9]',
          moneyType: 'TRANSFER' as const,
        };
      case 'EXPENSE':
      default:
        return {
          icon: <ArrowDownRight className="h-4 w-4" />,
          bg: 'bg-[#FEF2F2] text-[#DC2626]',
          moneyType: 'EXPENSE' as const,
        };
    }
  };

  return (
    <SectionCard
      title="Recent Transactions"
      description="Latest financial activity across your accounts"
      action={
        <Link
          href="/finance/transactions"
          className="text-xs font-semibold text-[#6D28D9] hover:text-[#5B21B6] inline-flex items-center gap-1 transition-colors"
        >
          <span>View all</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
      }
      className="h-full flex flex-col justify-between"
    >
      {loading ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-[#E2E8F0] rounded-lg" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 bg-[#E2E8F0] rounded" />
                  <div className="h-2.5 w-16 bg-[#F1F5F9] rounded" />
                </div>
              </div>
              <div className="h-4 w-16 bg-[#E2E8F0] rounded" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" />}
          title="No recent transactions"
          description="Log income, expenses or transfers to see them recorded here."
          className="py-8"
        />
      ) : (
        <div className="divide-y divide-[#E2E8F0]">
          {transactions.map((tx) => {
            const style = getIconAndStyle(tx.type);
            let formattedDate = '';
            try {
              formattedDate = format(parseISO(tx.occurredAt), 'dd MMM, hh:mm a');
            } catch {
              formattedDate = tx.occurredAt;
            }

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 px-1 hover:bg-[#F5F3FF] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}
                    aria-hidden="true"
                  >
                    {style.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#1E293B] truncate">
                      {tx.note || tx.category}
                    </div>
                    <div className="text-xs text-[#64748B] truncate mt-0.5">
                      {tx.accountName} • {formattedDate}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right pl-3">
                  <MoneyAmount
                    amount={tx.amount}
                    type={style.moneyType}
                    showSign={true}
                    size="sm"
                  />
                  <div className="text-[10px] text-[#64748B] capitalize">
                    {tx.category}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

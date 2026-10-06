import React from 'react';
import { MoneyAmount } from '@/components/design-system/MoneyAmount';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TransactionRowProps {
  transaction: {
    id: string;
    type: string;
    amount: string | number;
    category: string;
    occurredAt: string | Date;
    note?: string | null;
    account?: { name: string } | null;
    transferAccount?: { name: string } | null;
  };
  onDelete?: (id: string) => void;
}

export function TransactionRow({ transaction, onDelete }: TransactionRowProps) {
  const getStyle = (type: string) => {
    switch (type) {
      case 'INCOME':
        return {
          icon: <ArrowUpRight className="h-4 w-4" />,
          bg: 'bg-[#EAF8EF] text-[#16A34A]',
          moneyType: 'INCOME' as const,
        };
      case 'TRANSFER':
        return {
          icon: <ArrowLeftRight className="h-4 w-4" />,
          bg: 'bg-[#EAF3FF] text-[#2F80ED]',
          moneyType: 'TRANSFER' as const,
        };
      case 'EXPENSE':
      default:
        return {
          icon: <ArrowDownRight className="h-4 w-4" />,
          bg: 'bg-[#FDECEC] text-[#EF4444]',
          moneyType: 'EXPENSE' as const,
        };
    }
  };

  const style = getStyle(transaction.type);

  let formattedDate = '';
  try {
    const d = typeof transaction.occurredAt === 'string'
      ? parseISO(transaction.occurredAt)
      : transaction.occurredAt;
    formattedDate = format(d, 'dd MMM yyyy, hh:mm a');
  } catch {
    formattedDate = String(transaction.occurredAt);
  }

  const accountText = transaction.type === 'TRANSFER' && transaction.transferAccount
    ? `${transaction.account?.name || 'Account'} → ${transaction.transferAccount.name}`
    : transaction.account?.name || 'Account';

  return (
    <div className="flex items-center justify-between py-3.5 px-3 hover:bg-[#F7FAF8] rounded-xl transition-colors group">
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${style.bg}`}
          aria-hidden="true"
        >
          {style.icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#111827] truncate">
            {transaction.note || transaction.category}
          </div>
          <div className="text-xs text-[#667085] truncate mt-0.5">
            {accountText} • {formattedDate}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 pl-3">
        <div className="text-right">
          <MoneyAmount
            amount={transaction.amount}
            type={style.moneyType}
            showSign={true}
            size="sm"
          />
          <div className="text-[10px] text-[#667085] capitalize">
            {transaction.category}
          </div>
        </div>

        {onDelete && (
          <button
            onClick={() => onDelete(transaction.id)}
            aria-label="Delete transaction"
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC] transition-all focus-visible:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

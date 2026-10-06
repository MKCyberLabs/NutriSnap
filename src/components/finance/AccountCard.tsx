import React from 'react';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount, formatIndianRupees } from '@/components/design-system/MoneyAmount';
import {
  Landmark,
  Banknote,
  Wallet,
  CreditCard,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreditCardDialog } from '@/components/finance/CreditCardDialog';

interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: string;
    institution?: string | null;
    currentBalance: string | number;
    creditLimit?: string | number | null;
    isArchived?: boolean;
  };
  accounts?: { id: string; name: string; type: string }[];
  onArchive?: (id: string) => void;
  onRefresh?: () => void;
}

export function AccountCard({ account, accounts, onArchive, onRefresh }: AccountCardProps) {
  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'BANK':
        return <Landmark className="h-4 w-4" />;
      case 'CASH':
        return <Banknote className="h-4 w-4" />;
      case 'CREDIT_CARD':
        return <CreditCard className="h-4 w-4" />;
      case 'WALLET':
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const getPillTone = (type: string) => {
    switch (type) {
      case 'BANK':
        return 'blue' as const;
      case 'CASH':
        return 'green' as const;
      case 'CREDIT_CARD':
        return 'amber' as const;
      case 'WALLET':
      default:
        return 'neutral' as const;
    }
  };

  const isCreditCard = account.type === 'CREDIT_CARD';

  return (
    <div className="rounded-[14px] border border-[#E5ECE8] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] flex flex-col justify-between hover:shadow-[0_6px_18px_rgba(16,24,40,0.06)] transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8] flex items-center justify-center text-[#344054]">
              {getAccountIcon(account.type)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111827] leading-tight">
                {account.name}
              </h3>
              {account.institution && (
                <p className="text-xs text-[#667085] mt-0.5">
                  {account.institution}
                </p>
              )}
            </div>
          </div>
          <StatusPill
            label={account.type.replace('_', ' ')}
            tone={getPillTone(account.type)}
          />
        </div>

        <div className="mt-4 pt-3 border-t border-[#E5ECE8]/60">
          <div className="text-xs text-[#667085]">Current Balance</div>
          <div className="text-2xl font-bold tracking-tight text-[#111827] mt-1">
            <MoneyAmount
              amount={account.currentBalance}
              size="lg"
            />
          </div>

          {isCreditCard && account.creditLimit && (
            <div className="text-xs text-[#667085] mt-1.5 flex items-center gap-1.5">
              <span>Credit Limit:</span>
              <span className="font-semibold text-[#344054]">
                ₹{formatIndianRupees(account.creditLimit)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E5ECE8]/60 flex items-center justify-between">
        {isCreditCard ? (
          <CreditCardDialog
            account={account}
            accounts={accounts || []}
            onRefresh={onRefresh}
          />
        ) : <div />}

        {onArchive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(account.id)}
            className="text-xs text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC]/50 h-8 px-2.5 rounded-lg flex items-center gap-1.5"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archive</span>
          </Button>
        )}
      </div>
    </div>
  );
}

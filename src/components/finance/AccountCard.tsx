import React from 'react';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount, formatIndianRupees } from '@/components/design-system/MoneyAmount';
import {
  Landmark,
  Banknote,
  Wallet,
  CreditCard,
  Archive,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreditCardDialog } from '@/components/finance/CreditCardDialog';

export interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: string;
    institution?: string | null;
    openingBalance?: string | number;
    currentBalance: string | number;
    creditLimit?: string | number | null;
    amountUsed?: string | number | null;
    availableCredit?: string | number | null;
    statementDay?: number | null;
    paymentDueDay?: number | null;
    defaultPaymentAccountId?: string | null;
    isArchived?: boolean;
  };
  accounts?: { id: string; name: string; type: string }[];
  onArchive?: (id: string) => void;
  onRefresh?: () => void;
  onEdit?: (account: any) => void;
}

export function AccountCard({ account, accounts, onArchive, onRefresh, onEdit }: AccountCardProps) {
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

  // Credit Card metrics derivation
  const creditLimitNum = account.creditLimit !== undefined && account.creditLimit !== null
    ? parseFloat(String(account.creditLimit))
    : null;

  // Amount used: ledger transactions (card expenses increase used, payments decrease used)
  const amountUsedNum = account.amountUsed !== undefined && account.amountUsed !== null
    ? parseFloat(String(account.amountUsed))
    : -parseFloat(String(account.currentBalance || 0));

  // Available credit: limit - used
  const availableCreditNum = account.availableCredit !== undefined && account.availableCredit !== null
    ? parseFloat(String(account.availableCredit))
    : (creditLimitNum !== null ? creditLimitNum - amountUsedNum : null);

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] flex flex-col justify-between hover:border-[#8B5CF6] transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9]">
              {getAccountIcon(account.type)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B] leading-tight">
                {account.name}
              </h3>
              {account.institution && (
                <p className="text-xs text-[#64748B] mt-0.5">
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

        <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
          {!isCreditCard ? (
            <>
              <div className="text-xs text-[#64748B]">Current Balance</div>
              <div className="text-2xl font-bold tracking-tight text-[#1E293B] mt-1">
                <MoneyAmount
                  amount={account.currentBalance}
                  size="lg"
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-[#64748B]">Amount Used / Outstanding</div>
                <div className="text-2xl font-bold tracking-tight text-[#1E293B] mt-1 flex items-baseline gap-2">
                  <MoneyAmount
                    amount={amountUsedNum >= 0 ? amountUsedNum : 0}
                    size="lg"
                  />
                  {amountUsedNum < 0 && (
                    <span className="text-xs font-normal text-[#059669]">
                      (Surplus: ₹{formatIndianRupees(Math.abs(amountUsedNum))})
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2E8F0] text-xs">
                <div>
                  <div className="text-[#64748B]">Credit Limit</div>
                  <div className="font-semibold text-[#1E293B] mt-0.5">
                    {creditLimitNum !== null ? `₹${formatIndianRupees(creditLimitNum)}` : 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B]">Available Credit</div>
                  <div
                    className={`font-semibold mt-0.5 ${
                      availableCreditNum !== null && availableCreditNum < 0
                        ? 'text-[#DC2626]'
                        : 'text-[#059669]'
                    }`}
                  >
                    {availableCreditNum !== null ? `₹${formatIndianRupees(availableCreditNum)}` : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isCreditCard && (
            <CreditCardDialog
              account={account}
              accounts={accounts || []}
              onRefresh={onRefresh}
            />
          )}

          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(account)}
              className="text-xs text-[#64748B] hover:text-[#6D28D9] hover:bg-[#F5F3FF] h-8 px-2.5 rounded-lg flex items-center gap-1.5"
              aria-label="Edit account"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
          )}
        </div>

        {onArchive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(account.id)}
            className="text-xs text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] h-8 px-2.5 rounded-lg flex items-center gap-1.5"
            aria-label="Archive account"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archive</span>
          </Button>
        )}
      </div>
    </div>
  );
}

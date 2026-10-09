import React from 'react';
import { MoneyAmount } from '@/components/design-system/MoneyAmount';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Trash2,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TransactionForm } from '@/components/finance/TransactionForm';

export interface TransactionRowProps {
  transaction: {
    id: string;
    type: string;
    amount: string | number;
    category: string;
    occurredAt: string | Date;
    note?: string | null;
    accountId?: string;
    transferAccountId?: string | null;
    account?: { id?: string; name: string; type?: string } | null;
    transferAccount?: { id?: string; name: string; type?: string } | null;
    obligation?: { id?: string; title: string; kind: string } | null;
    obligationOccurrence?: any | null;
    loanPayment?: any | null;
    wishlistItem?: any | null;
    creditCardPayment?: any | null;
    personalDebtId?: string | null;
    isSystemManaged?: boolean;
  };
  accounts?: { id: string; name: string }[];
  onDelete?: (id: string) => void;
  onEdit?: (id: string, updatedData: any) => Promise<any> | void;
  onTransactionUpdated?: () => void;
}

export function TransactionRow({
  transaction,
  accounts = [],
  onDelete,
  onEdit,
  onTransactionUpdated,
}: TransactionRowProps) {
  const isSystemLinked = Boolean(
    transaction.isSystemManaged ||
    transaction.obligationOccurrence ||
    transaction.loanPayment ||
    transaction.wishlistItem ||
    transaction.creditCardPayment ||
    transaction.personalDebtId
  );

  const getStyle = (type: string) => {
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
    <div className="flex items-center justify-between py-3.5 px-3 hover:bg-[#F5F3FF]/40 rounded-xl transition-colors group">
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${style.bg}`}
          aria-hidden="true"
        >
          {style.icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#1E293B] truncate">
              {transaction.note || transaction.category}
            </span>
            {isSystemLinked && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] shrink-0"
                title="System-managed transaction (linked to obligation, loan, personal debt, credit card payment, or wishlist). Generic edit disabled."
              >
                <ShieldCheck className="h-2.5 w-2.5 text-[#64748B]" />
                <span>System Managed</span>
              </span>
            )}
          </div>
          <div className="text-xs text-[#64748B] truncate mt-0.5">
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
          <div className="text-[10px] text-[#64748B] capitalize">
            {transaction.category}
          </div>
        </div>

        {/* Action buttons: Edit and Delete (Accessible on mobile touch and hover on desktop) */}
        <div className="flex items-center gap-0.5">
          {onEdit && (
            isSystemLinked ? (
              <button
                type="button"
                disabled
                aria-label="Cannot edit system-managed transaction"
                title="This transaction is managed by an automated lifecycle (loan, debt, bill, card payment, or wishlist) and cannot be edited directly."
                className="p-1.5 rounded-lg text-[#CBD5E1] cursor-not-allowed"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <TransactionForm
                mode="edit"
                accounts={accounts}
                initialData={{
                  ...transaction,
                  accountId: transaction.accountId || transaction.account?.id || '',
                  transferAccountId: transaction.transferAccountId || transaction.transferAccount?.id || '',
                }}
                onSubmitAction={async (data) => {
                  return await onEdit(transaction.id, data);
                }}
                onTransactionUpdated={onTransactionUpdated}
                trigger={
                  <button
                    type="button"
                    aria-label="Edit transaction"
                    title="Edit transaction"
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg text-[#64748B] hover:text-[#6D28D9] hover:bg-[#F5F3FF] transition-all focus-visible:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                }
              />
            )
          )}

          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  aria-label="Delete transaction"
                  title="Delete transaction"
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all focus-visible:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl bg-white p-6 border border-[#E2E8F0]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base font-semibold text-[#1E293B]">Delete Transaction?</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-[#64748B]">
                    Are you sure you want to delete this transaction? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl border-[#E2E8F0]">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(transaction.id)}
                    className="bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl transition-colors"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

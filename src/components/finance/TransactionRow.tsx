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
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#111827] truncate">
              {transaction.note || transaction.category}
            </span>
            {isSystemLinked && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F2F4F7] text-[#475467] border border-[#E4E7EC] shrink-0"
                title="System-managed transaction (linked to obligation, loan, personal debt, credit card payment, or wishlist). Generic edit disabled."
              >
                <ShieldCheck className="h-2.5 w-2.5 text-[#667085]" />
                <span>System Managed</span>
              </span>
            )}
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

        {/* Action buttons: Edit and Delete */}
        <div className="flex items-center gap-0.5">
          {onEdit && (
            isSystemLinked ? (
              <button
                type="button"
                disabled
                aria-label="Cannot edit system-managed transaction"
                title="This transaction is managed by an automated lifecycle (loan, debt, bill, card payment, or wishlist) and cannot be edited directly."
                className="p-1.5 rounded-lg text-[#D0D5DD] cursor-not-allowed"
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#667085] hover:text-[#16A34A] hover:bg-[#EAF8EF] transition-all focus-visible:opacity-100"
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
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC] transition-all focus-visible:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this transaction? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-[10px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(transaction.id)}
                    className="bg-[#EF4444] hover:bg-[#B42318] text-white rounded-[10px]"
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

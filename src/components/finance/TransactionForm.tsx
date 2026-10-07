'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  TRANSACTION_CATEGORIES,
  TransactionType,
} from '@/lib/finance/finance';
import { Loader2, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export interface TransactionFormInitialData {
  id?: string;
  type?: string;
  amount?: string | number;
  category?: string;
  accountId?: string;
  transferAccountId?: string | null;
  note?: string | null;
  occurredAt?: string | Date;
  account?: { id?: string; name: string } | null;
  transferAccount?: { id?: string; name: string } | null;
}

interface TransactionFormProps {
  accounts: { id: string; name: string }[];
  mode?: 'create' | 'edit';
  initialData?: TransactionFormInitialData;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onTransactionCreated?: () => void;
  onTransactionUpdated?: () => void;
  onSubmitAction: (data: any) => Promise<any>;
  trigger?: React.ReactNode;
}

export function TransactionForm({
  accounts,
  mode = 'create',
  initialData,
  open: externalOpen,
  onOpenChange,
  onTransactionCreated,
  onTransactionUpdated,
  onSubmitAction,
  trigger,
}: TransactionFormProps) {
  const isControlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? externalOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    if (!isControlled) setInternalOpen(val);
  };

  const isEdit = mode === 'edit';
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const formatDateTimeForInput = (d?: string | Date) => {
    if (!d) return format(new Date(), "yyyy-MM-dd'T'HH:mm");
    try {
      const parsed = typeof d === 'string' ? parseISO(d) : d;
      return format(parsed, "yyyy-MM-dd'T'HH:mm");
    } catch {
      return format(new Date(), "yyyy-MM-dd'T'HH:mm");
    }
  };

  const [txType, setTxType] = useState<TransactionType>(
    (initialData?.type as TransactionType) || 'EXPENSE'
  );
  const [amount, setAmount] = useState(
    initialData?.amount !== undefined ? String(initialData.amount) : ''
  );
  const [category, setCategory] = useState(
    initialData?.category || 'Food'
  );
  const [accountId, setAccountId] = useState(
    initialData?.accountId || initialData?.account?.id || accounts[0]?.id || ''
  );
  const [transferAccountId, setTransferAccountId] = useState(
    initialData?.transferAccountId || initialData?.transferAccount?.id || ''
  );
  const [note, setNote] = useState(
    initialData?.note || ''
  );
  const [occurredAt, setOccurredAt] = useState(
    formatDateTimeForInput(initialData?.occurredAt)
  );

  useEffect(() => {
    if (open) {
      if (isEdit && initialData) {
        setTxType((initialData.type as TransactionType) || 'EXPENSE');
        setAmount(initialData.amount !== undefined ? String(initialData.amount) : '');
        setCategory(initialData.category || 'Food');
        setAccountId(initialData.accountId || initialData.account?.id || accounts[0]?.id || '');
        setTransferAccountId(initialData.transferAccountId || initialData.transferAccount?.id || '');
        setNote(initialData.note || '');
        setOccurredAt(formatDateTimeForInput(initialData.occurredAt));
      } else if (!isEdit) {
        setTxType('EXPENSE');
        setAmount('');
        setCategory('Food');
        setAccountId(accounts[0]?.id || '');
        setTransferAccountId('');
        setNote('');
        setOccurredAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      }
    }
  }, [open, isEdit, initialData, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid positive amount.',
        variant: 'destructive',
      });
      return;
    }

    if (!accountId) {
      toast({
        title: 'Account required',
        description: 'Please select an account.',
        variant: 'destructive',
      });
      return;
    }

    if (txType === 'TRANSFER') {
      if (!transferAccountId || transferAccountId === accountId) {
        toast({
          title: 'Invalid transfer destination',
          description: 'Transfer requires a distinct destination account.',
          variant: 'destructive',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const parsedOccurredAt = occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString();

      let payload: any;
      if (isEdit) {
        payload = {
          amount: parseFloat(amount).toFixed(2),
          category: txType === 'TRANSFER' ? 'Transfer' : category,
          accountId,
          note: note.trim() || undefined,
          occurredAt: parsedOccurredAt,
        };
        if (txType === 'TRANSFER') {
          payload.transferAccountId = transferAccountId;
        }
      } else {
        payload = {
          type: txType,
          amount: parseFloat(amount).toFixed(2),
          category: txType === 'TRANSFER' ? 'Transfer' : category,
          accountId,
          note: note.trim() || undefined,
          occurredAt: parsedOccurredAt,
        };
        if (txType === 'TRANSFER') {
          payload.transferAccountId = transferAccountId;
        }
      }

      const res = await onSubmitAction(payload);
      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: isEdit ? 'Transaction updated' : 'Transaction recorded',
        description: isEdit
          ? 'Transaction details updated successfully.'
          : `Successfully logged ${txType.toLowerCase()} of ₹${amount}.`,
      });

      if (!isEdit) {
        setAmount('');
        setNote('');
      }
      setOpen(false);

      if (isEdit) {
        if (onTransactionUpdated) {
          onTransactionUpdated();
        } else if (onTransactionCreated) {
          onTransactionCreated();
        }
      } else {
        if (onTransactionCreated) {
          onTransactionCreated();
        }
      }
    } catch (err: any) {
      toast({
        title: isEdit ? 'Error updating transaction' : 'Error recording transaction',
        description: err?.message || 'Could not save transaction.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isControlled && !isEdit && (
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="h-10 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add Transaction</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[440px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-lg font-semibold text-[#111827]">
            {isEdit ? 'Edit Transaction' : 'Record Transaction'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Segmented Type Picker (Create) or Type Indicator (Edit) */}
          {!isEdit ? (
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8]">
              {(['EXPENSE', 'INCOME', 'TRANSFER'] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTxType(t)}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                    txType === t
                      ? t === 'EXPENSE'
                        ? 'bg-white text-[#B42318] shadow-xs'
                        : t === 'INCOME'
                        ? 'bg-white text-[#0F7A38] shadow-xs'
                        : 'bg-white text-[#2F80ED] shadow-xs'
                      : 'text-[#667085] hover:text-[#111827]'
                  }`}
                >
                  {t.toLowerCase()}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8] text-xs">
              <span className="font-medium text-[#667085]">Transaction Type</span>
              <span
                className={`font-semibold uppercase px-2 py-0.5 rounded-md ${
                  txType === 'EXPENSE'
                    ? 'bg-[#FDECEC] text-[#B42318]'
                    : txType === 'INCOME'
                    ? 'bg-[#EAF8EF] text-[#0F7A38]'
                    : 'bg-[#EAF3FF] text-[#2F80ED]'
                }`}
              >
                {txType}
              </span>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount" className="text-xs font-semibold text-[#344054]">
              Amount (₹)
            </Label>
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-base font-semibold tabular-nums"
              required
            />
          </div>

          {/* Category (if not transfer) */}
          {txType !== 'TRANSFER' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#344054]">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl bg-white border border-[#E5ECE8]">
                  {TRANSACTION_CATEGORIES.filter((c) => c !== 'Transfer').map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-sm">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Source Account */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#344054]">
              {txType === 'TRANSFER' ? 'From Account' : 'Account'}
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} className="text-sm">
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Account (Transfer only) */}
          {txType === 'TRANSFER' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#344054]">To Account</Label>
              <Select value={transferAccountId} onValueChange={setTransferAccountId}>
                <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                  {accounts
                    .filter((acc) => acc.id !== accountId)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="text-sm">
                        {acc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date & Time */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-date" className="text-xs font-semibold text-[#344054]">
              Date & Time
            </Label>
            <Input
              id="tx-date"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              required
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-note" className="text-xs font-semibold text-[#344054]">
              Note / Description (Optional)
            </Label>
            <Input
              id="tx-note"
              type="text"
              placeholder="e.g. Lunch at cafe or Mobile recharge"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              isEdit ? 'Update Transaction' : 'Save Transaction'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

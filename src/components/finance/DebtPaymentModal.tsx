'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';

export type DebtModalMode = 'COLLECT' | 'REPAY' | 'LEND_MORE' | 'BORROW_MORE';

interface DebtPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: {
    id: string;
    counterpartyName: string;
    direction: string;
    outstandingAmount: string | number;
  } | null;
  accounts: { id: string; name: string }[];
  mode: DebtModalMode;
  onSubmit: (params: {
    debtId: string;
    amount: string;
    accountId: string;
    occurredAt?: string;
    note?: string;
  }) => Promise<any>;
  onSuccess: () => void;
}

export function DebtPaymentModal({
  open,
  onOpenChange,
  debt,
  accounts,
  mode,
  onSubmit,
  onSuccess,
}: DebtPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (!debt) return null;

  const outstandingNum = parseFloat(String(debt.outstandingAmount)) || 0;

  const getTitle = () => {
    switch (mode) {
      case 'COLLECT':
        return `Collect from ${debt.counterpartyName}`;
      case 'REPAY':
        return `Repay to ${debt.counterpartyName}`;
      case 'LEND_MORE':
        return `Lend more to ${debt.counterpartyName}`;
      case 'BORROW_MORE':
        return `Borrow more from ${debt.counterpartyName}`;
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'COLLECT':
        return 'Confirm Collection';
      case 'REPAY':
        return 'Confirm Repayment';
      case 'LEND_MORE':
        return 'Confirm Lend More';
      case 'BORROW_MORE':
        return 'Confirm Borrow More';
    }
  };

  const handleFillFull = () => {
    setAmount(outstandingNum.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a valid positive amount.', variant: 'destructive' });
      return;
    }

    if ((mode === 'COLLECT' || mode === 'REPAY') && val > outstandingNum) {
      toast({
        title: 'Amount exceeds balance',
        description: `Cannot exceed current balance of ₹${formatIndianRupees(outstandingNum)}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!accountId) {
      toast({ title: 'Account required', description: 'Please select an account.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmit({
        debtId: debt.id,
        amount: val.toFixed(2),
        accountId,
        occurredAt: new Date(occurredAt).toISOString(),
        note: note.trim() || undefined,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: 'Transaction recorded',
        description: `Successfully processed ₹${formatIndianRupees(val)}.`,
      });

      setAmount('');
      setNote('');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error processing movement',
        description: err?.message || 'Could not record debt transaction.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-base font-semibold text-[#111827]">
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {(mode === 'COLLECT' || mode === 'REPAY') && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8]">
              <span className="text-xs text-[#667085]">Outstanding Balance</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#111827]">
                  ₹{formatIndianRupees(debt.outstandingAmount)}
                </span>
                <button
                  type="button"
                  onClick={handleFillFull}
                  className="text-[11px] font-semibold text-[#16A34A] hover:underline"
                >
                  Pay full
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="movement-amount" className="text-xs font-semibold text-[#344054]">
              Amount (₹)
            </Label>
            <Input
              id="movement-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-base font-medium"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#344054]">
              {mode === 'COLLECT' || mode === 'BORROW_MORE' ? 'Deposit Into Account' : 'Pay From Account'}
            </Label>
            <Select value={accountId || accounts[0]?.id || ''} onValueChange={setAccountId}>
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

          <div className="space-y-1.5">
            <Label htmlFor="movement-date" className="text-xs font-semibold text-[#344054]">
              Date
            </Label>
            <Input
              id="movement-date"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="movement-note" className="text-xs font-semibold text-[#344054]">
              Note (optional)
            </Label>
            <Input
              id="movement-note"
              type="text"
              placeholder="e.g. GPay, cash returned, part payment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] font-semibold text-sm transition-colors mt-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              getButtonText()
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';

interface RecordEmiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: {
    id: string;
    name: string;
    lender: string;
    outstandingPrincipal: string | number;
    emiAmount?: string | number | null;
    paymentAccount?: { id: string; name: string } | null;
    emiGeneratesExpense?: boolean;
  } | null;
  accounts: { id: string; name: string }[];
  onSubmit: (params: {
    loanId: string;
    amount: string;
    accountId: string;
    principalPaid?: string;
    interestPaid?: string;
    feesPaid?: string;
    occurredAt?: string;
    note?: string;
  }) => Promise<any>;
  onSuccess: () => void;
}

export function RecordEmiModal({
  open,
  onOpenChange,
  loan,
  accounts,
  onSubmit,
  onSuccess,
}: RecordEmiModalProps) {
  const [amount, setAmount] = useState(loan?.emiAmount ? String(loan.emiAmount) : '');
  const [accountId, setAccountId] = useState(loan?.paymentAccount?.id || accounts[0]?.id || '');
  const [principalPaid, setPrincipalPaid] = useState('');
  const [interestPaid, setInterestPaid] = useState('');
  const [feesPaid, setFeesPaid] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (loan) {
      if (loan.emiAmount) setAmount(String(loan.emiAmount));
      if (loan.paymentAccount?.id) setAccountId(loan.paymentAccount.id);
    }
  }, [loan]);

  if (!loan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a valid EMI amount.', variant: 'destructive' });
      return;
    }

    if (!accountId) {
      toast({ title: 'Account required', description: 'Select a payment account.', variant: 'destructive' });
      return;
    }

    const p = parseFloat(principalPaid) || 0;
    const i = parseFloat(interestPaid) || 0;
    const f = parseFloat(feesPaid) || 0;
    if (p + i + f > val) {
      toast({
        title: 'Breakdown exceeds total',
        description: 'Sum of principal, interest and fees cannot exceed total EMI amount.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmit({
        loanId: loan.id,
        amount: val.toFixed(2),
        accountId,
        principalPaid: principalPaid ? p.toFixed(2) : undefined,
        interestPaid: interestPaid ? i.toFixed(2) : undefined,
        feesPaid: feesPaid ? f.toFixed(2) : undefined,
        occurredAt: new Date(occurredAt).toISOString(),
        note: note.trim() || undefined,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: 'EMI payment recorded',
        description: `Successfully processed ₹${formatIndianRupees(val)}.`,
      });

      setPrincipalPaid('');
      setInterestPaid('');
      setFeesPaid('');
      setNote('');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error recording EMI',
        description: err?.message || 'Could not save payment.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-base font-semibold text-[#111827]">
            Record EMI: {loan.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8]">
            <span className="text-xs text-[#667085]">Current Outstanding</span>
            <span className="text-sm font-bold text-[#111827]">
              ₹{formatIndianRupees(loan.outstandingPrincipal)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emi-amount" className="text-xs font-semibold text-[#344054]">
              Total EMI Amount (₹)
            </Label>
            <Input
              id="emi-amount"
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
            <Label className="text-xs font-semibold text-[#344054]">Debit Account</Label>
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
            <Label htmlFor="emi-date" className="text-xs font-semibold text-[#344054]">Payment Date</Label>
            <Input
              id="emi-date"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              required
            />
          </div>

          {/* Optional Principal / Interest Breakdown */}
          <div className="p-3 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8] space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
              <p className="text-xs text-[#667085] leading-relaxed">
                <strong className="text-[#344054]">Principal Breakdown (optional):</strong> Outstanding loan balance will only decrease if you enter the principal component. If left empty, payment is recorded without altering loan balance.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="space-y-1">
                <Label htmlFor="emi-principal" className="text-[11px] font-semibold text-[#344054]">
                  Principal (₹)
                </Label>
                <Input
                  id="emi-principal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={principalPaid}
                  onChange={(e) => setPrincipalPaid(e.target.value)}
                  className="h-9 rounded-lg border-[#E5ECE8] text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="emi-interest" className="text-[11px] font-semibold text-[#344054]">
                  Interest (₹)
                </Label>
                <Input
                  id="emi-interest"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={interestPaid}
                  onChange={(e) => setInterestPaid(e.target.value)}
                  className="h-9 rounded-lg border-[#E5ECE8] text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="emi-fees" className="text-[11px] font-semibold text-[#344054]">
                  Fees (₹)
                </Label>
                <Input
                  id="emi-fees"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={feesPaid}
                  onChange={(e) => setFeesPaid(e.target.value)}
                  className="h-9 rounded-lg border-[#E5ECE8] text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emi-note" className="text-xs font-semibold text-[#344054]">Note (optional)</Label>
            <Input
              id="emi-note"
              type="text"
              placeholder="e.g. October installment"
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
                Recording Payment...
              </>
            ) : (
              'Confirm EMI Payment'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

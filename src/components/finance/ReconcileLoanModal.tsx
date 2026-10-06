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
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';

interface ReconcileLoanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: {
    id: string;
    name: string;
    lender: string;
    outstandingPrincipal: string | number;
  } | null;
  onSubmit: (loanId: string, newOutstanding: string, note?: string) => Promise<any>;
  onSuccess: () => void;
}

export function ReconcileLoanModal({
  open,
  onOpenChange,
  loan,
  onSubmit,
  onSuccess,
}: ReconcileLoanModalProps) {
  const [newOutstanding, setNewOutstanding] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (loan) {
      setNewOutstanding(String(loan.outstandingPrincipal));
    }
  }, [loan]);

  if (!loan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newOutstanding);
    if (isNaN(val) || val < 0) {
      toast({ title: 'Invalid amount', description: 'Enter a valid non-negative amount.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmit(loan.id, val.toFixed(2), note.trim() || undefined);
      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: 'Outstanding reconciled',
        description: `Loan balance updated to ₹${formatIndianRupees(val)}.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error reconciling balance',
        description: err?.message || 'Could not update outstanding.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-base font-semibold text-[#111827]">
            Reconcile Outstanding: {loan.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8]">
            <span className="text-xs text-[#667085]">Current Recorded</span>
            <span className="text-sm font-bold text-[#111827]">
              ₹{formatIndianRupees(loan.outstandingPrincipal)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recon-amount" className="text-xs font-semibold text-[#344054]">
              New Outstanding Principal (₹)
            </Label>
            <Input
              id="recon-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={newOutstanding}
              onChange={(e) => setNewOutstanding(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-base font-medium"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recon-note" className="text-xs font-semibold text-[#344054]">
              Reason / Source (optional)
            </Label>
            <Input
              id="recon-note"
              type="text"
              placeholder="e.g. Bank statement verification, annual check"
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
                Updating...
              </>
            ) : (
              'Save New Balance'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

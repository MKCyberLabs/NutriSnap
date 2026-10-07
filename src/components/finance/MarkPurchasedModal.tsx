'use client';

import React, { useState, useEffect } from 'react';
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
import { Loader2, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';

interface MarkPurchasedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    name: string;
    category: string;
    targetPrice: string | number;
    plannedAccountId?: string | null;
  } | null;
  accounts: { id: string; name: string }[];
  onSubmit: (params: {
    actualPrice: string;
    accountId?: string;
    createExpense: boolean;
    purchasedAt?: string;
    note?: string;
  }) => Promise<any>;
  onSuccess: () => void;
}

export function MarkPurchasedModal({
  open,
  onOpenChange,
  item,
  accounts,
  onSubmit,
  onSuccess,
}: MarkPurchasedModalProps) {
  const [actualPrice, setActualPrice] = useState('');
  const [accountId, setAccountId] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (item) {
      setActualPrice(String(item.targetPrice));
      setAccountId(item.plannedAccountId || accounts[0]?.id || '');
      setCreateExpense(true);
      setNote(`Wishlist purchase: ${item.name}`);
      setPurchasedAt(new Date().toISOString().substring(0, 10));
    }
  }, [item, accounts]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(actualPrice);
    if (isNaN(price) || price <= 0) {
      toast({ title: 'Invalid price', description: 'Enter a valid purchase price.', variant: 'destructive' });
      return;
    }

    if (createExpense && !accountId) {
      toast({ title: 'Account required', description: 'Select an account to deduct the expense from.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        actualPrice: price.toFixed(2),
        createExpense,
        purchasedAt: new Date(purchasedAt).toISOString(),
        note: note.trim() || undefined,
      };

      if (createExpense && accountId) {
        payload.accountId = accountId;
      }

      await onSubmit(payload);

      toast({
        title: 'Marked as purchased!',
        description: `Successfully recorded purchase for "${item.name}".`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error recording purchase',
        description: err?.message || 'Could not complete action.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#111827] flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
            Mark as Purchased
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-xs text-[#667085]">Item Name</div>
            <div className="text-sm font-semibold text-[#111827] mt-0.5">{item.name}</div>
            <div className="text-xs text-[#667085] mt-1">
              Target Price: ₹{formatIndianRupees(item.targetPrice)}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#344054]">Actual Purchase Price (₹) *</Label>
            <Input
              type="number"
              step="0.01"
              value={actualPrice}
              onChange={(e) => setActualPrice(e.target.value)}
              className="mt-1 h-9 text-sm font-medium"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#344054]">Purchase Date</Label>
            <Input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className="mt-1 h-9 text-sm"
              required
            />
          </div>

          <div className="p-3 rounded-xl border border-[#E5ECE8] space-y-3 bg-white">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="createExpense"
                checked={createExpense}
                onChange={(e) => setCreateExpense(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#16A34A] focus:ring-[#16A34A]"
              />
              <label htmlFor="createExpense" className="text-xs text-[#344054] font-medium cursor-pointer">
                Record as Expense Transaction
              </label>
            </div>

            {createExpense ? (
              <div>
                <Label className="text-xs text-[#667085]">Deduct from Account *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-[#667085] mt-1.5 flex items-center gap-1">
                  <Info className="h-3 w-3 text-[#3B82F6]" />
                  <span>Deducts balance and adds to this month's expense totals.</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-[#667085] italic">
                Only marks the item purchased. No account balance or expense will be modified.
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#344054]">Note (Optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bought during festival sale"
              className="mt-1 h-9 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5ECE8]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-9 px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Confirm Purchase</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

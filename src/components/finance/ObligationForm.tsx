'use client';

import React, { useState } from 'react';
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
  OBLIGATION_KINDS,
  ObligationKind,
} from '@/lib/finance/finance';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ObligationFormProps {
  accounts: { id: string; name: string }[];
  onObligationCreated: () => void;
  onSubmitAction: (data: any) => Promise<any>;
  trigger?: React.ReactNode;
}

export function ObligationForm({
  accounts,
  onObligationCreated,
  onSubmitAction,
  trigger,
}: ObligationFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ObligationKind>('BILL');
  const [amount, setAmount] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [recurrence, setRecurrence] = useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EVERY_N_DAYS'>('MONTHLY');
  const [interval, setInterval] = useState('84');
  const [accountId, setAccountId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    if (!dueAt) {
      toast({ title: 'Due date required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        kind,
        dueAt: new Date(dueAt).toISOString(),
        recurrenceType: recurrence,
        recurrenceInterval: recurrence === 'EVERY_N_DAYS' ? parseInt(interval, 10) || 1 : undefined,
        reminderOffsetsMin: [1440, 0], // 1 day before, due day
      };

      if (amount && parseFloat(amount) > 0) {
        payload.amount = parseFloat(amount).toFixed(2);
      }

      if (accountId && accountId !== 'none') {
        payload.accountId = accountId;
      }

      const res = await onSubmitAction(payload);
      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: 'Obligation created',
        description: `Successfully scheduled "${title}".`,
      });

      setTitle('');
      setAmount('');
      setDueAt('');
      setOpen(false);
      onObligationCreated();
    } catch (err: any) {
      toast({
        title: 'Error creating obligation',
        description: err?.message || 'Could not schedule obligation.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            className="h-10 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add Bill / Obligation</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px] rounded-[18px] bg-white p-6 border border-[#E5ECE8] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-lg font-semibold text-[#111827]">
            Schedule Bill or Obligation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ob-title" className="text-xs font-semibold text-[#344054]">
              Title
            </Label>
            <Input
              id="ob-title"
              type="text"
              placeholder="e.g. Jio 84-Day Recharge, Electricity, Netflix"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              required
            />
          </div>

          {/* Kind */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#344054]">Category Kind</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                {OBLIGATION_KINDS.map((k) => (
                  <SelectItem key={k} value={k} className="text-sm">
                    {k.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount (optional for variable bills) */}
          <div className="space-y-1.5">
            <Label htmlFor="ob-amount" className="text-xs font-semibold text-[#344054]">
              Amount (₹, optional)
            </Label>
            <Input
              id="ob-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm tabular-nums"
            />
          </div>

          {/* First Due Date */}
          <div className="space-y-1.5">
            <Label htmlFor="ob-date" className="text-xs font-semibold text-[#344054]">
              Due Date / Next Billing
            </Label>
            <Input
              id="ob-date"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              required
            />
          </div>

          {/* Recurrence Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#344054]">Recurrence</Label>
            <Select value={recurrence} onValueChange={(v: any) => setRecurrence(v)}>
              <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                <SelectValue placeholder="Select recurrence" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                <SelectItem value="MONTHLY" className="text-sm">Monthly (default)</SelectItem>
                <SelectItem value="EVERY_N_DAYS" className="text-sm">Every N Days (e.g. 28 / 56 / 84)</SelectItem>
                <SelectItem value="WEEKLY" className="text-sm">Weekly</SelectItem>
                <SelectItem value="DAILY" className="text-sm">Daily</SelectItem>
                <SelectItem value="ONCE" className="text-sm">One-Time Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recurrence Interval (for EVERY_N_DAYS) */}
          {recurrence === 'EVERY_N_DAYS' && (
            <div className="space-y-1.5">
              <Label htmlFor="ob-interval" className="text-xs font-semibold text-[#344054]">
                Interval (Days)
              </Label>
              <Input
                id="ob-interval"
                type="number"
                min="1"
                placeholder="84"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
                required
              />
              <p className="text-[11px] text-[#667085]">
                Common recharge cycles: 28, 56, or 84 days.
              </p>
            </div>
          )}

          {/* Account (Optional linked account) */}
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#344054]">
                Linked Payment Account (Optional)
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                  <SelectValue placeholder="Select account (optional)" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                  <SelectItem value="none" className="text-sm">None</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="text-sm">
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              'Save Obligation'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { Loader2, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TZDate } from '@date-fns/tz';

function getUserTimezone(preferredTz?: string): string {
  if (preferredTz) return preferredTz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export function toPreservedCalendarIso(dateInput: string | Date, userTz?: string): string {
  const tz = getUserTimezone(userTz);
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new TZDate(year, month, day, 12, 0, 0, 0, tz).toISOString();
    }
  }
  return new Date(dateInput).toISOString();
}

export function formatToDateInput(dateVal: any, userTz?: string): string {
  if (!dateVal) return '';
  const tz = getUserTimezone(userTz);
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    const tzDate = new TZDate(d, tz);
    const year = tzDate.getFullYear();
    const month = String(tzDate.getMonth() + 1).padStart(2, '0');
    const day = String(tzDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    if (typeof dateVal === 'string' && dateVal.length >= 10) {
      return dateVal.substring(0, 10);
    }
    return '';
  }
}

interface DebtFormProps {
  accounts: { id: string; name: string }[];
  onDebtCreated?: () => void;
  onSubmitAction: (data: any) => Promise<any>;
  trigger?: React.ReactNode;
  debt?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DebtForm({
  accounts,
  onDebtCreated,
  onSubmitAction,
  trigger,
  debt,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: DebtFormProps) {
  const isEdit = Boolean(debt);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    if (!isControlled) setInternalOpen(val);
  };
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [direction, setDirection] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('none');
  const userTz = debt?.user?.timezone || debt?.timezone;
  const [startedAt, setStartedAt] = useState(() => formatToDateInput(new Date(), userTz));
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (debt) {
      const tz = debt.user?.timezone || debt.timezone;
      setDirection((debt.direction as any) || 'RECEIVABLE');
      setCounterpartyName(debt.counterpartyName || '');
      setTitle(debt.title || '');
      setAmount(debt.originalAmount ? String(debt.originalAmount) : '');
      setNotes(debt.notes || '');
      if (debt.startedAt) {
        setStartedAt(formatToDateInput(debt.startedAt, tz));
      }
      if (debt.dueAt) {
        setDueAt(formatToDateInput(debt.dueAt, tz));
      } else {
        setDueAt('');
      }
    }
  }, [debt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterpartyName.trim()) {
      toast({ title: 'Person name required', description: 'Enter the person name.', variant: 'destructive' });
      return;
    }

    if (!isEdit) {
      const val = parseFloat(amount);
      if (!val || val <= 0) {
        toast({ title: 'Invalid amount', description: 'Please enter a valid positive amount.', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const tz = debt?.user?.timezone || debt?.timezone;
      if (isEdit) {
        let finalDueAt: string | null = null;
        if (debt?.dueAt) {
          const originalDueStr = formatToDateInput(debt.dueAt, tz);
          if (dueAt === originalDueStr) {
            // User did not alter the date; preserve the original exact timestamp (e.g. noon UTC)
            finalDueAt = typeof debt.dueAt === 'string' ? debt.dueAt : debt.dueAt.toISOString();
          } else if (dueAt) {
            finalDueAt = toPreservedCalendarIso(dueAt, tz);
          } else {
            finalDueAt = null;
          }
        } else if (dueAt) {
          finalDueAt = toPreservedCalendarIso(dueAt, tz);
        }

        const payload: any = {
          counterpartyName: counterpartyName.trim(),
          title: title.trim() || null,
          notes: notes.trim() || null,
          dueAt: finalDueAt,
        };

        const res = await onSubmitAction(payload);
        if (res && res.error) {
          throw new Error(res.error);
        }

        toast({
          title: 'Debt record updated',
          description: `Successfully updated record for "${counterpartyName}".`,
        });

        setOpen(false);
        if (onSuccess) onSuccess();
        if (onDebtCreated) onDebtCreated();
      } else {
        const val = parseFloat(amount);
        const payload: any = {
          direction,
          counterpartyName: counterpartyName.trim(),
          title: title.trim() || undefined,
          originalAmount: val.toFixed(2),
          startedAt: startedAt ? toPreservedCalendarIso(startedAt, tz) : new Date().toISOString(),
          notes: notes.trim() || undefined,
        };

        if (dueAt) {
          payload.dueAt = toPreservedCalendarIso(dueAt, tz);
        }

        if (accountId && accountId !== 'none') {
          payload.accountId = accountId;
        }

        const res = await onSubmitAction(payload);
        if (res && res.error) {
          throw new Error(res.error);
        }

        toast({
          title: direction === 'RECEIVABLE' ? 'Receivable added' : 'Payable added',
          description: `Successfully tracked debt with "${counterpartyName}".`,
        });

        setCounterpartyName('');
        setTitle('');
        setAmount('');
        setAccountId('none');
        setDueAt('');
        setNotes('');
        setOpen(false);
        if (onSuccess) onSuccess();
        if (onDebtCreated) onDebtCreated();
      }
    } catch (err: any) {
      toast({
        title: isEdit ? 'Error updating debt record' : 'Error creating debt record',
        description: err?.message || 'Could not save record.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger asChild>
          {trigger || (
            <Button
              size="sm"
              className="h-10 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add Record</span>
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[460px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-lg font-semibold text-[#111827]">
            {isEdit ? `Edit Debt: ${debt?.counterpartyName}` : 'Add Friend / Family Debt'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Direction Segmented Control */}
          {isEdit ? (
            <div className="p-2.5 bg-[#F7FAF8] rounded-xl border border-[#E5ECE8] flex items-center justify-between">
              <span className="text-xs text-[#667085]">Debt Direction</span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                  direction === 'RECEIVABLE'
                    ? 'bg-[#EAF8EF] text-[#16A34A]'
                    : 'bg-[#FFF4DF] text-[#D97706]'
                }`}
              >
                {direction === 'RECEIVABLE' ? 'I Lent (Owed to Me)' : 'I Borrowed (I Owe)'}
              </span>
            </div>
          ) : (
            <div
              role="group"
              aria-label="Debt Direction"
              className="grid grid-cols-2 gap-2 p-1 bg-[#F7FAF8] rounded-xl border border-[#E5ECE8]"
            >
              <button
                type="button"
                aria-pressed={direction === 'RECEIVABLE'}
                onClick={() => setDirection('RECEIVABLE')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 ${
                  direction === 'RECEIVABLE'
                    ? 'bg-white text-[#16A34A] shadow-xs border border-[#E5ECE8]'
                    : 'text-[#667085] hover:text-[#111827]'
                }`}
              >
                <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>I Lent (Owed to Me)</span>
              </button>
              <button
                type="button"
                aria-pressed={direction === 'PAYABLE'}
                onClick={() => setDirection('PAYABLE')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 ${
                  direction === 'PAYABLE'
                    ? 'bg-white text-[#D97706] shadow-xs border border-[#E5ECE8]'
                    : 'text-[#667085] hover:text-[#111827]'
                }`}
              >
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>I Borrowed (I Owe)</span>
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="counterparty" className="text-xs font-semibold text-[#344054]">
              Person Name
            </Label>
            <Input
              id="counterparty"
              type="text"
              placeholder="e.g. Rahul, Arun, Mom, Ravi"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="debt-amount" className="text-xs font-semibold text-[#344054]">
              Original Amount (₹)
            </Label>
            <Input
              id="debt-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`h-11 rounded-[10px] border-[#E5ECE8] text-base font-medium ${
                isEdit ? 'bg-[#F8FAFC] text-[#64748B] cursor-not-allowed' : ''
              }`}
              required={!isEdit}
              disabled={isEdit}
            />
            {isEdit && (
              <p className="text-[11px] text-[#667085]">
                Original amount is immutable. Use Lend More / Borrow More to record additional movements.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="debt-title" className="text-xs font-semibold text-[#344054]">
              Reason / Purpose (optional)
            </Label>
            <Input
              id="debt-title"
              type="text"
              placeholder="e.g. Dinner split, medical help, travel loan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#344054]">
                Payment Account (optional)
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                  <SelectValue placeholder="Select account (optional)" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                  <SelectItem value="none" className="text-sm">
                    None (Record untracked / offline loan)
                  </SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="text-sm">
                      {acc.name} ({direction === 'RECEIVABLE' ? 'Deduct amount' : 'Add amount'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[#667085]">
                Selecting an account automatically updates its balance without affecting monthly income/expense totals.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs font-semibold text-[#344054]">
                Started Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className={`h-11 rounded-[10px] border-[#E5ECE8] text-sm ${
                  isEdit ? 'bg-[#F8FAFC] text-[#64748B] cursor-not-allowed' : ''
                }`}
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-date" className="text-xs font-semibold text-[#344054]">
                Expected Due Date (optional)
              </Label>
              <Input
                id="due-date"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="debt-notes" className="text-xs font-semibold text-[#344054]">
              Additional Notes (optional)
            </Label>
            <Input
              id="debt-notes"
              type="text"
              placeholder="e.g. Promised to return before end of month"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
                Saving...
              </>
            ) : (
              isEdit ? 'Update Record' : 'Save Record'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

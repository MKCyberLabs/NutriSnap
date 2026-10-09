import React, { useState } from 'react';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount } from '@/components/design-system/MoneyAmount';
import {
  ReceiptText,
  Smartphone,
  CreditCard,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Archive,
  RotateCcw,
  Trash2,
  Pause,
  Play,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ObligationRowProps {
  obligation: {
    id: string;
    title: string;
    kind: string;
    amount?: string | number | null;
    nextDueAt: string | Date;
    recurrenceType: string;
    recurrenceInterval?: number | null;
    lastCompletedAt?: string | Date | null;
    isActive?: boolean;
    account?: { id: string; name: string } | null;
  };
  accounts: { id: string; name: string }[];
  onMarkPaid: (params: {
    obligationId: string;
    occurrenceKey: string;
    createExpense?: boolean;
    accountId?: string;
  }) => Promise<any>;
  onPaidSuccess: () => void;
  onUndoPaid?: (params: { obligationId: string; occurrenceKey?: string }) => Promise<any>;
  onToggleActive?: (id: string, active: boolean) => Promise<any>;
  onDelete?: (id: string) => Promise<any>;
  onArchive?: (id: string) => void;
  onEdit?: (obligation: any) => void;
}

export function ObligationRow({
  obligation,
  accounts,
  onMarkPaid,
  onPaidSuccess,
  onUndoPaid,
  onToggleActive,
  onDelete,
  onArchive,
  onEdit,
}: ObligationRowProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [createExpense, setCreateExpense] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(
    obligation.account?.id || accounts[0]?.id || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleUndoPaid = async () => {
    if (!onUndoPaid) return;
    setSubmitting(true);
    try {
      const res = await onUndoPaid({ obligationId: obligation.id });
      if (res && res.error) throw new Error(res.error);
      toast({
        title: res?.alreadyReversed ? 'No active payment found' : 'Payment Undone',
        description: res?.alreadyReversed
          ? 'No active payment found to undo or already reversed.'
          : `Reverted last payment for "${obligation.title}". Next due date restored.`,
      });
      onPaidSuccess();
    } catch (err: any) {
      toast({
        title: 'Error undoing payment',
        description: err?.message || 'Could not revert payment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async () => {
    if (!onToggleActive) return;
    setSubmitting(true);
    try {
      const nextActive = !obligation.isActive;
      const res = await onToggleActive(obligation.id, nextActive);
      if (res && res.error) throw new Error(res.error);
      toast({
        title: nextActive ? 'Obligation Resumed' : 'Obligation Paused',
        description: `Obligation "${obligation.title}" is now ${nextActive ? 'active' : 'paused'}.`,
      });
      onPaidSuccess();
    } catch (err: any) {
      toast({
        title: 'Error toggling obligation',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Are you sure you want to delete "${obligation.title}"?`)) return;
    setSubmitting(true);
    try {
      const res = await onDelete(obligation.id);
      if (res && res.error) throw new Error(res.error);
      toast({
        title: 'Obligation Deleted',
        description: `Deleted "${obligation.title}".`,
      });
      onPaidSuccess();
    } catch (err: any) {
      toast({
        title: 'Cannot delete obligation',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'RECHARGE':
        return <Smartphone className="h-4 w-4" />;
      case 'CREDIT_CARD':
        return <CreditCard className="h-4 w-4" />;
      case 'RENT':
        return <Building className="h-4 w-4" />;
      case 'BILL':
      case 'SUBSCRIPTION':
      case 'EMI':
      default:
        return <ReceiptText className="h-4 w-4" />;
    }
  };

  const getRecurrenceText = () => {
    switch (obligation.recurrenceType) {
      case 'EVERY_N_DAYS':
        return `Every ${obligation.recurrenceInterval || 1} days`;
      case 'DAILY':
        return 'Daily';
      case 'WEEKLY':
        return 'Weekly';
      case 'MONTHLY':
        return 'Monthly';
      case 'ONCE':
        return 'One-time';
      default:
        return obligation.recurrenceType;
    }
  };

  let dueDate: Date;
  try {
    dueDate = typeof obligation.nextDueAt === 'string'
      ? parseISO(obligation.nextDueAt)
      : obligation.nextDueAt;
  } catch {
    dueDate = new Date();
  }

  const isPast = dueDate.getTime() < Date.now();
  const relativeText = formatDistanceToNow(dueDate, { addSuffix: true });
  const formattedDate = format(dueDate, 'dd MMM yyyy');

  // Compute occurrence key (YYYY-MM-DD in local or UTC)
  const occurrenceKey = format(dueDate, 'yyyy-MM-dd');

  const handleConfirmPaid = async () => {
    setSubmitting(true);
    try {
      const res = await onMarkPaid({
        obligationId: obligation.id,
        occurrenceKey,
        createExpense,
        accountId: createExpense ? selectedAccountId : undefined,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: 'Marked as Paid',
        description: `Obligation "${obligation.title}" marked paid for ${occurrenceKey}.`,
      });
      setModalOpen(false);
      onPaidSuccess();
    } catch (err: any) {
      toast({
        title: 'Error marking paid',
        description: err?.message || 'Could not update obligation.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-[#E5ECE8] bg-white hover:border-[#16A34A]/50 transition-colors gap-3">
      <div className="flex items-start gap-3.5 min-w-0">
        <div
          className="h-10 w-10 rounded-xl bg-[#FFF4DF] text-[#F59E0B] flex items-center justify-center shrink-0 mt-0.5"
          aria-hidden="true"
        >
          {getKindIcon(obligation.kind)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-[#111827] truncate">
              {obligation.title}
            </h4>
            <StatusPill
              label={isPast ? 'Overdue' : relativeText}
              tone={isPast ? 'red' : 'amber'}
            />
          </div>

          <div className="text-xs text-[#667085] mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[#667085]" />
              <span>Due {formattedDate}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-[#667085]" />
              <span>{getRecurrenceText()}</span>
            </span>
            {obligation.account && (
              <>
                <span>•</span>
                <span>{obligation.account.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5ECE8]/60">
        <div className="text-left sm:text-right">
          <MoneyAmount
            amount={obligation.amount}
            type="NEUTRAL"
            size="md"
          />
          <div className="text-[10px] text-[#667085] uppercase tracking-wider">
            {obligation.kind.replace('_', ' ')}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => onEdit(obligation)}
              className="h-9 w-9 p-0 rounded-[10px] text-[#667085] hover:text-[#344054] hover:bg-[#F0F5F2]"
              title="Edit obligation"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {onToggleActive && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={handleToggle}
              className="h-9 w-9 p-0 rounded-[10px] text-[#667085] hover:text-[#344054] hover:bg-[#F0F5F2]"
              title={obligation.isActive ? 'Pause obligation' : 'Resume obligation'}
            >
              {obligation.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          )}

          {onUndoPaid && obligation.lastCompletedAt && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={handleUndoPaid}
              className="h-9 px-2.5 rounded-[10px] text-xs font-semibold text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC] flex items-center gap-1"
              title="Undo last payment"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Undo Paid</span>
            </Button>
          )}

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-9 px-3 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Paid</span>
              </Button>
            </DialogTrigger>

          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={handleDelete}
              className="h-9 w-9 p-0 rounded-[10px] text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC]"
              title="Delete obligation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {onArchive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive(obligation.id)}
              className="h-9 w-9 p-0 rounded-[10px] text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC]"
              title="Archive obligation"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
          <DialogContent className="sm:max-w-[400px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
            <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
              <DialogTitle className="text-base font-semibold text-[#111827]">
                Mark as Paid: {obligation.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-3">
              <p className="text-xs text-[#667085]">
                Confirming will mark this due occurrence as paid and advance the next due date.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id={`create-exp-${obligation.id}`}
                  checked={createExpense}
                  onChange={(e) => setCreateExpense(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E5ECE8] text-[#16A34A] focus:ring-[#16A34A]"
                />
                <label
                  htmlFor={`create-exp-${obligation.id}`}
                  className="text-xs font-medium text-[#344054] cursor-pointer"
                >
                  Create linked Expense transaction (exactly once)
                </label>
              </div>

              {createExpense && accounts.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#344054]">
                    Debit Account
                  </Label>
                  <Select
                    value={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                  >
                    <SelectTrigger className="h-10 rounded-[10px] border-[#E5ECE8] text-sm">
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
              )}

              <Button
                onClick={handleConfirmPaid}
                className="w-full h-11 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Confirm Paid'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { ObligationRow } from '@/components/finance/ObligationRow';
import { ObligationForm } from '@/components/finance/ObligationForm';
import { SegmentedFilter } from '@/components/design-system/SegmentedFilter';
import { MetricCard } from '@/components/design-system/MetricCard';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getObligations,
  createObligation,
  updateObligation,
  markObligationPaid,
  revertObligationPayment,
  toggleObligationActive,
  deleteObligation,
  archiveObligation,
  updateAccount,
  recordCreditCardPayment,
} from '@/app/finance/actions';
import {
  ReceiptText,
  Info,
  ExternalLink,
  Loader2,
  CreditCard,
  CheckCircle2,
  RotateCcw,
  Calendar,
  Clock,
  Pencil,
  ArrowRightLeft,
  Pause,
  Play,
  Archive,
} from 'lucide-react';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount } from '@/components/design-system/MoneyAmount';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { TZDate } from '@date-fns/tz';

function getUserTimezone(preferredTz?: string): string {
  if (preferredTz) return preferredTz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

function getInitialPaymentDate(userTz?: string): string {
  try {
    const tz = getUserTimezone(userTz);
    const now = new TZDate(new Date(), tz);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function toPaymentDateIso(paymentDateStr: string, userTz?: string): string {
  const tz = getUserTimezone(userTz);
  if (typeof paymentDateStr === 'string') {
    const match = paymentDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new TZDate(year, month, day, 12, 0, 0, 0, tz).toISOString();
    }
  }
  return new Date(paymentDateStr).toISOString();
}

function generateRepaymentIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `cc-repay-${crypto.randomUUID()}`;
  }
  return `cc-repay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normalizes an obligation amount to its monthly recurring equivalent based on recurrenceType.
 * Excludes one-time (ONCE) obligations (returns 0).
 */
function calculateMonthlyRecurringAmount(
  amount: number | string | null | undefined,
  recurrenceType: string,
  recurrenceInterval?: number | null
): number {
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(String(amount || '0')) || 0;
  if (!numericAmount || numericAmount <= 0) return 0;

  switch (recurrenceType) {
    case 'MONTHLY':
      return numericAmount;
    case 'YEARLY':
      return numericAmount / 12;
    case 'WEEKLY':
      return (numericAmount * 52) / 12;
    case 'DAILY':
      return (numericAmount * 365) / 12;
    case 'EVERY_N_DAYS': {
      const days = recurrenceInterval && recurrenceInterval > 0 ? recurrenceInterval : 1;
      return (numericAmount * (365 / days)) / 12;
    }
    case 'ONCE':
    default:
      return 0;
  }
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function BillsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [filter, setFilter] = useState<'UPCOMING' | 'ALL'>('UPCOMING');
  const [editingObligation, setEditingObligation] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [repayingStatementObligation, setRepayingStatementObligation] = useState<any | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [accs, obs] = await Promise.all([
        getAccounts(userId),
        getObligations(userId),
      ]);
      setAccounts(accs);
      setObligations(obs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load obligations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.push('/');
      return;
    }
    if (!session.onboarded) {
      router.push('/onboarding');
      return;
    }
    loadData(session.id);
  }, [router, loadData]);

  const handleMarkPaid = async (params: any) => {
    const session = getAuthSession();
    if (!session) return;
    return await markObligationPaid(session.id, params);
  };

  const handleUndoPaid = async (params: any) => {
    const session = getAuthSession();
    if (!session) return;
    return await revertObligationPayment(session.id, params);
  };

  const handleToggleActive = async (obligationId: string, isActive: boolean) => {
    const session = getAuthSession();
    if (!session) return;
    return await toggleObligationActive(session.id, obligationId, isActive);
  };

  const handleDelete = async (obligationId: string) => {
    const session = getAuthSession();
    if (!session) return;
    return await deleteObligation(session.id, obligationId);
  };

  const handleArchive = async (obligationId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await archiveObligation(session.id, obligationId);
      toast({ title: 'Obligation archived', description: 'Hidden from active obligations.' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error archiving obligation',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const userTimezone =
    obligations.find((o) => (o as any).user?.timezone)?.user?.timezone ||
    (typeof window !== 'undefined' ? (getAuthSession() as any)?.timezone : undefined) ||
    'Asia/Kolkata';

  const activeObligations = obligations.filter((o) => o.isActive && !o.isArchived);
  const activeRecurringObligations = activeObligations.filter(
    (o) => o.recurrenceType && o.recurrenceType !== 'ONCE'
  );
  const displayedObligations = filter === 'UPCOMING'
    ? activeObligations.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime())
    : obligations;

  const filterOptions = [
    { label: 'Upcoming Active', value: 'UPCOMING', count: activeObligations.length },
    { label: 'All Registered', value: 'ALL', count: obligations.length },
  ];

  const totalMonthlyRecurring = activeObligations.reduce(
    (sum, o) => sum + calculateMonthlyRecurringAmount(o.amount, o.recurrenceType, (o as any).recurrenceInterval),
    0
  );

  const dueThisWeekCount = activeObligations.filter((o) => {
    try {
      const diff = new Date(o.nextDueAt).getTime() - Date.now();
      return diff >= 0 && diff <= 7 * 86400000;
    } catch {
      return false;
    }
  }).length;

  const annualizedBudget = totalMonthlyRecurring * 12;

  return (
    <AppShell>
      <PageHeader
        title="Bills & Subscriptions"
        description="Track upcoming dues, recurring schedules, and paid obligations"
        action={
          <ObligationForm
            accounts={accounts}
            timezone={userTimezone}
            onSubmitAction={async (data) => {
              const session = getAuthSession();
              if (session) return await createObligation(session.id, data);
            }}
            onObligationCreated={() => {
              const session = getAuthSession();
              if (session) loadData(session.id);
            }}
          />
        }
      />

      <FinanceTabs />

      {error ? (
        <ErrorState
          title="Could not load obligations"
          message={error}
          onRetry={() => {
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
          className="my-8"
        />
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} height="100px" lines={2} />
            ))}
          </div>
          <LoadingCard height="350px" lines={5} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Stats Banner: 3-Card Precision Metric Architecture */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Total Monthly Recurring"
              value={`₹${formatIndianRupees(totalMonthlyRecurring)}`}
              tone="purple"
              helperText={`${activeRecurringObligations.length} active recurring obligations`}
            />
            <MetricCard
              label="Due This Week"
              value={`${dueThisWeekCount}`}
              tone={dueThisWeekCount > 0 ? 'amber' : 'neutral'}
              helperText={dueThisWeekCount > 0 ? 'Upcoming payment due soon' : 'No dues this week'}
            />
            <MetricCard
              label="Annualized Budget Load"
              value={`₹${formatIndianRupees(annualizedBudget)}`}
              tone="neutral"
              helperText="Projected yearly recurring commitment"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SegmentedFilter
              options={filterOptions}
              selected={filter}
              onChange={(val: any) => setFilter(val)}
              size="md"
            />
            <div className="text-xs text-[#64748B]">
              {displayedObligations.length} obligation{displayedObligations.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* List */}
          {displayedObligations.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="h-6 w-6" />}
              title="No bills or subscriptions scheduled"
              description="Keep on top of your utility bills, mobile recharges, and subscriptions by scheduling them here."
              action={
                <ObligationForm
                  accounts={accounts}
                  timezone={userTimezone}
                  onSubmitAction={async (data) => {
                    const session = getAuthSession();
                    if (session) return await createObligation(session.id, data);
                  }}
                  onObligationCreated={() => {
                    const session = getAuthSession();
                    if (session) loadData(session.id);
                  }}
                />
              }
              className="py-12 bg-white"
            />
          ) : (
            <div className="space-y-3">
              {displayedObligations.map((ob) => (
                <div key={ob.id} className="space-y-1">
                  {ob.isCreditCardStatement ? (
                    <StatementBillRow
                      obligation={ob}
                      accounts={accounts}
                      onOpenRepayModal={(statementOb) => setRepayingStatementObligation(statementOb)}
                      onUndoPaid={handleUndoPaid}
                      onPaidSuccess={() => {
                        const session = getAuthSession();
                        if (session) loadData(session.id);
                      }}
                      onEdit={(obligation) => {
                        setEditingObligation(obligation);
                        setEditModalOpen(true);
                      }}
                      onToggleActive={handleToggleActive}
                      onArchive={handleArchive}
                    />
                  ) : (
                    <ObligationRow
                      obligation={ob}
                      accounts={accounts}
                      onMarkPaid={handleMarkPaid}
                      onUndoPaid={handleUndoPaid}
                      onToggleActive={handleToggleActive}
                      onDelete={handleDelete}
                      onPaidSuccess={() => {
                        const session = getAuthSession();
                        if (session) loadData(session.id);
                      }}
                      onArchive={handleArchive}
                      onEdit={(obligation) => {
                        setEditingObligation(obligation);
                        setEditModalOpen(true);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {editingObligation && (
            (editingObligation.loanId || editingObligation.loan) ? (
              <LinkedLoanObligationModal
                obligation={editingObligation}
                open={editModalOpen}
                onOpenChange={(isOpen) => {
                  setEditModalOpen(isOpen);
                  if (!isOpen) setEditingObligation(null);
                }}
                onSuccess={() => {
                  const session = getAuthSession();
                  if (session) loadData(session.id);
                  setEditingObligation(null);
                  setEditModalOpen(false);
                }}
              />
            ) : (editingObligation.isCreditCardStatement || editingObligation.creditCardStatement) ? (
              <LinkedCardStatementModal
                obligation={editingObligation}
                accounts={accounts}
                open={editModalOpen}
                onOpenChange={(isOpen) => {
                  setEditModalOpen(isOpen);
                  if (!isOpen) setEditingObligation(null);
                }}
                onSuccess={() => {
                  const session = getAuthSession();
                  if (session) loadData(session.id);
                  setEditingObligation(null);
                  setEditModalOpen(false);
                }}
              />
            ) : (
              <ObligationForm
                accounts={accounts}
                obligation={editingObligation}
                timezone={userTimezone}
                open={editModalOpen}
                onOpenChange={(isOpen) => {
                  setEditModalOpen(isOpen);
                  if (!isOpen) setEditingObligation(null);
                }}
                onSubmitAction={async (data) => {
                  const session = getAuthSession();
                  if (session && editingObligation) {
                    return await updateObligation(session.id, editingObligation.id, data);
                  }
                }}
                onSuccess={() => {
                  const session = getAuthSession();
                  if (session) loadData(session.id);
                  setEditingObligation(null);
                  setEditModalOpen(false);
                }}
              />
            )
          )}

          {repayingStatementObligation && (
            <StatementRepaymentModal
              obligation={repayingStatementObligation}
              accounts={accounts}
              open={Boolean(repayingStatementObligation)}
              onOpenChange={(isOpen) => {
                if (!isOpen) setRepayingStatementObligation(null);
              }}
              onSuccess={() => {
                const session = getAuthSession();
                if (session) loadData(session.id);
                setRepayingStatementObligation(null);
              }}
              userTimezone={userTimezone}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

interface LinkedLoanObligationModalProps {
  obligation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function LinkedLoanObligationModal({
  obligation,
  open,
  onOpenChange,
  onSuccess,
}: LinkedLoanObligationModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(obligation?.title || '');
  const [notes, setNotes] = useState(obligation?.notes || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (obligation) {
      setTitle(obligation.title || '');
      setNotes(obligation.notes || '');
    }
  }, [obligation, open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    const session = getAuthSession();
    if (!session) return;

    setSubmitting(true);
    try {
      const res: any = await updateObligation(session.id, obligation.id, {
        title: title.trim(),
        notes: notes ? notes.trim() : null,
      });
      if (res && res.error) {
        throw new Error(res.error);
      }
      toast({
        title: 'Obligation updated',
        description: `Successfully updated "${title.trim()}".`,
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error updating obligation',
        description: err?.message || 'Could not update obligation.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const loanName = obligation?.linkedLoanName || obligation?.loan?.name || 'Loan';
  const formattedDueDate = obligation?.nextDueAt
    ? new Date(obligation.nextDueAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'N/A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-[18px] bg-white p-6 border border-[#E5ECE8] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-lg font-semibold text-[#111827]">
            Edit Loan Obligation
          </DialogTitle>
        </DialogHeader>

        {/* Informational Message */}
        <div className="mt-3 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-3 text-amber-900 text-sm">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-amber-950">
              Linked Loan: <span className="underline">{loanName}</span>
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Schedule and amount are managed by the linked Loan to maintain schedule consistency.
              To change the EMI amount or payment schedule, please update the loan directly.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100 flex items-center gap-1 font-medium"
              onClick={() => {
                onOpenChange(false);
                router.push('/finance/loans');
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Manage in Loans &amp; EMIs
            </Button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Editable: Title */}
          <div>
            <Label htmlFor="linked-ob-title" className="text-xs font-semibold text-[#374151]">
              Title
            </Label>
            <Input
              id="linked-ob-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Loan EMI"
              className="mt-1"
              required
            />
          </div>

          {/* Disabled: Amount */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-[#374151]">Amount (₹)</Label>
              <span className="text-[10px] text-[#6B7280]">Managed by linked Loan</span>
            </div>
            <Input
              value={obligation?.amount ? `₹${obligation.amount}` : '₹0.00'}
              disabled
              className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Disabled: Schedule / Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#374151]">Next Due Date</Label>
              </div>
              <Input
                value={formattedDueDate}
                disabled
                className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#374151]">Recurrence</Label>
              </div>
              <Input
                value={obligation?.recurrenceType || 'MONTHLY'}
                disabled
                className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed text-xs"
              />
            </div>
          </div>

          {/* Editable: Notes */}
          <div>
            <Label htmlFor="linked-ob-notes" className="text-xs font-semibold text-[#374151]">
              Notes (Optional)
            </Label>
            <Input
              id="linked-ob-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add payment notes, reference numbers..."
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5ECE8]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#6D28D9] text-white hover:bg-[#5B21B6] rounded-xl transition-colors"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface LinkedCardStatementModalProps {
  obligation: any;
  accounts: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function LinkedCardStatementModal({
  obligation,
  accounts,
  open,
  onOpenChange,
  onSuccess,
}: LinkedCardStatementModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(obligation?.title || '');
  const [notes, setNotes] = useState(obligation?.notes || '');

  const cardAccountId = obligation?.creditCardStatement?.accountId || obligation?.account?.id || obligation?.accountId;
  const cardAccount = (accounts || []).find((acc) => acc.id === cardAccountId);
  const cardName = obligation?.creditCardStatement?.accountName || cardAccount?.name || obligation?.account?.name || 'Credit Card';

  // Filter out credit cards and the card account itself
  const eligiblePaymentAccounts = (accounts || []).filter(
    (acc) => acc.type !== 'CREDIT_CARD' && acc.id !== cardAccountId
  );

  const [defaultAccountId, setDefaultAccountId] = useState(
    cardAccount?.defaultPaymentAccountId || ''
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (obligation) {
      setTitle(obligation.title || '');
      setNotes(obligation.notes || '');
      const currentCard = (accounts || []).find(
        (acc) => acc.id === (obligation?.creditCardStatement?.accountId || obligation?.account?.id || obligation?.accountId)
      );
      setDefaultAccountId(currentCard?.defaultPaymentAccountId || '');
    }
  }, [obligation, accounts, open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    const session = getAuthSession();
    if (!session) return;

    setSubmitting(true);
    try {
      // SOL-R003-006: Preserve obligation.accountId as the card account!
      const res: any = await updateObligation(session.id, obligation.id, {
        title: title.trim(),
        notes: notes ? notes.trim() : null,
        accountId: cardAccountId || obligation.accountId,
      });
      if (res && res.error) {
        throw new Error(res.error);
      }

      // Update credit card account's defaultPaymentAccountId
      if (cardAccountId) {
        await updateAccount(session.id, cardAccountId, {
          defaultPaymentAccountId: defaultAccountId || null,
        });
      }

      toast({
        title: 'Obligation updated',
        description: `Successfully updated statement bill "${title.trim()}".`,
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error updating obligation',
        description: err?.message || 'Could not update obligation.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDueDate = obligation?.nextDueAt
    ? new Date(obligation.nextDueAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'N/A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-[18px] bg-white p-6 border border-[#E5ECE8] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-lg font-semibold text-[#111827]">
            Edit Credit Card Statement Bill
          </DialogTitle>
        </DialogHeader>

        {/* Informational Message */}
        <div className="mt-3 p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-start gap-3 text-blue-900 text-sm">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-blue-950">
              Linked Credit Card: <span className="underline">{cardName}</span>
            </p>
            <p className="text-xs text-blue-800 leading-relaxed">
              Schedule and amount are managed automatically by your credit card billing cycle and statement generator.
              To change statement dates or billing cycle, manage your card in Accounts.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs bg-white border-blue-300 text-blue-900 hover:bg-blue-100 flex items-center gap-1 font-medium"
              onClick={() => {
                onOpenChange(false);
                router.push('/finance/accounts');
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Manage in Accounts
            </Button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Editable: Title */}
          <div>
            <Label htmlFor="linked-card-title" className="text-xs font-semibold text-[#374151]">
              Title
            </Label>
            <Input
              id="linked-card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. HDFC Credit Card Bill"
              className="mt-1"
              required
            />
          </div>

          {/* Disabled: Amount */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-[#374151]">Amount Due (₹)</Label>
              <span className="text-[10px] text-[#6B7280]">Managed by Statement</span>
            </div>
            <Input
              value={obligation?.amount ? `₹${obligation.amount}` : '₹0.00'}
              disabled
              className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Disabled: Schedule / Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#374151]">Due Date</Label>
              </div>
              <Input
                value={formattedDueDate}
                disabled
                className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#374151]">Recurrence</Label>
              </div>
              <Input
                value={obligation?.recurrenceType || 'MONTHLY'}
                disabled
                className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed text-xs"
              />
            </div>
          </div>

          {/* Editable: Default Payment Account (filtered: no credit cards, not self) */}
          <div>
            <Label htmlFor="linked-card-payment-acc" className="text-xs font-semibold text-[#374151]">
              Default Payment Account
            </Label>
            <select
              id="linked-card-payment-acc"
              value={defaultAccountId}
              onChange={(e) => setDefaultAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
            >
              <option value="">None / Select on payment</option>
              {eligiblePaymentAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#6B7280]">
              Credit cards cannot be used to pay credit card bills.
            </p>
          </div>

          {/* Editable: Notes */}
          <div>
            <Label htmlFor="linked-card-notes" className="text-xs font-semibold text-[#374151]">
              Notes (Optional)
            </Label>
            <Input
              id="linked-card-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add payment notes, reference numbers..."
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5ECE8]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#6D28D9] text-white hover:bg-[#5B21B6] rounded-xl transition-colors"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface StatementBillRowProps {
  obligation: any;
  accounts: any[];
  onOpenRepayModal: (obligation: any) => void;
  onUndoPaid: (params: { obligationId: string; occurrenceKey?: string }) => Promise<any>;
  onPaidSuccess: () => void;
  onEdit: (obligation: any) => void;
  onToggleActive?: (id: string, isActive: boolean) => Promise<any>;
  onArchive?: (id: string) => void;
}

function StatementBillRow({
  obligation,
  accounts,
  onOpenRepayModal,
  onUndoPaid,
  onPaidSuccess,
  onEdit,
  onToggleActive,
  onArchive,
}: StatementBillRowProps) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const cardAccountId = obligation?.creditCardStatement?.accountId || obligation?.account?.id || obligation?.accountId;
  const cardAccount = (accounts || []).find((acc) => acc.id === cardAccountId);
  const cardName = obligation?.creditCardStatement?.accountName || cardAccount?.name || obligation?.account?.name || 'Credit Card';
  const periodKey = obligation?.creditCardStatement?.periodKey;
  const statementStatus = obligation?.creditCardStatement?.status;

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

  const handleUndo = async () => {
    setSubmitting(true);
    try {
      const res = await onUndoPaid({ obligationId: obligation.id });
      if (res && res.error) throw new Error(res.error);
      toast({
        title: 'Payment Undone',
        description: `Reverted last credit card payment for "${obligation.title}".`,
      });
      onPaidSuccess();
    } catch (err: any) {
      toast({
        title: 'Error undoing payment',
        description: err?.message || 'Could not revert credit card payment',
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
        title: nextActive ? 'Reminder Resumed' : 'Reminder Paused',
        description: `Statement bill reminder "${obligation.title}" is now ${nextActive ? 'active' : 'paused'}.`,
      });
      onPaidSuccess();
    } catch (err: any) {
      toast({
        title: 'Error toggling reminder',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF]/40 hover:border-[#6D28D9]/40 transition-colors gap-3">
      <div className="flex items-start gap-3.5 min-w-0">
        <div
          className="h-10 w-10 rounded-xl bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <CreditCard className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-[#1E293B] truncate">
              {obligation.title}
            </h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]">
              Statement Bill
            </span>
            <StatusPill
              label={isPast ? 'Overdue' : relativeText}
              tone={isPast ? 'red' : 'amber'}
            />
            {statementStatus && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                statementStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                statementStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {statementStatus}
              </span>
            )}
            {!obligation.isActive && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-gray-100 text-gray-600">
                Paused
              </span>
            )}
          </div>

          <div className="text-xs text-[#667085] mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[#667085]" />
              <span>Due {formattedDate}</span>
            </span>
            {periodKey && (
              <>
                <span>•</span>
                <span>Cycle: {periodKey}</span>
              </>
            )}
            <span>•</span>
            <span>Card: {cardName}</span>
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
          <div className="text-[10px] text-blue-700 font-medium uppercase tracking-wider">
            Statement Pending
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => onEdit(obligation)}
            className="h-9 w-9 p-0 rounded-[10px] text-[#667085] hover:text-[#344054] hover:bg-[#F0F5F2]"
            title="Edit statement bill settings"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          {onToggleActive && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={handleToggle}
              className="h-9 w-9 p-0 rounded-[10px] text-[#667085] hover:text-[#344054] hover:bg-[#F0F5F2]"
              title={obligation.isActive ? 'Pause reminder' : 'Resume reminder'}
            >
              {obligation.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          )}

          {obligation.lastCompletedAt && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={handleUndo}
              className="h-9 px-2.5 rounded-[10px] text-xs font-semibold text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC] flex items-center gap-1"
              title="Undo last statement payment"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Undo Paid</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => onOpenRepayModal(obligation)}
            className="h-9 px-3 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>Pay Statement</span>
          </Button>

          {onArchive && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => onArchive(obligation.id)}
              className="h-9 w-9 p-0 rounded-[10px] text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC]"
              title="Archive statement bill"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatementRepaymentModalProps {
  obligation: any;
  accounts: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userTimezone?: string;
}

function StatementRepaymentModal({
  obligation,
  accounts,
  open,
  onOpenChange,
  onSuccess,
  userTimezone,
}: StatementRepaymentModalProps) {
  const { toast } = useToast();
  const cardAccountId = obligation?.creditCardStatement?.accountId || obligation?.account?.id || obligation?.accountId;
  const cardAccount = (accounts || []).find((acc) => acc.id === cardAccountId);
  const cardName = obligation?.creditCardStatement?.accountName || cardAccount?.name || obligation?.account?.name || 'Credit Card';

  const eligiblePaymentAccounts = (accounts || []).filter(
    (acc) => acc.type !== 'CREDIT_CARD' && acc.id !== cardAccountId
  );

  const tz = userTimezone || obligation?.user?.timezone || 'Asia/Kolkata';
  const pendingAmount = obligation?.amount != null ? String(obligation.amount) : '0';
  const [paymentAmount, setPaymentAmount] = useState(pendingAmount);
  const [fromAccountId, setFromAccountId] = useState(
    cardAccount?.defaultPaymentAccountId && eligiblePaymentAccounts.some((a) => a.id === cardAccount.defaultPaymentAccountId)
      ? cardAccount.defaultPaymentAccountId
      : (eligiblePaymentAccounts[0]?.id || '')
  );
  const [paymentDate, setPaymentDate] = useState(() => getInitialPaymentDate(tz));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateRepaymentIdempotencyKey());

  useEffect(() => {
    if (obligation && open) {
      const pAmt = obligation?.amount != null ? String(obligation.amount) : '0';
      setPaymentAmount(pAmt);
      const foundCard = (accounts || []).find(
        (acc) => acc.id === (obligation?.creditCardStatement?.accountId || obligation?.account?.id || obligation?.accountId)
      );
      const defaultId = foundCard?.defaultPaymentAccountId;
      const validDefault = defaultId && eligiblePaymentAccounts.some((a) => a.id === defaultId);
      setFromAccountId(validDefault ? defaultId : (eligiblePaymentAccounts[0]?.id || ''));
      setPaymentDate(getInitialPaymentDate(tz));
      setNote('');
      setIdempotencyKey(generateRepaymentIdempotencyKey());
    }
  }, [obligation, accounts, open, tz]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = getAuthSession();
    if (!session) return;

    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a positive payment amount.',
        variant: 'destructive',
      });
      return;
    }

    if (!fromAccountId) {
      toast({
        title: 'Payment account required',
        description: 'Select an eligible bank, cash, or wallet account to pay from.',
        variant: 'destructive',
      });
      return;
    }

    const statementId = obligation?.creditCardStatement?.id;
    if (!statementId) {
      toast({
        title: 'Statement not found',
        description: 'Missing linked credit card statement ID.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await recordCreditCardPayment(session.id, {
        statementId,
        fromAccountId,
        amount: numAmount,
        paidAt: paymentDate ? toPaymentDateIso(paymentDate, tz) : new Date().toISOString(),
        note: note.trim() || undefined,
        idempotencyKey,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: 'Statement payment recorded',
        description: `Successfully recorded repayment of ₹${numAmount.toLocaleString('en-IN')} towards ${cardName}.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Payment failed',
        description: err?.message || 'Could not record credit card payment.',
        variant: 'destructive',
      });
      // SOL-R004-003: Preserve idempotencyKey across retries so network retries deduplicate atomically
    } finally {
      setSubmitting(false);
    }
  };

  const periodKey = obligation?.creditCardStatement?.periodKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-[18px] bg-white p-6 border border-[#E5ECE8] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-lg font-semibold text-[#111827] flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <span>Pay Statement Bill: {cardName}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Informational Box Explaining Transfer Semantics */}
        <div className="mt-3 p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-start gap-3 text-blue-900 text-sm">
          <ArrowRightLeft className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-blue-950">
              Transfer Repayment {periodKey ? `(${periodKey})` : ''}
            </p>
            <p className="text-xs text-blue-800 leading-relaxed">
              Paying a credit card bill is recorded as a <strong>transfer</strong> from your payment account to your credit card. This reduces your card balance without inflating income or expense totals.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Amount Input with partial payment support */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="statement-pay-amount" className="text-xs font-semibold text-[#374151]">
                Payment Amount (₹)
              </Label>
              <span className="text-[11px] text-blue-700 font-medium">
                Pending: ₹{pendingAmount}
              </span>
            </div>
            <Input
              id="statement-pay-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1 font-mono text-base"
              required
            />
            <p className="mt-1 text-[11px] text-[#6B7280]">
              You can pay in full or enter a partial amount to reduce the statement balance.
            </p>
          </div>

          {/* Source Account Dropdown */}
          <div>
            <Label htmlFor="statement-from-acc" className="text-xs font-semibold text-[#374151]">
              Pay From Account
            </Label>
            <select
              id="statement-from-acc"
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
              required
            >
              {eligiblePaymentAccounts.length === 0 ? (
                <option value="">No eligible payment accounts found</option>
              ) : (
                eligiblePaymentAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type}) — Balance: ₹{acc.currentBalance ?? acc.openingBalance}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-[11px] text-[#6B7280]">
              Only bank, cash, or wallet accounts can be used to pay credit card bills.
            </p>
          </div>

          {/* Payment Date */}
          <div>
            <Label htmlFor="statement-pay-date" className="text-xs font-semibold text-[#374151]">
              Payment Date
            </Label>
            <Input
              id="statement-pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          {/* Optional Notes */}
          <div>
            <Label htmlFor="statement-pay-note" className="text-xs font-semibold text-[#374151]">
              Notes (Optional)
            </Label>
            <Input
              id="statement-pay-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Online bill payment ref #1234"
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5ECE8]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#16A34A] text-white hover:bg-[#0F7A38]"
              disabled={submitting || eligiblePaymentAccounts.length === 0}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Repayment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

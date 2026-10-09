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
} from '@/app/finance/actions';
import { ReceiptText, Info, ExternalLink, Loader2, CreditCard } from 'lucide-react';
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

  const activeObligations = obligations.filter((o) => o.isActive && !o.isArchived);
  const displayedObligations = filter === 'UPCOMING'
    ? activeObligations.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime())
    : obligations;

  const filterOptions = [
    { label: 'Upcoming Active', value: 'UPCOMING', count: activeObligations.length },
    { label: 'All Registered', value: 'ALL', count: obligations.length },
  ];

  const totalMonthlyRecurring = activeObligations.reduce(
    (sum, o) => sum + (parseFloat(o.amount) || 0),
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
              helperText={`${activeObligations.length} active recurring obligations`}
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
                  {ob.isCreditCardStatement && (
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]">
                        <CreditCard className="h-3 w-3" />
                        Credit Card Statement Bill
                      </span>
                    </div>
                  )}
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
  const [defaultAccountId, setDefaultAccountId] = useState(
    obligation?.account?.id || obligation?.accountId || ''
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (obligation) {
      setTitle(obligation.title || '');
      setNotes(obligation.notes || '');
      setDefaultAccountId(obligation?.account?.id || obligation?.accountId || '');
    }
  }, [obligation, open]);

  const cardAccountId = obligation?.creditCardStatement?.accountId || obligation?.account?.id;
  const cardName = obligation?.creditCardStatement?.account?.name || obligation?.account?.name || 'Credit Card';

  // Filter out credit cards and the card account itself
  const eligiblePaymentAccounts = (accounts || []).filter(
    (acc) => acc.type !== 'CREDIT_CARD' && acc.id !== cardAccountId
  );

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
        accountId: defaultAccountId || null,
      });
      if (res && res.error) {
        throw new Error(res.error);
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

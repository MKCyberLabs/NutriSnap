'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { LoanCard } from '@/components/finance/LoanCard';
import { LoanForm } from '@/components/finance/LoanForm';
import { RecordEmiModal } from '@/components/finance/RecordEmiModal';
import { ReconcileLoanModal } from '@/components/finance/ReconcileLoanModal';
import { SegmentedFilter } from '@/components/design-system/SegmentedFilter';
import { MetricCard } from '@/components/design-system/MetricCard';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getLoans,
  createLoan,
  recordEmiPayment,
  reconcileOutstanding,
  closeLoan,
  archiveLoan,
} from '@/app/finance/actions';
import { Building2, Calendar, Landmark, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoansPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL_ACTIVE' | 'PRODUCT_CC' | 'CLOSED' | 'ALL'>('ALL_ACTIVE');

  // Modal states
  const [emiModalOpen, setEmiModalOpen] = useState(false);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [accs, allLoans] = await Promise.all([
        getAccounts(userId),
        getLoans(userId),
      ]);
      setAccounts(accs);
      setLoans(allLoans);
    } catch (err: any) {
      setError(err?.message || 'Failed to load loans and EMIs.');
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

  // Aggregate KPI metrics
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
  const totalOutstanding = activeLoans.reduce(
    (sum, l) => sum + (parseFloat(String(l.outstandingPrincipal)) || 0),
    0
  );

  const totalMonthlyEmi = activeLoans.reduce(
    (sum, l) => sum + (parseFloat(String(l.emiAmount || 0)) || 0),
    0
  );

  // Filtered loans
  const displayedLoans = loans.filter((l) => {
    if (filter === 'ALL_ACTIVE') return l.status === 'ACTIVE';
    if (filter === 'PRODUCT_CC') {
      return (
        l.status === 'ACTIVE' &&
        (l.loanType === 'PRODUCT_EMI' || l.loanType === 'CREDIT_CARD_EMI')
      );
    }
    if (filter === 'CLOSED') return l.status === 'CLOSED';
    return true;
  });

  const filterOptions = [
    {
      label: 'Active Loans',
      value: 'ALL_ACTIVE',
      count: activeLoans.length,
    },
    {
      label: 'Product & CC EMIs',
      value: 'PRODUCT_CC',
      count: activeLoans.filter(
        (l) => l.loanType === 'PRODUCT_EMI' || l.loanType === 'CREDIT_CARD_EMI'
      ).length,
    },
    {
      label: 'Closed',
      value: 'CLOSED',
      count: loans.filter((l) => l.status === 'CLOSED').length,
    },
    {
      label: 'All',
      value: 'ALL',
      count: loans.length,
    },
  ];

  const handleOpenEmiModal = (loan: any) => {
    setSelectedLoan(loan);
    setEmiModalOpen(true);
  };

  const handleOpenReconcileModal = (loan: any) => {
    setSelectedLoan(loan);
    setReconcileModalOpen(true);
  };

  const handleCloseLoan = async (loanId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await closeLoan(session.id, loanId);
      toast({ title: 'Loan closed', description: 'Loan liability marked as closed.' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error closing loan',
        description: err?.message || 'Could not close loan.',
        variant: 'destructive',
      });
    }
  };

  const handleArchiveLoan = async (loanId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await archiveLoan(session.id, loanId);
      toast({ title: 'Loan archived', description: 'Loan liability archived.' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error archiving loan',
        description: err?.message || 'Could not archive loan.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Loans & Liabilities"
        description="Track personal loans, bank EMIs, and credit card instalments"
        action={
          <LoanForm
            accounts={accounts}
            onLoanCreated={() => {
              const session = getAuthSession();
              if (session) loadData(session.id);
            }}
            onSubmitAction={(data) => {
              const session = getAuthSession();
              if (!session) throw new Error('Not authenticated');
              return createLoan(session.id, data);
            }}
          />
        }
      />

      <FinanceTabs />

      {error ? (
        <ErrorState
          title="Could not load loans"
          message={error}
          onRetry={() => {
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
          className="my-8"
        />
      ) : loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} height="120px" lines={2} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} height="200px" lines={3} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Total Outstanding Liabilities"
              value={`₹${formatIndianRupees(totalOutstanding)}`}
              helperText="Active principal across all loans and EMIs"
              tone="amber"
              icon={<Landmark className="h-4 w-4" />}
            />
            <MetricCard
              label="Monthly EMI Commitment"
              value={`₹${formatIndianRupees(totalMonthlyEmi)}`}
              helperText="Recurring monthly instalments"
              tone="neutral"
              icon={<Calendar className="h-4 w-4" />}
            />
            <MetricCard
              label="Active Liabilities"
              value={String(activeLoans.length)}
              helperText={`${activeLoans.filter((l) => l.loanType === 'CREDIT_CARD_EMI' || l.loanType === 'PRODUCT_EMI').length} product/card EMIs`}
              tone="blue"
              icon={<CreditCard className="h-4 w-4" />}
            />
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <SegmentedFilter
              options={filterOptions}
              selected={filter}
              onChange={(val) => setFilter(val as any)}
            />
          </div>

          {/* Body Content */}
          {displayedLoans.length === 0 ? (
            <EmptyState
              title="No loans or EMIs found"
              description={
                filter === 'ALL_ACTIVE'
                  ? 'No active loans tracked. Add your home, personal, or product EMIs to monitor liabilities.'
                  : 'No entries match this filter.'
              }
              icon={<Building2 className="h-10 w-10 text-[#98A2B3]" />}
              action={
                <LoanForm
                  accounts={accounts}
                  onLoanCreated={() => {
                    const session = getAuthSession();
                    if (session) loadData(session.id);
                  }}
                  onSubmitAction={(data) => {
                    const session = getAuthSession();
                    if (!session) throw new Error('Not authenticated');
                    return createLoan(session.id, data);
                  }}
                />
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onRecordEmi={handleOpenEmiModal}
                  onReconcile={handleOpenReconcileModal}
                  onClose={handleCloseLoan}
                  onArchive={handleArchiveLoan}
                />
              ))}
            </div>
          )}

          {/* Record EMI Modal */}
          {selectedLoan && (
            <RecordEmiModal
              open={emiModalOpen}
              onOpenChange={setEmiModalOpen}
              loan={selectedLoan}
              accounts={accounts}
              onSubmit={(params) => {
                const session = getAuthSession();
                if (!session) throw new Error('Not authenticated');
                return recordEmiPayment(session.id, params);
              }}
              onSuccess={() => {
                const session = getAuthSession();
                if (session) loadData(session.id);
              }}
            />
          )}

          {/* Reconcile Outstanding Modal */}
          {selectedLoan && (
            <ReconcileLoanModal
              open={reconcileModalOpen}
              onOpenChange={setReconcileModalOpen}
              loan={selectedLoan}
              onSubmit={(loanId, newOutstanding, note) => {
                const session = getAuthSession();
                if (!session) throw new Error('Not authenticated');
                return reconcileOutstanding(session.id, loanId, newOutstanding, note);
              }}
              onSuccess={() => {
                const session = getAuthSession();
                if (session) loadData(session.id);
              }}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

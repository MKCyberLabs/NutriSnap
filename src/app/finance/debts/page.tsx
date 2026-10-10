'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { DebtCard } from '@/components/finance/DebtCard';
import { DebtForm } from '@/components/finance/DebtForm';
import { DebtPaymentModal, DebtModalMode } from '@/components/finance/DebtPaymentModal';
import { SegmentedFilter } from '@/components/design-system/SegmentedFilter';
import { MetricCard } from '@/components/design-system/MetricCard';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getDebts,
  createDebt,
  updateDebt,
  recordDebtCollection,
  recordDebtRepayment,
  recordAdditionalLend,
  recordAdditionalBorrow,
  settleDebt,
  archiveDebt,
} from '@/app/finance/actions';
import { Users, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DebtsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'RECEIVABLE' | 'PAYABLE' | 'ALL_ACTIVE' | 'SETTLED'>('RECEIVABLE');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DebtModalMode>('COLLECT');
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [editDebtModalOpen, setEditDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<any>(null);

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [accs, allDebts] = await Promise.all([
        getAccounts(userId),
        getDebts(userId),
      ]);
      setAccounts(accs);
      setDebts(allDebts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load friends & family debts.');
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

  // ⚡ Bolt Optimization: Use a single pass reduce instead of multiple array allocations and loops
  const metrics = debts.reduce(
    (acc, d) => {
      if (d.status === 'OPEN') {
        acc.activeDebtsCount += 1;
        if (d.direction === 'RECEIVABLE') {
          acc.activeReceivablesCount += 1;
          acc.totalReceivables += parseFloat(d.outstandingAmount) || 0;
        } else if (d.direction === 'PAYABLE') {
          acc.activePayablesCount += 1;
          acc.totalPayables += parseFloat(d.outstandingAmount) || 0;
        }
      } else if (d.status === 'SETTLED') {
        acc.settledCount += 1;
      }
      return acc;
    },
    {
      activeDebtsCount: 0,
      activeReceivablesCount: 0,
      activePayablesCount: 0,
      totalReceivables: 0,
      totalPayables: 0,
      settledCount: 0,
    }
  );

  const netPosition = metrics.totalReceivables - metrics.totalPayables;

  // Filtered debts
  const displayedDebts = debts.filter((d) => {
    if (filter === 'RECEIVABLE') return d.direction === 'RECEIVABLE' && d.status === 'OPEN';
    if (filter === 'PAYABLE') return d.direction === 'PAYABLE' && d.status === 'OPEN';
    if (filter === 'ALL_ACTIVE') return d.status === 'OPEN';
    if (filter === 'SETTLED') return d.status === 'SETTLED';
    return true;
  });

  const filterOptions = [
    {
      label: 'Owed to Me',
      value: 'RECEIVABLE',
      count: metrics.activeReceivablesCount,
    },
    {
      label: 'I Owe',
      value: 'PAYABLE',
      count: metrics.activePayablesCount,
    },
    {
      label: 'All Active',
      value: 'ALL_ACTIVE',
      count: metrics.activeDebtsCount,
    },
    {
      label: 'Settled',
      value: 'SETTLED',
      count: metrics.settledCount,
    },
  ];

  const handleOpenMovementModal = (debt: any, mode: DebtModalMode) => {
    setSelectedDebt(debt);
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleModalSubmit = async (params: any) => {
    const session = getAuthSession();
    if (!session) return;

    if (modalMode === 'COLLECT') {
      return await recordDebtCollection(session.id, params);
    } else if (modalMode === 'REPAY') {
      return await recordDebtRepayment(session.id, params);
    } else if (modalMode === 'LEND_MORE') {
      return await recordAdditionalLend(session.id, params);
    } else if (modalMode === 'BORROW_MORE') {
      return await recordAdditionalBorrow(session.id, params);
    }
  };

  const handleSettle = async (debtId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await settleDebt(session.id, debtId);
      toast({ title: 'Debt marked settled' });
      loadData(session.id);
    } catch (err: any) {
      toast({ title: 'Error settling debt', description: err?.message, variant: 'destructive' });
    }
  };

  const handleArchive = async (debtId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await archiveDebt(session.id, debtId);
      toast({ title: 'Debt archived', description: 'Hidden from active views.' });
      loadData(session.id);
    } catch (err: any) {
      toast({ title: 'Error archiving debt', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Friends & Family"
        description="Track money you lent to or borrowed from friends without inflating income or expenses"
        action={
          <DebtForm
            accounts={accounts}
            onSubmitAction={async (data) => {
              const session = getAuthSession();
              if (session) return await createDebt(session.id, data);
            }}
            onDebtCreated={() => {
              const session = getAuthSession();
              if (session) loadData(session.id);
            }}
          />
        }
      />

      <FinanceTabs />

      {error ? (
        <ErrorState
          title="Could not load debt records"
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
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Owed to Me (Receivables)"
              value={`₹${formatIndianRupees(metrics.totalReceivables)}`}
              icon={<ArrowDownLeft className="h-4 w-4" />}
              tone="green"
              helperText={`${metrics.activeReceivablesCount} active receivables`}
            />
            <MetricCard
              label="I Owe Friends (Payables)"
              value={`₹${formatIndianRupees(metrics.totalPayables)}`}
              icon={<ArrowUpRight className="h-4 w-4" />}
              tone="amber"
              helperText={`${metrics.activePayablesCount} active payables`}
            />
            <MetricCard
              label="Net Position"
              value={`${netPosition >= 0 ? '+' : '-'}₹${formatIndianRupees(Math.abs(netPosition))}`}
              icon={<Scale className="h-4 w-4" />}
              tone={netPosition >= 0 ? 'purple' : 'red'}
              helperText={netPosition >= 0 ? 'Overall you are owed more' : 'Overall you owe more'}
            />
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SegmentedFilter
              options={filterOptions}
              selected={filter}
              onChange={(v: any) => setFilter(v)}
            />
            <span className="text-xs text-[#667085]">
              {displayedDebts.length} record{displayedDebts.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Debt List */}
          {displayedDebts.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No records in this tab"
              description="Track when you give money to a friend or borrow cash without treating it as normal spending."
              action={
                <DebtForm
                  accounts={accounts}
                  onSubmitAction={async (data) => {
                    const session = getAuthSession();
                    if (session) return await createDebt(session.id, data);
                  }}
                  onDebtCreated={() => {
                    const session = getAuthSession();
                    if (session) loadData(session.id);
                  }}
                />
              }
              className="py-12 bg-white"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedDebts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  onEdit={(d) => {
                    setEditingDebt(d);
                    setEditDebtModalOpen(true);
                  }}
                  onCollect={(d) => handleOpenMovementModal(d, 'COLLECT')}
                  onRepay={(d) => handleOpenMovementModal(d, 'REPAY')}
                  onLendMore={(d) => handleOpenMovementModal(d, 'LEND_MORE')}
                  onBorrowMore={(d) => handleOpenMovementModal(d, 'BORROW_MORE')}
                  onSettle={handleSettle}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}

          {/* Edit Debt Modal */}
          {editingDebt && (
            <DebtForm
              debt={editingDebt}
              open={editDebtModalOpen}
              onOpenChange={setEditDebtModalOpen}
              accounts={accounts}
              onSubmitAction={async (data) => {
                const session = getAuthSession();
                if (!session) throw new Error('Not authenticated');
                return await updateDebt(session.id, editingDebt.id, data);
              }}
              onSuccess={() => {
                const session = getAuthSession();
                if (session) loadData(session.id);
              }}
            />
          )}
        </div>
      )}

      {/* Movement Modal */}
      <DebtPaymentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        debt={selectedDebt}
        accounts={accounts}
        mode={modalMode}
        onSubmit={handleModalSubmit}
        onSuccess={() => {
          const session = getAuthSession();
          if (session) loadData(session.id);
        }}
      />
    </AppShell>
  );
}

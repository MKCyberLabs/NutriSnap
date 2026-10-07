'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { TransactionForm } from '@/components/finance/TransactionForm';
import { SegmentedFilter } from '@/components/design-system/SegmentedFilter';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getTransactions,
  recordTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/app/finance/actions';
import { ArrowLeftRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TransactionsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('ALL');

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [accs, txs] = await Promise.all([
        getAccounts(userId),
        getTransactions(userId, { limit: 100 }),
      ]);
      setAccounts(accs);
      setTransactions(txs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load transactions.');
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

  const handleEdit = async (txId: string, data: any) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      const res = await updateTransaction(session.id, txId, data);
      if (res && (res as any).error) {
        throw new Error((res as any).error);
      }
      await loadData(session.id);
      return res;
    } catch (err: any) {
      toast({
        title: 'Error updating transaction',
        description: err?.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleDelete = async (txId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await deleteTransaction(session.id, txId);
      toast({ title: 'Transaction deleted' });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error deleting transaction',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'ALL') return true;
    return t.type === filter;
  });

  const filterOptions = [
    { label: 'All', value: 'ALL', count: transactions.length },
    {
      label: 'Expense',
      value: 'EXPENSE',
      count: transactions.filter((t) => t.type === 'EXPENSE').length,
    },
    {
      label: 'Income',
      value: 'INCOME',
      count: transactions.filter((t) => t.type === 'INCOME').length,
    },
    {
      label: 'Transfer',
      value: 'TRANSFER',
      count: transactions.filter((t) => t.type === 'TRANSFER').length,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Transactions"
        description="Comprehensive log of all incomes, expenses, and internal transfers"
        action={
          <TransactionForm
            accounts={accounts}
            onSubmitAction={async (data) => {
              const session = getAuthSession();
              if (session) return await recordTransaction(session.id, data);
            }}
            onTransactionCreated={() => {
              const session = getAuthSession();
              if (session) loadData(session.id);
            }}
          />
        }
      />

      <FinanceTabs />

      {error ? (
        <ErrorState
          title="Could not load transactions"
          message={error}
          onRetry={() => {
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
          className="my-8"
        />
      ) : loading ? (
        <div className="space-y-4">
          <LoadingCard height="60px" lines={1} />
          <LoadingCard height="400px" lines={6} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter Chips */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SegmentedFilter
              options={filterOptions}
              selected={filter}
              onChange={setFilter}
              size="md"
            />
            <div className="text-xs text-[#667085]">
              Showing {filteredTransactions.length} of {transactions.length} record{transactions.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Transactions List */}
          <div className="rounded-[14px] border border-[#E5ECE8] bg-white p-3 sm:p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon={<ArrowLeftRight className="h-6 w-6" />}
                title={filter === 'ALL' ? 'No transactions recorded yet' : `No ${filter.toLowerCase()} transactions`}
                description={
                  filter === 'ALL'
                    ? 'Start tracking your daily money by recording expenses or income.'
                    : `No records found under the ${filter.toLowerCase()} category filter.`
                }
                action={
                  filter === 'ALL' ? (
                    <TransactionForm
                      accounts={accounts}
                      onSubmitAction={async (data) => {
                        const session = getAuthSession();
                        if (session) return await recordTransaction(session.id, data);
                      }}
                      onTransactionCreated={() => {
                        const session = getAuthSession();
                        if (session) loadData(session.id);
                      }}
                    />
                  ) : undefined
                }
                className="py-10"
              />
            ) : (
              <div className="divide-y divide-[#E5ECE8]/80">
                {filteredTransactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    accounts={accounts}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onTransactionUpdated={() => {
                      const session = getAuthSession();
                      if (session) loadData(session.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

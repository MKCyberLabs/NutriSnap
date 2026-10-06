'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { MetricCard } from '@/components/design-system/MetricCard';
import { SectionCard } from '@/components/design-system/SectionCard';
import { AccountCard } from '@/components/finance/AccountCard';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { ObligationRow } from '@/components/finance/ObligationRow';
import { TransactionForm } from '@/components/finance/TransactionForm';
import { AccountForm } from '@/components/finance/AccountForm';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getTransactions,
  getMonthlyFinanceSummary,
  getObligations,
  createAccount,
  recordTransaction,
  deleteTransaction,
  markObligationPaid,
} from './actions';
import {
  WalletCards,
  ArrowUpRight,
  ArrowDownRight,
  ReceiptText,
  Landmark,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function FinanceOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    income: '0',
    expense: '0',
    totalBalance: '0',
  });

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [accs, txs, obs, sum] = await Promise.all([
        getAccounts(userId),
        getTransactions(userId, { limit: 6 }),
        getObligations(userId),
        getMonthlyFinanceSummary(userId, new Date()),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      setObligations(obs);
      setSummary(sum);
    } catch (err: any) {
      setError(err?.message || 'Failed to load financial records.');
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

  const activeUpcoming = obligations
    .filter((o) => o.isActive && !o.isArchived)
    .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

  const nearestObligation = activeUpcoming[0];

  const handleDeleteTransaction = async (txId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await deleteTransaction(session.id, txId);
      toast({ title: 'Transaction deleted' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error deleting transaction',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const handleMarkPaid = async (params: any) => {
    const session = getAuthSession();
    if (!session) return;
    return await markObligationPaid(session.id, params);
  };

  return (
    <AppShell>
      <PageHeader
        title="Money"
        description="Accounts, spending and upcoming obligations"
        action={
          <div className="flex items-center gap-2">
            <AccountForm
              onSubmitAction={async (data) => {
                const session = getAuthSession();
                if (session) return await createAccount(session.id, data);
              }}
              onAccountCreated={() => {
                const session = getAuthSession();
                if (session) loadData(session.id);
              }}
            />
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
          </div>
        }
      />

      <FinanceTabs />

      {error ? (
        <ErrorState
          title="Could not load financial records"
          message={error}
          onRetry={() => {
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
          className="my-8"
        />
      ) : loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} height="120px" lines={2} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <LoadingCard height="300px" lines={4} />
            <LoadingCard height="300px" lines={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Balance"
              value={`₹${formatIndianRupees(summary.totalBalance)}`}
              icon={<WalletCards className="h-4 w-4" />}
              tone="blue"
              helperText={`${accounts.length} active account${accounts.length === 1 ? '' : 's'}`}
              href="/finance/accounts"
            />
            <MetricCard
              label="Monthly Income"
              value={`+₹${formatIndianRupees(summary.income)}`}
              icon={<ArrowUpRight className="h-4 w-4" />}
              tone="green"
              helperText="Earnings this month"
              href="/finance/transactions"
            />
            <MetricCard
              label="Monthly Expenses"
              value={`-₹${formatIndianRupees(summary.expense)}`}
              icon={<ArrowDownRight className="h-4 w-4" />}
              tone="red"
              helperText="Spending this month"
              href="/finance/transactions"
            />
            <MetricCard
              label="Upcoming Obligations"
              value={nearestObligation ? (nearestObligation.amount ? `₹${formatIndianRupees(nearestObligation.amount)}` : nearestObligation.title) : 'None due'}
              icon={<ReceiptText className="h-4 w-4" />}
              tone="amber"
              helperText={nearestObligation ? `${nearestObligation.title}` : 'All obligations up to date'}
              href="/finance/bills"
            />
          </div>

          {/* Accounts Preview */}
          <SectionCard
            title="Accounts"
            description="Your linked bank accounts, cash, and credit cards"
            action={
              <Link
                href="/finance/accounts"
                className="text-xs font-semibold text-[#16A34A] hover:text-[#0F7A38] inline-flex items-center gap-1 transition-colors"
              >
                <span>View all ({accounts.length})</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            {accounts.length === 0 ? (
              <EmptyState
                icon={<Landmark className="h-5 w-5" />}
                title="No accounts yet"
                description="Create a bank, cash, wallet or credit card account to start tracking money."
                action={
                  <AccountForm
                    onSubmitAction={async (data) => {
                      const session = getAuthSession();
                      if (session) return await createAccount(session.id, data);
                    }}
                    onAccountCreated={() => {
                      const session = getAuthSession();
                      if (session) loadData(session.id);
                    }}
                  />
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.slice(0, 3).map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Bottom Split: Recent Transactions & Upcoming Bills */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Recent Transactions */}
            <div className="lg:col-span-7 flex flex-col">
              <SectionCard
                title="Recent Transactions"
                description="Latest expenses, income, and transfers"
                action={
                  <Link
                    href="/finance/transactions"
                    className="text-xs font-semibold text-[#16A34A] hover:text-[#0F7A38] inline-flex items-center gap-1 transition-colors"
                  >
                    <span>View all</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                }
                className="h-full flex flex-col justify-between"
              >
                {transactions.length === 0 ? (
                  <EmptyState
                    icon={<ArrowLeftRight className="h-5 w-5" />}
                    title="No transactions yet"
                    description="Record your daily expenses, salary or transfers to build your financial history."
                  />
                ) : (
                  <div className="divide-y divide-[#E5ECE8]/80">
                    {transactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        onDelete={handleDeleteTransaction}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Upcoming Bills */}
            <div className="lg:col-span-5 flex flex-col">
              <SectionCard
                title="Upcoming Bills"
                description="Scheduled recurring obligations"
                action={
                  <Link
                    href="/finance/bills"
                    className="text-xs font-semibold text-[#16A34A] hover:text-[#0F7A38] inline-flex items-center gap-1 transition-colors"
                  >
                    <span>View all ({activeUpcoming.length})</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                }
                className="h-full flex flex-col justify-between"
              >
                {activeUpcoming.length === 0 ? (
                  <EmptyState
                    icon={<ReceiptText className="h-5 w-5" />}
                    title="No upcoming obligations"
                    description="Schedule recurring subscriptions, phone recharges, or bills to track due dates."
                  />
                ) : (
                  <div className="space-y-3">
                    {activeUpcoming.slice(0, 3).map((ob) => (
                      <ObligationRow
                        key={ob.id}
                        obligation={ob}
                        accounts={accounts}
                        onMarkPaid={handleMarkPaid}
                        onPaidSuccess={() => {
                          const session = getAuthSession();
                          if (session) loadData(session.id);
                        }}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

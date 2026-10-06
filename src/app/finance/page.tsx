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
  getObligations,
  getMoneyOverview,
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
  Users,
  Building2,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function FinanceOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({
    liquidBalance: '0',
    monthlyIncome: '0',
    monthlyExpense: '0',
    receivablesOutstanding: '0',
    payablesOutstanding: '0',
    totalLoanOutstanding: '0',
    monthlyEmiCommitment: '0',
    nextEmi: null,
    nextObligation: null,
    wishlistPlannedTotal: '0',
    wishlistReadyTotal: '0',
    activeWishlistCount: 0,
    highPriorityWishlist: [],
    debtsDueSoon: [],
    loansDueSoon: [],
  });

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [accs, txs, obs, ov] = await Promise.all([
        getAccounts(userId),
        getTransactions(userId, { limit: 6 }),
        getObligations(userId),
        getMoneyOverview(userId, new Date()),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      setObligations(obs);
      setOverview(ov);
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

  const handleDeleteTransaction = async (txId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await deleteTransaction(session.id, txId);
      toast({ title: 'Transaction deleted' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Cannot delete transaction',
        description: err?.message || 'Could not delete transaction.',
        variant: 'destructive',
      });
    }
  };

  const handleMarkPaid = async (params: {
    obligationId: string;
    occurrenceKey: string;
    createExpense?: boolean;
    accountId?: string;
  }) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await markObligationPaid(session.id, {
        obligationId: params.obligationId,
        occurrenceKey: params.occurrenceKey,
        createExpense: params.createExpense !== undefined ? params.createExpense : true,
        accountId: params.accountId,
      });
      toast({ title: 'Marked paid', description: 'Schedule updated.' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error marking paid',
        description: err?.message || 'Could not record payment.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Money Hub"
        description="Accounts, cash flow, debts, loans, and planned budgeting"
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
        <div className="space-y-8">
          {/* Top Cash Flow KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Total Liquid Balance"
              value={`₹${formatIndianRupees(overview.liquidBalance)}`}
              icon={<Landmark className="h-4 w-4" />}
              tone="green"
              helperText={`${accounts.length} active accounts tracked`}
            />
            <MetricCard
              label="This Month's Income"
              value={`₹${formatIndianRupees(overview.monthlyIncome)}`}
              icon={<ArrowDownRight className="h-4 w-4" />}
              tone="green"
              helperText="Current calendar month cash-in"
            />
            <MetricCard
              label="This Month's Expense"
              value={`₹${formatIndianRupees(overview.monthlyExpense)}`}
              icon={<ArrowUpRight className="h-4 w-4" />}
              tone="amber"
              helperText="Authoritative monthly expense sum"
            />
          </div>

          {/* Life & Liabilities KPIs (v0.2 additions) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/finance/debts" className="block hover:opacity-95 transition-opacity">
              <MetricCard
                label="Friends Owe Me"
                value={`₹${formatIndianRupees(overview.receivablesOutstanding)}`}
                icon={<Users className="h-4 w-4 text-[#16A34A]" />}
                tone="green"
                helperText="Money lent to friends"
              />
            </Link>
            <Link href="/finance/debts" className="block hover:opacity-95 transition-opacity">
              <MetricCard
                label="I Owe Friends"
                value={`₹${formatIndianRupees(overview.payablesOutstanding)}`}
                icon={<Users className="h-4 w-4 text-[#D97706]" />}
                tone="amber"
                helperText="Money borrowed from friends"
              />
            </Link>
            <Link href="/finance/loans" className="block hover:opacity-95 transition-opacity">
              <MetricCard
                label="Loan Outstanding"
                value={`₹${formatIndianRupees(overview.totalLoanOutstanding)}`}
                icon={<Building2 className="h-4 w-4 text-[#D97706]" />}
                tone="amber"
                helperText={
                  overview.nextEmi
                    ? `Next EMI: ₹${formatIndianRupees(overview.nextEmi.amount || 0)}`
                    : 'Active loan liabilities'
                }
              />
            </Link>
            <Link href="/finance/wishlist" className="block hover:opacity-95 transition-opacity">
              <MetricCard
                label="Wishlist Goals"
                value={`₹${formatIndianRupees(overview.wishlistPlannedTotal)}`}
                icon={<Sparkles className="h-4 w-4 text-[#2563EB]" />}
                tone="blue"
                helperText={`Ready: ₹${formatIndianRupees(overview.wishlistReadyTotal)}`}
              />
            </Link>
          </div>

          {/* Accounts Grid */}
          <SectionCard
            title="My Accounts"
            action={
              <Link
                href="/finance/accounts"
                className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-1"
              >
                <span>View all ({accounts.length})</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {accounts.length === 0 ? (
              <EmptyState
                title="No accounts linked"
                description="Add a bank account, cash wallet, or credit card to get started."
                icon={<WalletCards className="h-8 w-8 text-[#98A2B3]" />}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.slice(0, 3).map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Two-Column Middle Section: Debts & Loans Spotlight vs Upcoming Bills */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Debts & Liabilities Spotlight */}
            <SectionCard
              title="Debts & Liabilities Spotlight"
              action={
                <div className="flex items-center gap-3 text-xs font-semibold text-[#16A34A]">
                  <Link href="/finance/debts" className="hover:underline">
                    Debts
                  </Link>
                  <span>•</span>
                  <Link href="/finance/loans" className="hover:underline">
                    Loans & EMI
                  </Link>
                </div>
              }
            >
              {overview.debtsDueSoon.length === 0 && overview.loansDueSoon.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#667085]">
                  No debts or loan payments due in the immediate schedule.
                </div>
              ) : (
                <div className="space-y-3">
                  {overview.debtsDueSoon.slice(0, 3).map((d: any) => (
                    <div
                      key={d.id}
                      className="p-3 rounded-xl border border-[#E5ECE8] bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            d.direction === 'RECEIVABLE'
                              ? 'bg-[#EAF8EF] text-[#16A34A]'
                              : 'bg-[#FFF4DF] text-[#D97706]'
                          }`}
                        >
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#111827]">
                            {d.counterpartyName}
                          </div>
                          <div className="text-[11px] text-[#667085]">
                            {d.direction === 'RECEIVABLE' ? 'Owes you' : 'You owe'}
                            {d.isOverdue && (
                              <span className="text-[#EF4444] font-medium ml-1.5">• Overdue</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#111827]">
                          ₹{formatIndianRupees(d.outstandingAmount)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {overview.loansDueSoon.slice(0, 2).map((l: any) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-xl border border-[#E5ECE8] bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#FFF4DF] text-[#D97706] flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#111827]">{l.name}</div>
                          <div className="text-[11px] text-[#667085]">
                            {l.lender} {l.dueDay ? `• Due on ${l.dueDay}th` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#111827]">
                          {l.emiAmount ? `₹${formatIndianRupees(l.emiAmount)} / mo` : `₹${formatIndianRupees(l.outstandingPrincipal)}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Right: Upcoming Bills & Obligations */}
            <SectionCard
              title="Upcoming Bills & Subscriptions"
              action={
                <Link
                  href="/finance/bills"
                  className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-1"
                >
                  <span>Manage ({activeUpcoming.length})</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {activeUpcoming.length === 0 ? (
                <EmptyState
                  title="No upcoming obligations"
                  description="Add utility bills, recharges, rent, or EMIs to track schedules."
                  icon={<ReceiptText className="h-8 w-8 text-[#98A2B3]" />}
                />
              ) : (
                <div className="space-y-2">
                  {activeUpcoming.slice(0, 4).map((ob) => (
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

          {/* Wishlist Priority Items Spotlight */}
          {overview.highPriorityWishlist.length > 0 && (
            <SectionCard
              title="Wishlist Priority Targets"
              action={
                <Link
                  href="/finance/wishlist"
                  className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-1"
                >
                  <span>Open Wishlist ({overview.activeWishlistCount})</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {overview.highPriorityWishlist.map((w: any) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl border border-[#E5ECE8] bg-white flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#111827]">{w.name}</div>
                      <div className="text-[11px] text-[#667085] mt-0.5">{w.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#16A34A]">
                        ₹{formatIndianRupees(w.targetPrice)}
                      </div>
                      <div className="text-[10px] text-[#475467] font-medium capitalize">
                        {w.status.toLowerCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Recent Transactions */}
          <SectionCard
            title="Recent Activity"
            action={
              <Link
                href="/finance/transactions"
                className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-1"
              >
                <span>All transactions</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {transactions.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                description="Record income, expenses, or transfers to start seeing activity."
                icon={<ArrowLeftRight className="h-8 w-8 text-[#98A2B3]" />}
              />
            ) : (
              <div className="space-y-1">
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
      )}
    </AppShell>
  );
}

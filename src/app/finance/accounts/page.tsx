'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { AccountCard } from '@/components/finance/AccountCard';
import { AccountForm } from '@/components/finance/AccountForm';
import { MetricCard } from '@/components/design-system/MetricCard';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  createAccount,
  archiveAccount,
} from '@/app/finance/actions';
import { Landmark, WalletCards } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AccountsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const accs = await getAccounts(userId);
      setAccounts(accs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load accounts.');
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

  const handleArchive = async (accountId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await archiveAccount(session.id, accountId);
      toast({ title: 'Account archived', description: 'Account hidden from active lists.' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error archiving account',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const totalBalance = accounts.reduce((acc, a) => acc + (parseFloat(a.currentBalance) || 0), 0);

  return (
    <AppShell>
      <PageHeader
        title="Accounts"
        description="Manage your banks, cash, wallets and credit cards"
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

      <FinanceTabs />

      {error ? (
        <ErrorState
          title="Could not load accounts"
          message={error}
          onRetry={() => {
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
          className="my-8"
        />
      ) : loading ? (
        <div className="space-y-6">
          <LoadingCard height="120px" lines={2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} height="180px" lines={3} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Total Balance Card */}
          <div className="max-w-sm">
            <MetricCard
              label="Net Liquid Balance"
              value={`₹${formatIndianRupees(totalBalance)}`}
              icon={<WalletCards className="h-4 w-4" />}
              tone="blue"
              helperText={`Sum across ${accounts.length} active account${accounts.length === 1 ? '' : 's'}`}
            />
          </div>

          {/* Accounts List */}
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-6 w-6" />}
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
              {accounts.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  accounts={accounts}
                  onArchive={handleArchive}
                  onRefresh={() => {
                    const session = getAuthSession();
                    if (session) loadData(session.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

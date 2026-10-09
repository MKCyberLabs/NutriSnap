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
  updateAccount,
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
  const [editingAccount, setEditingAccount] = useState<any | null>(null);

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

  const handleUpdateAccount = async (data: any) => {
    const session = getAuthSession();
    if (!session || !editingAccount) return;
    try {
      const res = await updateAccount(session.id, editingAccount.id, data);
      if (res && (res as any).error) {
        throw new Error((res as any).error);
      }
      setEditingAccount(null);
      await loadData(session.id);
      return res;
    } catch (err: any) {
      toast({
        title: 'Error updating account',
        description: err?.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleArchive = async (accountId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await archiveAccount(session.id, accountId);
      toast({ title: 'Account archived', description: 'Account hidden from active lists.' });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error archiving account',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const totalBalance = accounts.reduce((acc, a) => acc + (parseFloat(a.currentBalance) || 0), 0);

  const bankAccounts = accounts.filter((a) => a.type === 'BANK');
  const creditCardAccounts = accounts.filter((a) => a.type === 'CREDIT_CARD');
  const cashAndWalletAccounts = accounts.filter((a) => a.type === 'CASH' || a.type === 'WALLET');

  const bankSubtotal = bankAccounts.reduce((sum, a) => sum + (parseFloat(a.currentBalance) || 0), 0);
  const creditCardSubtotal = creditCardAccounts.reduce((sum, a) => sum + (parseFloat(a.currentBalance) || 0), 0);
  const cashWalletSubtotal = cashAndWalletAccounts.reduce((sum, a) => sum + (parseFloat(a.currentBalance) || 0), 0);

  return (
    <AppShell>
      <PageHeader
        title="Accounts & Wallets"
        description="Manual offline ledger. No third-party bank screen scraping or credentials stored."
        action={
          <AccountForm
            accounts={accounts}
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
          {/* Top Banner: Total Portfolio Balance & Zero Sync Guarantee */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            <div className="lg:col-span-1">
              <MetricCard
                label="Total Liquid Balance"
                value={`₹${formatIndianRupees(totalBalance)}`}
                icon={<WalletCards className="h-4 w-4" />}
                tone="purple"
                helperText={`${accounts.length} active account${accounts.length === 1 ? '' : 's'} in manual record mode`}
              />
            </div>
            <div className="lg:col-span-2 rounded-2xl border border-[#E2E8F0] bg-[#F5F3FF]/40 p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-[#6D28D9] flex items-center justify-center shrink-0">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#1E293B]">Zero Automated Sync Guarantee</h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    NutriSnap does not connect to external open banking APIs. You own every balance revision, reconciliation timestamp, and manual entry.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] shrink-0">
                100% Offline Safe
              </span>
            </div>
          </div>

          {/* Accounts List */}
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-6 w-6" />}
              title="No accounts yet"
              description="Create a bank, cash, wallet or credit card account to start tracking money."
              action={
                <AccountForm
                  accounts={accounts}
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
            <div className="space-y-8">
              {/* Bank Accounts Section */}
              {bankAccounts.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E293B]">
                        Bank Accounts
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F5F3FF] text-[#6D28D9]">
                        {bankAccounts.length}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-[#64748B]">
                      Subtotal: <strong className="text-[#1E293B]">₹{formatIndianRupees(bankSubtotal)}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bankAccounts.map((acc) => (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        accounts={accounts}
                        onEdit={(accountToEdit) => setEditingAccount(accountToEdit)}
                        onArchive={handleArchive}
                        onRefresh={() => {
                          const session = getAuthSession();
                          if (session) loadData(session.id);
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Credit Cards Section */}
              {creditCardAccounts.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E293B]">
                        Credit Cards
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706]">
                        {creditCardAccounts.length}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-[#64748B]">
                      Subtotal: <strong className="text-[#1E293B]">₹{formatIndianRupees(creditCardSubtotal)}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {creditCardAccounts.map((acc) => (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        accounts={accounts}
                        onEdit={(accountToEdit) => setEditingAccount(accountToEdit)}
                        onArchive={handleArchive}
                        onRefresh={() => {
                          const session = getAuthSession();
                          if (session) loadData(session.id);
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Cash & Wallets Section */}
              {cashAndWalletAccounts.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E293B]">
                        Cash & Wallets
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669]">
                        {cashAndWalletAccounts.length}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-[#64748B]">
                      Subtotal: <strong className="text-[#1E293B]">₹{formatIndianRupees(cashWalletSubtotal)}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cashAndWalletAccounts.map((acc) => (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        accounts={accounts}
                        onEdit={(accountToEdit) => setEditingAccount(accountToEdit)}
                        onArchive={handleArchive}
                        onRefresh={() => {
                          const session = getAuthSession();
                          if (session) loadData(session.id);
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Account Dialog Modal */}
      {editingAccount && (
        <AccountForm
          mode="edit"
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingAccount(null);
          }}
          initialData={editingAccount}
          accounts={accounts}
          onSubmitAction={handleUpdateAccount}
          onAccountUpdated={() => {
            setEditingAccount(null);
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
        />
      )}
    </AppShell>
  );
}

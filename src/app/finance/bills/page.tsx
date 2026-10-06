'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { ObligationRow } from '@/components/finance/ObligationRow';
import { ObligationForm } from '@/components/finance/ObligationForm';
import { SegmentedFilter } from '@/components/design-system/SegmentedFilter';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getObligations,
  createObligation,
  markObligationPaid,
} from '@/app/finance/actions';
import { ReceiptText } from 'lucide-react';

export default function BillsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [filter, setFilter] = useState<'UPCOMING' | 'ALL'>('UPCOMING');

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

  const activeObligations = obligations.filter((o) => o.isActive && !o.isArchived);
  const displayedObligations = filter === 'UPCOMING'
    ? activeObligations.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime())
    : obligations;

  const filterOptions = [
    { label: 'Upcoming Active', value: 'UPCOMING', count: activeObligations.length },
    { label: 'All Registered', value: 'ALL', count: obligations.length },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Bills & Subscriptions"
        description="Recurring payments, mobile recharges, credit card dues and EMIs"
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
          <LoadingCard height="60px" lines={1} />
          <LoadingCard height="350px" lines={5} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SegmentedFilter
              options={filterOptions}
              selected={filter}
              onChange={(val: any) => setFilter(val)}
              size="md"
            />
            <div className="text-xs text-[#667085]">
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
        </div>
      )}
    </AppShell>
  );
}

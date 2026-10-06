'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { TodayMetricGrid } from '@/components/today/TodayMetricGrid';
import { TodayFocusList } from '@/components/today/TodayFocusList';
import { RecentTransactions } from '@/components/today/RecentTransactions';
import { HealthWellnessCard } from '@/components/today/HealthWellnessCard';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { ErrorState } from '@/components/design-system/ErrorState';
import { QuickAddModal } from '@/components/quick-add/QuickAddModal';
import { Button } from '@/components/ui/button';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getTodaySummary,
  getTodayRecentTransactions,
  TodaySummaryData,
  TodayRecentTransaction,
} from './actions';
import {
  Plus,
  Utensils,
  Droplets,
  WalletCards,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

export default function TodayPage() {
  const router = useRouter();
  const [data, setData] = useState<TodaySummaryData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TodayRecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [summary, txs] = await Promise.all([
        getTodaySummary(userId),
        getTodayRecentTransactions(userId).catch(() => []),
      ]);
      setData(summary);
      setRecentTransactions(txs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load today summary.');
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

  const currentDateFormatted = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <AppShell>
      {/* Header */}
      <PageHeader
        title="Today"
        description={currentDateFormatted}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const session = getAuthSession();
                if (session) loadData(session.id);
              }}
              className="h-10 px-3 rounded-[10px] border-[#E5ECE8] bg-white text-[#344054] hover:bg-[#F7FAF8] shadow-xs"
              aria-label="Refresh today overview"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <QuickAddModal>
              <Button
                size="sm"
                className="h-10 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold shadow-xs flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Quick Add</span>
              </Button>
            </QuickAddModal>
          </div>
        }
      />

      {error ? (
        <ErrorState
          title="Could not load Today overview"
          message={error}
          onRetry={() => {
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
          className="my-8"
        />
      ) : loading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} height="120px" lines={2} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4">
              <LoadingCard height="360px" lines={5} />
            </div>
            <div className="lg:col-span-5">
              <LoadingCard height="360px" lines={5} />
            </div>
            <div className="lg:col-span-3">
              <LoadingCard height="360px" lines={4} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: 4 KPI Cards */}
          <TodayMetricGrid wealth={data.wealth} />

          {/* Mobile Module Quick Links (shown on mobile for quick access) */}
          <div className="md:hidden grid grid-cols-4 gap-2 pt-1 pb-1">
            <Link
              href="/dashboard"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white border border-[#E5ECE8] shadow-xs hover:border-[#16A34A] transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-[#EAF8EF] text-[#16A34A] flex items-center justify-center mb-1">
                <Utensils className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#111827]">Food</span>
            </Link>

            <Link
              href="/hydration"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white border border-[#E5ECE8] shadow-xs hover:border-[#2F80ED] transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-[#EAF3FF] text-[#2F80ED] flex items-center justify-center mb-1">
                <Droplets className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#111827]">Water</span>
            </Link>

            <Link
              href="/finance"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white border border-[#E5ECE8] shadow-xs hover:border-[#16A34A] transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-[#EAF8EF] text-[#0F7A38] flex items-center justify-center mb-1">
                <WalletCards className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#111827]">Money</span>
            </Link>

            <Link
              href="/reminders"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white border border-[#E5ECE8] shadow-xs hover:border-[#F59E0B] transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-[#FFF4DF] text-[#F59E0B] flex items-center justify-center mb-1">
                <Bell className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#111827]">Alerts</span>
            </Link>
          </div>

          {/* Row 2: Today's Focus, Recent Transactions, Health & Wellness */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Today's Focus (approx 1.1fr) */}
            <div className="lg:col-span-4 flex flex-col">
              <TodayFocusList
                food={data.food}
                water={data.water}
                wealth={data.wealth}
                reminders={data.reminders}
              />
            </div>

            {/* Recent Transactions (approx 1.4fr) */}
            <div className="lg:col-span-5 flex flex-col">
              <RecentTransactions transactions={recentTransactions} />
            </div>

            {/* Health & Wellness + Motivational banner (approx 0.9fr) */}
            <div className="lg:col-span-3 flex flex-col">
              <HealthWellnessCard food={data.food} water={data.water} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { WishlistCard } from '@/components/finance/WishlistCard';
import { WishlistForm } from '@/components/finance/WishlistForm';
import { MarkPurchasedModal } from '@/components/finance/MarkPurchasedModal';
import { SegmentedFilter } from '@/components/design-system/SegmentedFilter';
import { MetricCard } from '@/components/design-system/MetricCard';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getWishlistItems,
  createWishlistItem,
  updateWishlistItem,
  markWishlistPurchased,
  unmarkWishlistPurchased,
  archiveWishlistItem,
} from '@/app/finance/actions';
import { Sparkles, ShoppingBag, CheckCircle2, Flame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function WishlistPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ACTIVE' | 'READY' | 'HIGH_PRIORITY' | 'PURCHASED' | 'ALL'>('ACTIVE');

  // Modals
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [accs, allItems] = await Promise.all([
        getAccounts(userId),
        getWishlistItems(userId, { status: undefined }),
      ]);
      setAccounts(accs);
      setItems(allItems);
    } catch (err: any) {
      setError(err?.message || 'Failed to load wishlist items.');
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

  // KPIs
  const activeItems = items.filter(
    (i) => i.status === 'WISHLIST' || i.status === 'PLANNED' || i.status === 'READY'
  );
  const totalPlannedBudget = activeItems.reduce(
    (sum, i) => sum + (parseFloat(String(i.targetPrice)) || 0),
    0
  );

  const readyItems = items.filter((i) => i.status === 'READY');
  const readyTotal = readyItems.reduce(
    (sum, i) => sum + (parseFloat(String(i.targetPrice)) || 0),
    0
  );

  const highPriorityCount = activeItems.filter((i) => i.priority === 'HIGH').length;

  // Filtered
  const displayedItems = items.filter((i) => {
    if (filter === 'ACTIVE') {
      return i.status === 'WISHLIST' || i.status === 'PLANNED' || i.status === 'READY';
    }
    if (filter === 'READY') return i.status === 'READY';
    if (filter === 'HIGH_PRIORITY') {
      return (
        (i.status === 'WISHLIST' || i.status === 'PLANNED' || i.status === 'READY') &&
        i.priority === 'HIGH'
      );
    }
    if (filter === 'PURCHASED') return i.status === 'PURCHASED';
    return true;
  });

  const filterOptions = [
    {
      label: 'Active Wishlist',
      value: 'ACTIVE',
      count: activeItems.length,
    },
    {
      label: 'Ready to Buy',
      value: 'READY',
      count: readyItems.length,
    },
    {
      label: 'High Priority',
      value: 'HIGH_PRIORITY',
      count: highPriorityCount,
    },
    {
      label: 'Purchased',
      value: 'PURCHASED',
      count: items.filter((i) => i.status === 'PURCHASED').length,
    },
    {
      label: 'All',
      value: 'ALL',
      count: items.length,
    },
  ];

  const handleOpenPurchaseModal = (item: any) => {
    setSelectedItem(item);
    setPurchaseModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setSelectedItem(item);
    setEditModalOpen(true);
  };

  const handleSetReady = async (itemId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await updateWishlistItem(session.id, itemId, { status: 'READY' });
      toast({ title: 'Marked ready', description: 'Item moved to Ready to Buy.' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error updating status',
        description: err?.message || 'Could not update item.',
        variant: 'destructive',
      });
    }
  };

  const handleUnmarkPurchased = async (itemId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await unmarkWishlistPurchased(session.id, itemId, 'READY');
      toast({
        title: 'Purchase reverted',
        description: 'Linked expense deleted and item restored to Ready.',
      });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error reverting purchase',
        description: err?.message || 'Could not revert purchase.',
        variant: 'destructive',
      });
    }
  };

  const handleArchive = async (itemId: string) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await archiveWishlistItem(session.id, itemId);
      toast({ title: 'Item archived', description: 'Hidden from active views.' });
      loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error archiving item',
        description: err?.message || 'Could not archive item.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Wishlist & Planned Purchases"
        description="Plan your future gadgets, lifestyle goals, and big-ticket purchases"
        action={
          <WishlistForm
            accounts={accounts}
            onSuccess={() => {
              const session = getAuthSession();
              if (session) loadData(session.id);
            }}
            onSubmitAction={(data) => {
              const session = getAuthSession();
              if (!session) throw new Error('Not authenticated');
              return createWishlistItem(session.id, data);
            }}
          />
        }
      />

      <FinanceTabs />

      {error ? (
        <ErrorState
          title="Could not load wishlist"
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
              label="Planned Wishlist Total"
              value={`₹${formatIndianRupees(totalPlannedBudget)}`}
              helperText={`${activeItems.length} active goals saving for`}
              tone="purple"
              icon={<ShoppingBag className="h-4 w-4" />}
            />
            <MetricCard
              label="Ready to Purchase"
              value={`₹${formatIndianRupees(readyTotal)}`}
              helperText={`${readyItems.length} items ready to buy now`}
              tone="green"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <MetricCard
              label="High Priority Targets"
              value={String(highPriorityCount)}
              helperText="Focus purchases for this cycle"
              tone="red"
              icon={<Flame className="h-4 w-4" />}
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
          {displayedItems.length === 0 ? (
            <EmptyState
              title="No wishlist items found"
              description={
                filter === 'ACTIVE'
                  ? 'No items on your wishlist yet. Add your dream phone, trips, or appliances to begin planning!'
                  : 'No entries match this filter.'
              }
              icon={<Sparkles className="h-10 w-10 text-[#98A2B3]" />}
              action={
                <WishlistForm
                  accounts={accounts}
                  onSuccess={() => {
                    const session = getAuthSession();
                    if (session) loadData(session.id);
                  }}
                  onSubmitAction={(data) => {
                    const session = getAuthSession();
                    if (!session) throw new Error('Not authenticated');
                    return createWishlistItem(session.id, data);
                  }}
                />
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedItems.map((item) => (
                <WishlistCard
                  key={item.id}
                  item={item}
                  onMarkPurchased={handleOpenPurchaseModal}
                  onUnmarkPurchased={handleUnmarkPurchased}
                  onEdit={handleOpenEditModal}
                  onSetReady={handleSetReady}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}

          {/* Mark Purchased Modal */}
          {selectedItem && (
            <MarkPurchasedModal
              open={purchaseModalOpen}
              onOpenChange={setPurchaseModalOpen}
              item={selectedItem}
              accounts={accounts}
              onSubmit={(params) => {
                const session = getAuthSession();
                if (!session) throw new Error('Not authenticated');
                return markWishlistPurchased(session.id, selectedItem.id, params);
              }}
              onSuccess={() => {
                const session = getAuthSession();
                if (session) loadData(session.id);
              }}
            />
          )}

          {/* Edit Item Modal */}
          {selectedItem && (
            <WishlistForm
              accounts={accounts}
              initialItem={selectedItem}
              open={editModalOpen}
              onOpenChange={setEditModalOpen}
              onSubmitAction={(data) => {
                const session = getAuthSession();
                if (!session) throw new Error('Not authenticated');
                return updateWishlistItem(session.id, selectedItem.id, data);
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

'use client';

import React from 'react';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount, formatIndianRupees } from '@/components/design-system/MoneyAmount';
import {
  Sparkles,
  Calendar,
  Archive,
  CheckCircle2,
  Undo2,
  Edit2,
  ShoppingBag,
  Clock,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

interface WishlistCardProps {
  item: {
    id: string;
    name: string;
    category: string;
    targetPrice: string | number;
    maxBudget?: string | number | null;
    priority: string;
    targetDate?: string | Date | null;
    plannedAccountId?: string | null;
    plannedAccount?: { id: string; name: string } | null;
    status: string;
    notes?: string | null;
    actualPrice?: string | number | null;
    purchasedAt?: string | Date | null;
    transactionId?: string | null;
  };
  onMarkPurchased?: (item: any) => void;
  onUnmarkPurchased?: (itemId: string) => void;
  onEdit?: (item: any) => void;
  onArchive?: (itemId: string) => void;
  onSetReady?: (itemId: string) => void;
}

const PRIORITY_TONE: Record<string, 'red' | 'amber' | 'blue' | 'neutral'> = {
  HIGH: 'red',
  MEDIUM: 'blue',
  LOW: 'neutral',
};

export function WishlistCard({
  item,
  onMarkPurchased,
  onUnmarkPurchased,
  onEdit,
  onArchive,
  onSetReady,
}: WishlistCardProps) {
  const isPurchased = item.status === 'PURCHASED';
  const isReady = item.status === 'READY';
  const isPlanned = item.status === 'PLANNED';

  let formattedTargetDate = '';
  if (item.targetDate) {
    try {
      const d = typeof item.targetDate === 'string' ? parseISO(item.targetDate) : item.targetDate;
      formattedTargetDate = format(d, 'dd MMM yyyy');
    } catch {
      formattedTargetDate = String(item.targetDate);
    }
  }

  let formattedPurchasedDate = '';
  if (item.purchasedAt) {
    try {
      const d = typeof item.purchasedAt === 'string' ? parseISO(item.purchasedAt) : item.purchasedAt;
      formattedPurchasedDate = format(d, 'dd MMM yyyy');
    } catch {
      formattedPurchasedDate = String(item.purchasedAt);
    }
  }

  return (
    <div
      className={`rounded-[14px] border p-5 flex flex-col justify-between transition-all ${
        isPurchased
          ? 'border-[#C3EBD0] bg-[#F9FDFB] shadow-xs'
          : 'border-[#E5ECE8] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] hover:shadow-[0_6px_18px_rgba(16,24,40,0.06)]'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isPurchased
                  ? 'bg-[#EAF8EF] border-[#C3EBD0] text-[#16A34A]'
                  : isReady
                  ? 'bg-[#EBF5FB] border-[#D1E8F7] text-[#2563EB]'
                  : 'bg-[#F2F4F7] border-[#EAECF0] text-[#475467]'
              }`}
            >
              {isPurchased ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111827] leading-tight">
                {item.name}
              </h3>
              <p className="text-xs text-[#667085] mt-0.5 truncate max-w-[180px]">
                {item.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <StatusPill
              label={item.priority}
              tone={PRIORITY_TONE[item.priority] || 'neutral'}
            />
            {isPurchased ? (
              <StatusPill label="Purchased" tone="green" />
            ) : isReady ? (
              <StatusPill label="Ready to Buy" tone="blue" />
            ) : isPlanned ? (
              <StatusPill label="Planned" tone="amber" />
            ) : (
              <StatusPill label="Wishlist" tone="neutral" />
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#E5ECE8]/60">
          <div className="text-xs text-[#667085]">
            {isPurchased ? 'Purchase Price' : 'Target Price'}
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#111827] mt-1">
            <MoneyAmount
              amount={isPurchased && item.actualPrice ? item.actualPrice : item.targetPrice}
              type={isPurchased ? 'EXPENSE' : 'INCOME'}
              size="lg"
            />
          </div>

          {item.maxBudget && !isPurchased && (
            <div className="text-xs text-[#667085] mt-1.5 flex items-center gap-1">
              <span>Max Budget: ₹{formatIndianRupees(item.maxBudget)}</span>
            </div>
          )}

          {isPurchased && item.targetPrice && (
            <div className="text-xs text-[#667085] mt-1 flex items-center justify-between">
              <span>Target was: ₹{formatIndianRupees(item.targetPrice)}</span>
              {item.transactionId && (
                <span className="text-[#16A34A] font-medium">• Recorded Expense</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-[#667085] mt-3 pt-2.5 border-t border-[#E5ECE8]/40">
            {formattedTargetDate && !isPurchased && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#475467]" />
                <span>Target: {formattedTargetDate}</span>
              </div>
            )}
            {formattedPurchasedDate && isPurchased && (
              <div className="flex items-center gap-1.5 col-span-2">
                <Clock className="h-3.5 w-3.5 text-[#16A34A]" />
                <span>Purchased on {formattedPurchasedDate}</span>
              </div>
            )}
            {item.plannedAccount && (
              <div className="flex items-center gap-1.5 col-span-2">
                <Landmark className="h-3.5 w-3.5 text-[#475467]" />
                <span className="truncate">From {item.plannedAccount.name}</span>
              </div>
            )}
            {item.notes && (
              <div className="col-span-2 text-[11px] text-[#667085] italic truncate">
                &ldquo;{item.notes}&rdquo;
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E5ECE8]/60 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {!isPurchased && onMarkPurchased && (
            <Button
              size="sm"
              onClick={() => onMarkPurchased(item)}
              className="h-8 px-2.5 rounded-lg bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Purchased
            </Button>
          )}

          {!isPurchased && !isReady && onSetReady && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetReady(item.id)}
              className="h-8 px-2.5 rounded-lg border-[#E5ECE8] text-[#2563EB] hover:bg-[#EBF5FB] text-xs font-medium flex items-center gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Mark Ready
            </Button>
          )}

          {isPurchased && onUnmarkPurchased && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    `Revert purchase for "${item.name}"? If an expense transaction was recorded, it will be deleted and your account balance restored.`
                  )
                ) {
                  onUnmarkPurchased(item.id);
                }
              }}
              className="h-8 px-2.5 rounded-lg border-[#E5ECE8] text-[#D97706] hover:bg-[#FFF4DF] text-xs font-medium flex items-center gap-1"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Unmark as Purchased
            </Button>
          )}

          {!isPurchased && onEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(item)}
              className="h-8 px-2 rounded-lg text-[#475467] hover:text-[#111827] text-xs"
              title="Edit item"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {onArchive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Archive "${item.name}"?`)) {
                onArchive(item.id);
              }
            }}
            className="h-8 px-2 rounded-lg text-[#98A2B3] hover:text-[#EF4444] hover:bg-[#FEF3F2] text-xs"
            title="Archive item"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

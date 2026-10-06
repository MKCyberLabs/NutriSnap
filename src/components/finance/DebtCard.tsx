'use client';

import React from 'react';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount, formatIndianRupees } from '@/components/design-system/MoneyAmount';
import {
  User,
  Calendar,
  Archive,
  CheckCircle2,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

interface DebtCardProps {
  debt: {
    id: string;
    direction: string;
    counterpartyName: string;
    title?: string | null;
    originalAmount: string | number;
    outstandingAmount: string | number;
    startedAt: string | Date;
    dueAt?: string | Date | null;
    status: string;
    notes?: string | null;
    isOverdue?: boolean;
    transactions?: Array<any>;
  };
  onCollect?: (debt: any) => void;
  onRepay?: (debt: any) => void;
  onLendMore?: (debt: any) => void;
  onBorrowMore?: (debt: any) => void;
  onSettle?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function DebtCard({
  debt,
  onCollect,
  onRepay,
  onLendMore,
  onBorrowMore,
  onSettle,
  onArchive,
}: DebtCardProps) {
  const isReceivable = debt.direction === 'RECEIVABLE';
  const isOpen = debt.status === 'OPEN';
  const isSettled = debt.status === 'SETTLED';

  let formattedStarted = '';
  try {
    const d = typeof debt.startedAt === 'string' ? parseISO(debt.startedAt) : debt.startedAt;
    formattedStarted = format(d, 'dd MMM yyyy');
  } catch {
    formattedStarted = String(debt.startedAt);
  }

  let formattedDue = '';
  if (debt.dueAt) {
    try {
      const d = typeof debt.dueAt === 'string' ? parseISO(debt.dueAt) : debt.dueAt;
      formattedDue = format(d, 'dd MMM yyyy');
    } catch {
      formattedDue = String(debt.dueAt);
    }
  }

  return (
    <div className="rounded-[14px] border border-[#E5ECE8] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] flex flex-col justify-between hover:shadow-[0_6px_18px_rgba(16,24,40,0.06)] transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isReceivable
                  ? 'bg-[#EAF8EF] border-[#C3EBD0] text-[#16A34A]'
                  : 'bg-[#FFF4DF] border-[#FDE5B3] text-[#F59E0B]'
              }`}
            >
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111827] leading-tight">
                {debt.counterpartyName}
              </h3>
              {debt.title ? (
                <p className="text-xs text-[#667085] mt-0.5 truncate max-w-[180px]">
                  {debt.title}
                </p>
              ) : debt.notes ? (
                <p className="text-xs text-[#667085] mt-0.5 truncate max-w-[180px]">
                  {debt.notes}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <StatusPill
              label={isReceivable ? 'Owed to Me' : 'I Owe'}
              tone={isReceivable ? 'green' : 'amber'}
            />
            {debt.isOverdue && (
              <StatusPill label="Overdue" tone="red" />
            )}
            {isSettled && (
              <StatusPill label="Settled" tone="neutral" />
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#E5ECE8]/60">
          <div className="text-xs text-[#667085]">
            {isOpen ? 'Outstanding Balance' : 'Settled Balance'}
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#111827] mt-1">
            <MoneyAmount
              amount={debt.outstandingAmount}
              type={isReceivable ? 'INCOME' : 'EXPENSE'}
              size="lg"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#667085] mt-2 pt-2 border-t border-[#E5ECE8]/40">
            <span>Original: ₹{formatIndianRupees(debt.originalAmount)}</span>
            <span>Started {formattedStarted}</span>
          </div>

          {formattedDue && (
            <div className={`text-xs mt-1.5 flex items-center gap-1.5 ${debt.isOverdue ? 'text-[#EF4444] font-medium' : 'text-[#667085]'}`}>
              <Calendar className="h-3 w-3" />
              <span>Due: {formattedDue}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E5ECE8]/60 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isOpen && isReceivable && onCollect && (
            <Button
              size="sm"
              onClick={() => onCollect(debt)}
              className="h-8 px-2.5 rounded-lg bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1"
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>Collect</span>
            </Button>
          )}

          {isOpen && isReceivable && onLendMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLendMore(debt)}
              className="h-8 px-2.5 rounded-lg border-[#E5ECE8] text-[#344054] hover:bg-[#F7FAF8] text-xs font-medium flex items-center gap-1"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Lend More</span>
            </Button>
          )}

          {isOpen && !isReceivable && onRepay && (
            <Button
              size="sm"
              onClick={() => onRepay(debt)}
              className="h-8 px-2.5 rounded-lg bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Repay</span>
            </Button>
          )}

          {isOpen && !isReceivable && onBorrowMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBorrowMore(debt)}
              className="h-8 px-2.5 rounded-lg border-[#E5ECE8] text-[#344054] hover:bg-[#F7FAF8] text-xs font-medium flex items-center gap-1"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Borrow More</span>
            </Button>
          )}

          {isOpen && onSettle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSettle(debt.id)}
              className="h-8 px-2 rounded-lg text-[#667085] hover:text-[#16A34A] hover:bg-[#EAF8EF] text-xs flex items-center gap-1"
              title="Mark as Settled"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Settle</span>
            </Button>
          )}
        </div>

        {onArchive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(debt.id)}
            className="h-8 w-8 p-0 rounded-lg text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC]"
            title="Archive record"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

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
  Pencil,
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
  onEdit?: (debt: any) => void;
  onCollect?: (debt: any) => void;
  onRepay?: (debt: any) => void;
  onLendMore?: (debt: any) => void;
  onBorrowMore?: (debt: any) => void;
  onSettle?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function DebtCard({
  debt,
  onEdit,
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
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] flex flex-col justify-between hover:border-[#8B5CF6] transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${
                isReceivable
                  ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
                  : 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]'
              }`}
            >
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B] leading-tight">
                {debt.counterpartyName}
              </h3>
              {debt.title ? (
                <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[180px]">
                  {debt.title}
                </p>
              ) : debt.notes ? (
                <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[180px]">
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

        <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">
            {isOpen ? 'Outstanding Balance' : 'Settled Balance'}
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#1E293B] mt-1">
            <MoneyAmount
              amount={debt.outstandingAmount}
              type={isReceivable ? 'INCOME' : 'EXPENSE'}
              size="lg"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#64748B] mt-2 pt-2 border-t border-[#E2E8F0]">
            <span>Original: ₹{formatIndianRupees(debt.originalAmount)}</span>
            <span>Started {formattedStarted}</span>
          </div>

          {formattedDue && (
            <div className={`text-xs mt-1.5 flex items-center gap-1.5 ${debt.isOverdue ? 'text-[#DC2626] font-medium' : 'text-[#64748B]'}`}>
              <Calendar className="h-3 w-3" />
              <span>Due: {formattedDue}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(debt)}
              className="h-8 px-2.5 rounded-xl border-[#E2E8F0] text-[#1E293B] hover:bg-[#F5F3FF] hover:border-[#6D28D9] hover:text-[#6D28D9] text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
          )}

          {isOpen && isReceivable && onCollect && (
            <Button
              size="sm"
              onClick={() => onCollect(debt)}
              className="h-8 px-2.5 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors"
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
              className="h-8 px-2.5 rounded-xl border-[#E2E8F0] text-[#1E293B] hover:bg-[#F5F3FF] hover:border-[#6D28D9] hover:text-[#6D28D9] text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Lend More</span>
            </Button>
          )}

          {isOpen && !isReceivable && onRepay && (
            <Button
              size="sm"
              onClick={() => onRepay(debt)}
              className="h-8 px-2.5 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors"
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
              className="h-8 px-2.5 rounded-xl border-[#E2E8F0] text-[#1E293B] hover:bg-[#F5F3FF] hover:border-[#6D28D9] hover:text-[#6D28D9] text-xs font-medium flex items-center gap-1 transition-colors"
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
              className="h-8 px-2 rounded-xl text-[#64748B] hover:text-[#059669] hover:bg-[#ECFDF5] text-xs flex items-center gap-1 transition-colors"
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
            className="h-8 w-8 p-0 rounded-xl text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
            title="Archive record"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

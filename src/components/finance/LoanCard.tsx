'use client';

import React from 'react';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount, formatIndianRupees } from '@/components/design-system/MoneyAmount';
import {
  CreditCard,
  Building2,
  Calendar,
  Archive,
  CheckCircle2,
  Sliders,
  DollarSign,
  Percent,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

interface LoanCardProps {
  loan: {
    id: string;
    name: string;
    lender: string;
    loanType: string;
    originalPrincipal?: string | number | null;
    outstandingPrincipal: string | number;
    emiAmount?: string | number | null;
    interestRate?: string | number | null;
    tenureMonths?: number | null;
    emiDueDay?: number | null;
    startedAt: string | Date;
    closedAt?: string | Date | null;
    status: string;
    notes?: string | null;
    emiGeneratesExpense?: boolean;
    principalAlreadyRecognized?: boolean;
    paymentAccount?: { id: string; name: string } | null;
    payments?: Array<any>;
  };
  onEdit?: (loan: any) => void;
  onRecordEmi?: (loan: any) => void;
  onReconcile?: (loan: any) => void;
  onClose?: (loanId: string) => void;
  onArchive?: (loanId: string) => void;
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  PERSONAL: 'Personal Loan',
  HOME: 'Home Loan',
  VEHICLE: 'Vehicle Loan',
  EDUCATION: 'Education Loan',
  GOLD: 'Gold Loan',
  PRODUCT_EMI: 'Product EMI',
  CREDIT_CARD_EMI: 'Credit Card EMI',
  OTHER: 'Other Loan',
};

export function LoanCard({
  loan,
  onEdit,
  onRecordEmi,
  onReconcile,
  onClose,
  onArchive,
}: LoanCardProps) {
  const isActive = loan.status === 'ACTIVE';
  const isClosed = loan.status === 'CLOSED';

  const outstanding = parseFloat(String(loan.outstandingPrincipal)) || 0;
  const original = loan.originalPrincipal ? parseFloat(String(loan.originalPrincipal)) : null;

  let progressPercent = 0;
  let repaidAmount = 0;
  if (original && original > 0) {
    repaidAmount = Math.max(0, original - outstanding);
    progressPercent = Math.min(100, Math.max(0, (repaidAmount / original) * 100));
  }

  let formattedStarted = '';
  try {
    const d = typeof loan.startedAt === 'string' ? parseISO(loan.startedAt) : loan.startedAt;
    formattedStarted = format(d, 'dd MMM yyyy');
  } catch {
    formattedStarted = String(loan.startedAt);
  }

  const typeLabel = LOAN_TYPE_LABELS[loan.loanType] || loan.loanType;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] flex flex-col justify-between hover:border-[#8B5CF6] transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0">
              {loan.loanType === 'CREDIT_CARD_EMI' ? (
                <CreditCard className="h-5 w-5" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B] leading-tight">
                {loan.name}
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[180px]">
                {loan.lender}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <StatusPill label={typeLabel} tone="purple" />
            {isClosed ? (
              <StatusPill label="Closed" tone="neutral" />
            ) : (
              <StatusPill label="Active" tone="green" />
            )}
          </div>
        </div>

        {loan.loanType === 'CREDIT_CARD_EMI' && (
          <div className="mb-3 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475569] flex items-center gap-1.5">
            <span className="font-medium text-[#1E293B]">CC EMI Rule:</span>
            {loan.principalAlreadyRecognized
              ? 'Principal pre-recognized on purchase (EMI creates no duplicate expense)'
              : 'EMI generates monthly expense'}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">
            {isActive ? 'Outstanding Principal' : 'Remaining Balance'}
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#1E293B] mt-1">
            <MoneyAmount
              amount={loan.outstandingPrincipal}
              type="EXPENSE"
              size="lg"
            />
          </div>

          {original !== null && original > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[#64748B] mb-1.5">
                <span>Repaid: ₹{formatIndianRupees(repaidAmount)}</span>
                <span className="font-medium text-[#1E293B]">{progressPercent.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#6D28D9] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-[#94A3B8] mt-1 text-right">
                Original Principal: ₹{formatIndianRupees(original)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-[#64748B] mt-3 pt-2.5 border-t border-[#E2E8F0]">
            {loan.emiAmount && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-[#6D28D9]" />
                <span>EMI: ₹{formatIndianRupees(loan.emiAmount)}</span>
              </div>
            )}
            {loan.emiDueDay && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#475569]" />
                <span>Due on {loan.emiDueDay}th</span>
              </div>
            )}
            {loan.interestRate && (
              <div className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-[#475569]" />
                <span>{loan.interestRate}% p.a.</span>
              </div>
            )}
            {loan.tenureMonths && (
              <div className="flex items-center gap-1.5">
                <span>Tenure: {loan.tenureMonths} mo</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 col-span-2 text-[11px] text-[#94A3B8]">
              <span>Started: {formattedStarted}</span>
              {loan.paymentAccount && (
                <span className="truncate">• From {loan.paymentAccount.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(loan)}
              className="h-8 px-2.5 rounded-xl border-[#E2E8F0] text-[#1E293B] hover:bg-[#F5F3FF] hover:border-[#6D28D9] hover:text-[#6D28D9] text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}

          {isActive && onRecordEmi && (
            <Button
              size="sm"
              onClick={() => onRecordEmi(loan)}
              className="h-8 px-2.5 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Pay EMI
            </Button>
          )}

          {isActive && onReconcile && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReconcile(loan)}
              className="h-8 px-2.5 rounded-xl border-[#E2E8F0] text-[#1E293B] hover:bg-[#F5F3FF] hover:border-[#6D28D9] hover:text-[#6D28D9] text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Sliders className="h-3.5 w-3.5" />
              Reconcile
            </Button>
          )}

          {isActive && onClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm(`Mark ${loan.name} as closed?`)) {
                  onClose(loan.id);
                }
              }}
              className="h-8 px-2.5 rounded-xl border-[#E2E8F0] text-[#059669] hover:bg-[#ECFDF5] text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Close
            </Button>
          )}
        </div>

        {onArchive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Archive ${loan.name}? This will remove it from active listings.`)) {
                onArchive(loan.id);
              }
            }}
            className="h-8 px-2 rounded-xl text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] text-xs"
            title="Archive Loan"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

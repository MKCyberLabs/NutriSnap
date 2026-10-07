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
    <div className="rounded-[14px] border border-[#E5ECE8] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] flex flex-col justify-between hover:shadow-[0_6px_18px_rgba(16,24,40,0.06)] transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl border border-[#FDE5B3] bg-[#FFF4DF] text-[#D97706] flex items-center justify-center shrink-0">
              {loan.loanType === 'CREDIT_CARD_EMI' ? (
                <CreditCard className="h-4 w-4" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111827] leading-tight">
                {loan.name}
              </h3>
              <p className="text-xs text-[#667085] mt-0.5 truncate max-w-[180px]">
                {loan.lender}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <StatusPill label={typeLabel} tone="blue" />
            {isClosed ? (
              <StatusPill label="Closed" tone="neutral" />
            ) : (
              <StatusPill label="Active" tone="green" />
            )}
          </div>
        </div>

        {loan.loanType === 'CREDIT_CARD_EMI' && (
          <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475467] flex items-center gap-1.5">
            <span className="font-medium text-[#1E293B]">CC EMI Rule:</span>
            {loan.principalAlreadyRecognized
              ? 'Principal pre-recognized on purchase (EMI creates no duplicate expense)'
              : 'EMI generates monthly expense'}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#E5ECE8]/60">
          <div className="text-xs text-[#667085]">
            {isActive ? 'Outstanding Principal' : 'Remaining Balance'}
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#111827] mt-1">
            <MoneyAmount
              amount={loan.outstandingPrincipal}
              type="EXPENSE"
              size="lg"
            />
          </div>

          {original !== null && original > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[#667085] mb-1.5">
                <span>Repaid: ₹{formatIndianRupees(repaidAmount)}</span>
                <span className="font-medium text-[#111827]">{progressPercent.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#F2F4F7] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#16A34A] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-[#98A2B3] mt-1 text-right">
                Original Principal: ₹{formatIndianRupees(original)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-[#667085] mt-3 pt-2.5 border-t border-[#E5ECE8]/40">
            {loan.emiAmount && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-[#16A34A]" />
                <span>EMI: ₹{formatIndianRupees(loan.emiAmount)}</span>
              </div>
            )}
            {loan.emiDueDay && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#475467]" />
                <span>Due on {loan.emiDueDay}th</span>
              </div>
            )}
            {loan.interestRate && (
              <div className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-[#475467]" />
                <span>{loan.interestRate}% p.a.</span>
              </div>
            )}
            {loan.tenureMonths && (
              <div className="flex items-center gap-1.5">
                <span>Tenure: {loan.tenureMonths} mo</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 col-span-2 text-[11px] text-[#98A2B3]">
              <span>Started: {formattedStarted}</span>
              {loan.paymentAccount && (
                <span className="truncate">• From {loan.paymentAccount.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E5ECE8]/60 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isActive && onRecordEmi && (
            <Button
              size="sm"
              onClick={() => onRecordEmi(loan)}
              className="h-8 px-2.5 rounded-lg bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1"
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
              className="h-8 px-2.5 rounded-lg border-[#E5ECE8] text-[#344054] hover:bg-[#F9FAFB] text-xs font-medium flex items-center gap-1"
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
              className="h-8 px-2 rounded-lg border-[#E5ECE8] text-[#16A34A] hover:bg-[#EAF8EF] text-xs font-medium flex items-center gap-1"
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
            className="h-8 px-2 rounded-lg text-[#98A2B3] hover:text-[#EF4444] hover:bg-[#FEF3F2] text-xs"
            title="Archive Loan"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

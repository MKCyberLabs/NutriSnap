import React from 'react';
import { MetricCard } from '@/components/design-system/MetricCard';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { WalletCards, ArrowUpRight, ArrowDownRight, ReceiptText } from 'lucide-react';
import { TodayWealthSummary } from '@/app/today/actions';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface TodayMetricGridProps {
  wealth: TodayWealthSummary;
}

export function TodayMetricGrid({ wealth }: TodayMetricGridProps) {
  let billValueText = 'None due';
  let billHelperText = 'No upcoming obligations';

  if (wealth.nextDueObligation) {
    const ob = wealth.nextDueObligation;
    billValueText = ob.amount ? `₹${formatIndianRupees(ob.amount)}` : ob.title;
    try {
      const dueDate = parseISO(ob.nextDueAt);
      const isPast = dueDate.getTime() < Date.now();
      const relative = formatDistanceToNow(dueDate, { addSuffix: true });
      billHelperText = `${ob.title} • ${isPast ? 'Overdue' : 'Due ' + relative}`;
    } catch {
      billHelperText = ob.title;
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Balance */}
      <MetricCard
        label="Total Balance"
        value={`₹${formatIndianRupees(wealth.totalBalance)}`}
        icon={<WalletCards className="h-4 w-4" />}
        tone="purple"
        helperText="Across all active accounts"
        href="/finance/accounts"
      />

      {/* 2. Monthly Income */}
      <MetricCard
        label="Monthly Income"
        value={`+₹${formatIndianRupees(wealth.monthlyIncome)}`}
        icon={<ArrowUpRight className="h-4 w-4" />}
        tone="green"
        helperText="Earnings this month"
        href="/finance/transactions"
      />

      {/* 3. Monthly Expenses */}
      <MetricCard
        label="Monthly Expenses"
        value={`-₹${formatIndianRupees(wealth.monthlyExpense)}`}
        icon={<ArrowDownRight className="h-4 w-4" />}
        tone="red"
        helperText="Spending this month"
        href="/finance/transactions"
      />

      {/* 4. Upcoming Bill */}
      <MetricCard
        label="Upcoming Bill"
        value={billValueText}
        icon={<ReceiptText className="h-4 w-4" />}
        tone="amber"
        helperText={billHelperText}
        href="/finance/bills"
      />
    </div>
  );
}

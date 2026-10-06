import React from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/design-system/SectionCard';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import {
  Utensils,
  Droplets,
  WalletCards,
  ReceiptText,
  Bell,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import {
  TodayFoodSummary,
  TodayWaterSummary,
  TodayWealthSummary,
  TodayRemindersSummary,
} from '@/app/today/actions';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface TodayFocusListProps {
  food: TodayFoodSummary;
  water: TodayWaterSummary;
  wealth: TodayWealthSummary;
  reminders: TodayRemindersSummary;
}

export function TodayFocusList({
  food,
  water,
  wealth,
  reminders,
}: TodayFocusListProps) {
  // 1. Food focus
  const foodSubtitle =
    food.loggedMealsCount > 0
      ? `${food.loggedMealsCount} meal${food.loggedMealsCount === 1 ? '' : 's'} logged (${food.totalCalories} kcal)`
      : 'No meals logged yet today';
  const foodComplete = food.loggedMealsCount > 0;

  // 2. Water focus
  const waterSubtitle = `${water.totalMl.toLocaleString()} / ${water.dailyGoalMl.toLocaleString()} ml (${water.percent}%)`;
  const waterComplete = water.percent >= 100;

  // 3. Money focus
  const monthlyExp = parseFloat(wealth.monthlyExpense) || 0;
  const moneySubtitle = monthlyExp > 0
    ? `₹${formatIndianRupees(wealth.monthlyExpense)} spent this month`
    : 'No expenses recorded this month';

  // 4. Upcoming bill focus
  let billTitle = 'No upcoming bills';
  let billSubtitle = 'All obligations up to date';
  if (wealth.nextDueObligation) {
    const ob = wealth.nextDueObligation;
    billTitle = ob.title;
    try {
      const d = parseISO(ob.nextDueAt);
      const isPast = d.getTime() < Date.now();
      billSubtitle = `${ob.amount ? `₹${formatIndianRupees(ob.amount)} • ` : ''}${
        isPast ? 'Overdue' : 'Due ' + formatDistanceToNow(d, { addSuffix: true })
      }`;
    } catch {
      billSubtitle = ob.amount ? `₹${formatIndianRupees(ob.amount)}` : 'Upcoming';
    }
  }

  // 5. Next reminder focus
  let reminderTitle = 'All caught up';
  let reminderSubtitle = 'No pending reminders for today';
  if (reminders.dueToday.length > 0) {
    const nextRem = reminders.dueToday[0];
    reminderTitle = nextRem.title;
    reminderSubtitle = nextRem.timeOrDue ? `Scheduled at ${nextRem.timeOrDue}` : 'Scheduled today';
  } else if (reminders.upcomingThisWeek.length > 0) {
    const upcoming = reminders.upcomingThisWeek[0];
    reminderTitle = upcoming.title;
    reminderSubtitle = 'Upcoming this week';
  }

  const items = [
    {
      title: 'Log your meals',
      subtitle: foodSubtitle,
      icon: <Utensils className="h-4 w-4" />,
      iconBg: 'bg-[#EAF8EF] text-[#16A34A]',
      href: '/dashboard',
      isComplete: foodComplete,
    },
    {
      title: 'Drink water',
      subtitle: waterSubtitle,
      icon: <Droplets className="h-4 w-4" />,
      iconBg: 'bg-[#EAF3FF] text-[#2F80ED]',
      href: '/hydration',
      isComplete: waterComplete,
    },
    {
      title: 'Review expenses',
      subtitle: moneySubtitle,
      icon: <WalletCards className="h-4 w-4" />,
      iconBg: 'bg-[#FDECEC] text-[#EF4444]',
      href: '/finance/transactions',
      isComplete: false,
    },
    {
      title: wealth.nextDueObligation ? `Bill: ${billTitle}` : 'Upcoming bill',
      subtitle: billSubtitle,
      icon: <ReceiptText className="h-4 w-4" />,
      iconBg: 'bg-[#FFF4DF] text-[#F59E0B]',
      href: '/finance/bills',
      isComplete: !wealth.nextDueObligation,
    },
    {
      title: reminders.dueToday.length > 0 ? `Reminder: ${reminderTitle}` : 'Daily reminders',
      subtitle: reminderSubtitle,
      icon: <Bell className="h-4 w-4" />,
      iconBg: 'bg-[#F7FAF8] text-[#667085]',
      href: '/reminders',
      isComplete: reminders.dueToday.length === 0,
    },
  ];

  return (
    <SectionCard
      title="Today's Focus"
      description="Essential daily actions across health and wealth"
      className="h-full flex flex-col justify-between"
    >
      <div className="divide-y divide-[#E5ECE8]/80">
        {items.map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="flex items-center justify-between py-3 px-1 hover:bg-[#F7FAF8]/80 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.iconBg}`}
                aria-hidden="true"
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#111827] truncate group-hover:text-[#16A34A] transition-colors">
                  {item.title}
                </div>
                <div className="text-xs text-[#667085] truncate mt-0.5">
                  {item.subtitle}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1 text-[#667085] group-hover:text-[#111827]">
              {item.isComplete && (
                <CheckCircle2 className="h-4 w-4 text-[#16A34A] mr-1" aria-label="Completed" />
              )}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

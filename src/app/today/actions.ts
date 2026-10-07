'use server';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { TZDate } from '@date-fns/tz';
import { startOfDay, endOfDay } from 'date-fns';
import { getMonthlyFinanceSummary, getObligations } from '@/lib/finance/finance-service';

export interface TodayFoodSummary {
  status: 'ok' | 'error';
  error?: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  caloriesGoal: number;
  proteinGoal: number;
  loggedMealsCount: number;
  mealCategories: string[];
}

export interface TodayWaterSummary {
  status: 'ok' | 'error';
  error?: string;
  totalMl: number;
  dailyGoalMl: number;
  percent: number;
}

export interface TodayWealthSummary {
  status: 'ok' | 'error';
  error?: string;
  monthlyIncome: string;
  monthlyExpense: string;
  totalBalance: string;
  nextDueObligation: {
    id: string;
    title: string;
    amount: string | null;
    nextDueAt: string;
    kind: string;
  } | null;
}

export interface TodayReminderItem {
  id: string;
  domain: string;
  title: string;
  timeOrDue: string;
  type: string;
  isOverdue?: boolean;
}

export interface TodayRemindersSummary {
  status: 'ok' | 'error';
  error?: string;
  dueToday: TodayReminderItem[];
  upcomingThisWeek: TodayReminderItem[];
}

export interface TodaySummaryData {
  user: {
    id: string;
    name: string | null;
    timezone: string;
  };
  food: TodayFoodSummary;
  water: TodayWaterSummary;
  wealth: TodayWealthSummary;
  reminders: TodayRemindersSummary;
}

export async function getTodaySummary(userId: string): Promise<TodaySummaryData> {
  const authUser = await requireUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      name: true,
      timezone: true,
      dailyCaloriesGoal: true,
      dailyProteinGoal: true,
      dailyWaterGoal: true,
    }
  });

  const tz = user?.timezone || 'UTC';
  const now = new Date();
  const nowInTz = new TZDate(now, tz);
  const dayStart = startOfDay(nowInTz);
  const dayEnd = endOfDay(nowInTz);

  // 1. Food module
  let food: TodayFoodSummary;
  try {
    const meals = await prisma.mealLog.findMany({
      where: {
        userId: authUser.id,
        createdAt: { gte: dayStart, lte: dayEnd }
      }
    });

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    const categories = new Set<string>();

    for (const m of meals) {
      totalCalories += m.totalCalories || 0;
      totalProtein += m.totalProtein || 0;
      totalCarbs += m.totalCarbs || 0;
      totalFat += m.totalFat || 0;
      if (m.category) categories.add(m.category);
    }

    food = {
      status: 'ok',
      totalCalories: Math.round(totalCalories),
      totalProtein: Math.round(totalProtein),
      totalCarbs: Math.round(totalCarbs),
      totalFat: Math.round(totalFat),
      caloriesGoal: user?.dailyCaloriesGoal || 2000,
      proteinGoal: user?.dailyProteinGoal || 100,
      loggedMealsCount: meals.length,
      mealCategories: Array.from(categories),
    };
  } catch (err: any) {
    food = {
      status: 'error',
      error: err?.message || 'Failed to load food summary',
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      caloriesGoal: 2000,
      proteinGoal: 100,
      loggedMealsCount: 0,
      mealCategories: [],
    };
  }

  // 2. Water module
  let water: TodayWaterSummary;
  try {
    const logs = await prisma.hydrationLog.findMany({
      where: {
        userId: authUser.id,
        createdAt: { gte: dayStart, lte: dayEnd }
      }
    });

    const totalMl = logs.reduce((acc: number, l: any) => acc + (l.amountMl || 0), 0);
    const goal = user?.dailyWaterGoal || 2750;

    water = {
      status: 'ok',
      totalMl,
      dailyGoalMl: goal,
      percent: Math.min(100, Math.round((totalMl / goal) * 100)),
    };
  } catch (err: any) {
    water = {
      status: 'error',
      error: err?.message || 'Failed to load water summary',
      totalMl: 0,
      dailyGoalMl: 2750,
      percent: 0,
    };
  }

  // 3. Wealth module
  let wealth: TodayWealthSummary;
  try {
    const finSummary = await getMonthlyFinanceSummary(authUser.id, now);
    const obligations = await getObligations(authUser.id);

    const activeUpcoming = obligations
      .filter((o) => o.isActive)
      .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

    const nextDue = activeUpcoming.length > 0 ? activeUpcoming[0] : null;

    wealth = {
      status: 'ok',
      monthlyIncome: finSummary.income,
      monthlyExpense: finSummary.expense,
      totalBalance: finSummary.totalBalance,
      nextDueObligation: nextDue ? {
        id: nextDue.id,
        title: nextDue.title,
        amount: nextDue.amount,
        nextDueAt: nextDue.nextDueAt,
        kind: nextDue.kind,
      } : null,
    };
  } catch (err: any) {
    wealth = {
      status: 'error',
      error: err?.message || 'Failed to load wealth summary',
      monthlyIncome: '0',
      monthlyExpense: '0',
      totalBalance: '0',
      nextDueObligation: null,
    };
  }

  // 4. Reminders module
  let reminders: TodayRemindersSummary;
  try {
    const userReminders = await prisma.reminder.findMany({
      where: { userId: authUser.id, isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    const obligations = await prisma.obligation.findMany({
      where: { userId: authUser.id, isActive: true, isArchived: false },
      orderBy: { nextDueAt: 'asc' }
    });

    const dueToday: TodayReminderItem[] = [];
    const upcomingThisWeek: TodayReminderItem[] = [];

    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Health / meal reminders
    for (const r of userReminders) {
      if (r.timeOfDay || r.time) {
        dueToday.push({
          id: r.id,
          domain: r.domain || 'HEALTH',
          title: r.title || r.category || 'Reminder',
          timeOrDue: r.timeOfDay || r.time || '',
          type: r.type || 'MEAL',
        });
      }
    }

    // Obligations
    for (const ob of obligations) {
      const nextDue = new Date(ob.nextDueAt);
      const isDueToday = nextDue.getTime() <= dayEnd.getTime();
      const isDueWeek = nextDue.getTime() > dayEnd.getTime() && nextDue.getTime() <= weekFromNow.getTime();

      const item: TodayReminderItem = {
        id: ob.id,
        domain: 'FINANCE',
        title: ob.title,
        timeOrDue: ob.nextDueAt.toISOString(),
        type: ob.kind,
        isOverdue: nextDue.getTime() < now.getTime(),
      };

      if (isDueToday) {
        dueToday.push(item);
      } else if (isDueWeek) {
        upcomingThisWeek.push(item);
      }
    }

    // Near-term Personal Debts (Friends & Family)
    const debts = await prisma.personalDebt.findMany({
      where: {
        userId: authUser.id,
        status: 'OPEN',
        dueAt: { not: null, lte: weekFromNow },
      },
    });

    for (const d of debts) {
      if (!d.dueAt) continue;
      const dueDate = new Date(d.dueAt);
      const isDueToday = dueDate.getTime() <= dayEnd.getTime();
      const isDueWeek = dueDate.getTime() > dayEnd.getTime() && dueDate.getTime() <= weekFromNow.getTime();

      const item: TodayReminderItem = {
        id: d.id,
        domain: 'FINANCE',
        title: d.direction === 'RECEIVABLE' ? `Collect: ${d.counterpartyName}` : `Repay: ${d.counterpartyName}`,
        timeOrDue: d.dueAt.toISOString(),
        type: d.direction === 'RECEIVABLE' ? 'DEBT_COLLECT' : 'DEBT_REPAY',
        isOverdue: dueDate.getTime() < now.getTime(),
      };

      if (isDueToday) {
        dueToday.push(item);
      } else if (isDueWeek) {
        upcomingThisWeek.push(item);
      }
    }

    // Near-term active loans (not already linked to obligations)
    const unlinkedLoans = await prisma.loan.findMany({
      where: {
        userId: authUser.id,
        status: 'ACTIVE',
        obligationId: null,
        nextEmiDate: { not: null, lte: weekFromNow },
      },
    });

    for (const l of unlinkedLoans) {
      if (!l.nextEmiDate) continue;
      const dueDate = new Date(l.nextEmiDate);
      const isDueToday = dueDate.getTime() <= dayEnd.getTime();
      const isDueWeek = dueDate.getTime() > dayEnd.getTime() && dueDate.getTime() <= weekFromNow.getTime();

      const item: TodayReminderItem = {
        id: l.id,
        domain: 'FINANCE',
        title: `EMI: ${l.name}`,
        timeOrDue: l.nextEmiDate.toISOString(),
        type: 'EMI',
        isOverdue: dueDate.getTime() < now.getTime(),
      };

      if (isDueToday) {
        dueToday.push(item);
      } else if (isDueWeek) {
        upcomingThisWeek.push(item);
      }
    }

    reminders = {
      status: 'ok',
      dueToday,
      upcomingThisWeek,
    };
  } catch (err: any) {
    reminders = {
      status: 'error',
      error: err?.message || 'Failed to load reminders summary',
      dueToday: [],
      upcomingThisWeek: [],
    };
  }

  return {
    user: {
      id: authUser.id,
      name: user?.name || null,
      timezone: tz,
    },
    food,
    water,
    wealth,
    reminders,
  };
}

export interface TodayRecentTransaction {
  id: string;
  type: string;
  amount: string;
  category: string;
  occurredAt: string;
  accountName: string;
  note?: string | null;
}

export async function getTodayRecentTransactions(userId: string): Promise<TodayRecentTransaction[]> {
  const authUser = await requireUser(userId);

  const txs = await prisma.financialTransaction.findMany({
    where: { userId: authUser.id },
    orderBy: { occurredAt: 'desc' },
    take: 5,
    include: {
      account: {
        select: { name: true },
      },
    },
  });

  return txs.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount.toString(),
    category: tx.category,
    occurredAt: tx.occurredAt.toISOString(),
    accountName: tx.account.name,
    note: tx.note,
  }));
}

import { Decimal } from '@/lib/finance/finance';

export interface RawMeal {
  id: string;
  userId: string;
  category?: string | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: Date;
}

export interface RawWaterLog {
  id: string;
  userId: string;
  amountMl: number;
  createdAt: Date;
}

export interface RawObligation {
  id: string;
  userId: string;
  title: string;
  kind: string;
  amount?: string | null;
  nextDueAt: Date;
  isActive: boolean;
}

export function aggregateFoodDay(
  meals: RawMeal[],
  userId: string,
  caloriesGoal: number = 2000,
  proteinGoal: number = 100
) {
  // Enforce strict user scoping
  const userMeals = meals.filter((m) => m.userId === userId);

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  const categories = new Set<string>();

  for (const m of userMeals) {
    totalCalories += m.totalCalories || 0;
    totalProtein += m.totalProtein || 0;
    totalCarbs += m.totalCarbs || 0;
    totalFat += m.totalFat || 0;
    if (m.category) categories.add(m.category);
  }

  return {
    totalCalories: Math.round(totalCalories),
    totalProtein: Math.round(totalProtein),
    totalCarbs: Math.round(totalCarbs),
    totalFat: Math.round(totalFat),
    caloriesGoal,
    proteinGoal,
    loggedMealsCount: userMeals.length,
    mealCategories: Array.from(categories),
    isEmpty: userMeals.length === 0,
  };
}

export function aggregateWaterDay(
  logs: RawWaterLog[],
  userId: string,
  dailyGoalMl: number = 2750
) {
  // Enforce strict user scoping
  const userLogs = logs.filter((l) => l.userId === userId);
  const totalMl = userLogs.reduce((acc, l) => acc + (l.amountMl || 0), 0);

  return {
    totalMl,
    dailyGoalMl,
    percent: Math.min(100, Math.round((totalMl / dailyGoalMl) * 100)),
    isEmpty: userLogs.length === 0,
  };
}

export function aggregateWealthSummary(params: {
  monthlyIncome: string;
  monthlyExpense: string;
  accountBalances: string[];
  obligations: RawObligation[];
  userId: string;
}) {
  const { monthlyIncome, monthlyExpense, accountBalances, obligations, userId } = params;

  // Enforce strict user scoping for obligations
  const userObligations = obligations.filter((o) => o.userId === userId && o.isActive);
  userObligations.sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());

  const totalBalance = accountBalances.reduce(
    (acc, b) => acc.plus(new Decimal(b)),
    new Decimal(0)
  );

  return {
    monthlyIncome,
    monthlyExpense,
    totalBalance: totalBalance.toString(),
    nextDueObligation: userObligations.length > 0 ? {
      id: userObligations[0].id,
      title: userObligations[0].title,
      amount: userObligations[0].amount || null,
      nextDueAt: userObligations[0].nextDueAt.toISOString(),
      kind: userObligations[0].kind,
    } : null,
    isEmpty: accountBalances.length === 0 && monthlyIncome === '0' && monthlyExpense === '0',
  };
}

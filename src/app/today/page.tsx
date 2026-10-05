'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { getTodaySummary, TodaySummaryData } from './actions';
import { logHydration } from '@/app/hydration/actions';
import { markObligationPaid } from '@/app/finance/actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { QuickAddModal } from '@/components/quick-add/QuickAddModal';
import {
  Utensils,
  Droplets,
  Wallet,
  Bell,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Calendar as CalendarIcon,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

export default function TodayPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<TodaySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async (userId: string) => {
    try {
      const summary = await getTodaySummary(userId);
      setData(summary);
    } catch (err: any) {
      toast({
        title: 'Error loading overview',
        description: err?.message || 'Could not fetch today summary',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

  const handleQuickWater = async (amountMl: number) => {
    const session = getAuthSession();
    if (!session) return;
    setActionLoading(true);
    try {
      await logHydration(session.id, amountMl, 'Water');
      toast({
        title: 'Water Logged',
        description: `Added +${amountMl} ml to today's hydration.`,
      });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Failed to log water',
        description: err?.message || 'Error logging water',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async (obligationId: string, nextDueAt: string) => {
    const session = getAuthSession();
    if (!session) return;
    setActionLoading(true);
    const occurrenceKey = nextDueAt.split('T')[0];
    try {
      await markObligationPaid(session.id, {
        obligationId,
        occurrenceKey,
        createExpense: true,
      });
      toast({
        title: 'Bill Marked Paid',
        description: 'Obligation marked as paid and occurrence recorded.',
      });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err?.message || 'Failed to mark obligation as paid',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-gray-50/60 pb-24 md:pb-12">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header / Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Health + Wealth Hub
              </span>
              <Badge variant="outline" className="text-[10px] text-gray-500 py-0">
                {data?.user?.timezone || 'Asia/Kolkata'}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {getGreeting()}, {data?.user?.name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(new Date(), 'EEEE, d MMMM yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <QuickAddModal>
              <Button className="rounded-2xl gap-2 font-semibold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20">
                <Plus className="h-4 w-4" />
                Quick Add
              </Button>
            </QuickAddModal>
          </div>
        </div>

        {/* Loading state skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        )}

        {/* Content Grid */}
        {!loading && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. HEALTH: Food & Calories */}
            <Card className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                      <Utensils className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Nutrition Today</CardTitle>
                      <CardDescription className="text-xs">Daily food & macro targets</CardDescription>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="rounded-xl gap-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                    <Link href="/dashboard">
                      Food Hub <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                {data.food.status === 'error' ? (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Food Module Unavailable</AlertTitle>
                    <AlertDescription className="text-xs">
                      {data.food.error || 'Failed to load nutrition data.'}
                    </AlertDescription>
                  </Alert>
                ) : data.food.loggedMealsCount === 0 ? (
                  <div className="text-center py-6 space-y-3 bg-orange-50/40 rounded-2xl p-4 border border-orange-100/60">
                    <p className="text-sm font-medium text-gray-700">No meals logged yet today.</p>
                    <p className="text-xs text-gray-500">Track your breakfast or lunch with our AI camera!</p>
                    <Button asChild size="sm" className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white gap-1.5 text-xs">
                      <Link href="/dashboard">
                        <Utensils className="h-3.5 w-3.5" /> Log First Meal
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Calorie Progress */}
                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-2xl font-extrabold text-gray-900">
                          {data.food.totalCalories}{' '}
                          <span className="text-xs font-normal text-gray-500">/ {data.food.caloriesGoal} kcal</span>
                        </span>
                        <Badge variant="secondary" className="text-xs font-semibold bg-orange-100 text-orange-700">
                          {Math.round((data.food.totalCalories / (data.food.caloriesGoal || 2000)) * 100)}%
                        </Badge>
                      </div>
                      <Progress
                        value={Math.min(100, Math.round((data.food.totalCalories / (data.food.caloriesGoal || 2000)) * 100))}
                        className="h-2.5 bg-orange-100"
                      />
                    </div>

                    {/* Macros Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Protein</p>
                        <p className="text-base font-bold text-gray-900">{data.food.totalProtein}g</p>
                        <p className="text-[10px] text-gray-400">of {data.food.proteinGoal}g</p>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Carbs</p>
                        <p className="text-base font-bold text-gray-900">{data.food.totalCarbs}g</p>
                        <p className="text-[10px] text-gray-400">logged</p>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Fat</p>
                        <p className="text-base font-bold text-gray-900">{data.food.totalFat}g</p>
                        <p className="text-[10px] text-gray-400">logged</p>
                      </div>
                    </div>

                    {/* Meal Categories Tagged */}
                    {data.food.mealCategories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs text-gray-500">Logged:</span>
                        {data.food.mealCategories.map((cat) => (
                          <Badge key={cat} variant="outline" className="text-xs bg-white text-gray-700">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. HEALTH: Water / Hydration */}
            <Card className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                      <Droplets className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Hydration</CardTitle>
                      <CardDescription className="text-xs">Daily fluid balance</CardDescription>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="rounded-xl gap-1 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-50">
                    <Link href="/hydration">
                      Water Hub <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                {data.water.status === 'error' ? (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Water Module Unavailable</AlertTitle>
                    <AlertDescription className="text-xs">
                      {data.water.error || 'Failed to load water data.'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {/* Water Progress */}
                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-2xl font-extrabold text-gray-900">
                          {data.water.totalMl}{' '}
                          <span className="text-xs font-normal text-gray-500">/ {data.water.dailyGoalMl} ml</span>
                        </span>
                        <Badge variant="secondary" className="text-xs font-semibold bg-sky-100 text-sky-700">
                          {data.water.percent}%
                        </Badge>
                      </div>
                      <Progress value={data.water.percent} className="h-2.5 bg-sky-100" />
                    </div>

                    {/* Quick Hydration Buttons */}
                    <div className="pt-2">
                      <p className="text-xs text-gray-500 mb-2 font-medium">Quick add hydration:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleQuickWater(250)}
                          className="h-10 rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 gap-1.5 text-xs font-semibold"
                        >
                          <Droplets className="h-3.5 w-3.5 text-sky-500" /> +250 ml (Glass)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleQuickWater(500)}
                          className="h-10 rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 gap-1.5 text-xs font-semibold"
                        >
                          <Droplets className="h-3.5 w-3.5 text-sky-500" /> +500 ml (Bottle)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. WEALTH: Finances & Balance */}
            <Card className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Money & Accounts</CardTitle>
                      <CardDescription className="text-xs">Monthly cashflow & balances</CardDescription>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="rounded-xl gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                    <Link href="/finance">
                      Money Hub <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                {data.wealth.status === 'error' ? (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Wealth Module Unavailable</AlertTitle>
                    <AlertDescription className="text-xs">
                      {data.wealth.error || 'Failed to load financial summary.'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {/* Total Net Balance */}
                    <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                        Total Liquid Balance
                      </p>
                      <p className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mt-1">
                        ₹{parseFloat(data.wealth.totalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Monthly In / Out */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-semibold">
                          <TrendingUp className="h-3 w-3" /> Income
                        </div>
                        <p className="text-sm sm:text-base font-bold text-gray-900 mt-0.5">
                          ₹{parseFloat(data.wealth.monthlyIncome).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-center gap-1 text-rose-600 text-xs font-semibold">
                          <TrendingDown className="h-3 w-3" /> Expense
                        </div>
                        <p className="text-sm sm:text-base font-bold text-gray-900 mt-0.5">
                          ₹{parseFloat(data.wealth.monthlyExpense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Next Due Obligation Banner */}
                    {data.wealth.nextDueObligation && (
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-amber-600" /> Next Due: {data.wealth.nextDueObligation.title}
                          </p>
                          <p className="text-[11px] text-amber-700">
                            {data.wealth.nextDueObligation.amount ? `₹${data.wealth.nextDueObligation.amount} • ` : ''}
                            Due {format(new Date(data.wealth.nextDueObligation.nextDueAt), 'dd MMM yyyy')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleMarkPaid(data.wealth.nextDueObligation!.id, data.wealth.nextDueObligation!.nextDueAt)}
                          className="h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                        >
                          Mark Paid
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. REMINDERS & SCHEDULES */}
            <Card className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Schedule & Reminders</CardTitle>
                      <CardDescription className="text-xs">Health times & upcoming obligations</CardDescription>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="rounded-xl gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    <Link href="/reminders">
                      Reminders <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
                {data.reminders.status === 'error' ? (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Reminders Module Unavailable</AlertTitle>
                    <AlertDescription className="text-xs">
                      {data.reminders.error || 'Failed to load reminders data.'}
                    </AlertDescription>
                  </Alert>
                ) : data.reminders.dueToday.length === 0 && data.reminders.upcomingThisWeek.length === 0 ? (
                  <div className="text-center py-6 space-y-2 bg-indigo-50/40 rounded-2xl p-4 border border-indigo-100/60">
                    <CheckCircle2 className="h-8 w-8 text-indigo-400 mx-auto" />
                    <p className="text-sm font-semibold text-gray-800">All clear today!</p>
                    <p className="text-xs text-gray-500">No scheduled reminders or due bills for today.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.reminders.dueToday.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Scheduled Today
                        </p>
                        <div className="space-y-1.5">
                          {data.reminders.dueToday.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${item.domain === 'FINANCE' ? 'bg-amber-500' : 'bg-primary'}`} />
                                <span className="font-semibold text-gray-800">{item.title}</span>
                              </div>
                              <Badge variant="outline" className="text-[11px] bg-white">
                                {item.timeOrDue.includes('T') ? format(new Date(item.timeOrDue), 'HH:mm') : item.timeOrDue}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {data.reminders.upcomingThisWeek.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Upcoming this week
                        </p>
                        <div className="space-y-1.5">
                          {data.reminders.upcomingThisWeek.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                            >
                              <span className="font-medium text-gray-700">{item.title}</span>
                              <span className="text-[11px] text-gray-500">
                                {format(new Date(item.timeOrDue), 'EEE, d MMM')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

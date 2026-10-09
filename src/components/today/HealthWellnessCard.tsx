import React from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/design-system/SectionCard';
import { ProgressMetric } from '@/components/design-system/ProgressMetric';
import { Utensils, Droplets, ChevronRight, Sparkles } from 'lucide-react';
import { TodayFoodSummary, TodayWaterSummary } from '@/app/today/actions';

interface HealthWellnessCardProps {
  food: TodayFoodSummary;
  water: TodayWaterSummary;
}

export function HealthWellnessCard({ food, water }: HealthWellnessCardProps) {
  return (
    <div className="space-y-4">
      {/* Metrics Card */}
      <SectionCard
        title="Health & Wellness"
        description="Daily nutritional and hydration goals"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-[#059669] hover:text-[#047857] inline-flex items-center gap-1 transition-colors"
            >
              <span>Food</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
            <span className="text-[#E2E8F0]">|</span>
            <Link
              href="/hydration"
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1 transition-colors"
            >
              <span>Water</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Food Calories Progress */}
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#475569]">
              <div className="h-6 w-6 rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
                <Utensils className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-[#1E293B]">Calories</span>
            </div>
            <ProgressMetric
              label="Energy intake"
              current={food.totalCalories}
              goal={food.caloriesGoal}
              unit="kcal"
              tone="green"
              subtitle={
                food.loggedMealsCount > 0
                  ? `${food.loggedMealsCount} meal${food.loggedMealsCount === 1 ? '' : 's'} logged today`
                  : 'No meals logged today'
              }
            />
          </div>

          {/* Water Hydration Progress */}
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#475569]">
              <div className="h-6 w-6 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                <Droplets className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-[#1E293B]">Hydration</span>
            </div>
            <ProgressMetric
              label="Water intake"
              current={water.totalMl}
              goal={water.dailyGoalMl}
              unit="ml"
              tone="blue"
              subtitle={`${water.percent}% of daily goal completed`}
            />
          </div>
        </div>
      </SectionCard>

      {/* Motivational / Life Hub Banner */}
      <div className="rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE] p-4 text-[#6D28D9]">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-[#6D28D9]" />
          <span>Small steps, big results.</span>
        </div>
        <p className="text-xs text-[#475569] mt-1 leading-relaxed">
          Health + Wealth in one calm view. Track your meals, water, and money consistently.
        </p>
      </div>
    </div>
  );
}

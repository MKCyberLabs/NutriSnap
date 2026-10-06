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
              className="text-xs font-semibold text-[#16A34A] hover:text-[#0F7A38] inline-flex items-center gap-1 transition-colors"
            >
              <span>Food</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
            <span className="text-[#E5ECE8]">|</span>
            <Link
              href="/hydration"
              className="text-xs font-semibold text-[#2F80ED] hover:text-[#1D4ED8] inline-flex items-center gap-1 transition-colors"
            >
              <span>Water</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Food Calories Progress */}
          <div className="p-3 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8]/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#344054]">
              <div className="h-6 w-6 rounded-md bg-[#EAF8EF] text-[#16A34A] flex items-center justify-center">
                <Utensils className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-[#111827]">Calories</span>
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
          <div className="p-3 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8]/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#344054]">
              <div className="h-6 w-6 rounded-md bg-[#EAF3FF] text-[#2F80ED] flex items-center justify-center">
                <Droplets className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-[#111827]">Hydration</span>
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
      <div className="rounded-[14px] bg-[#EAF8EF] border border-[#C3EAD0] p-4 text-[#0F7A38]">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-[#16A34A]" />
          <span>Small steps, big results.</span>
        </div>
        <p className="text-xs text-[#344054] mt-1 leading-relaxed">
          Health + Wealth in one calm view. Track your meals, water, and money consistently.
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MealCategory } from '@/lib/types';
import { Plus, Coffee, Utensils, Moon, Apple } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { MealAnalysisTool } from './MealAnalysisTool';
import { MealNutritionalAnalysisOutput } from '@/ai/flows/meal-nutritional-analysis';

const CATEGORY_ICONS = {
  Breakfast: Coffee,
  Lunch: Utensils,
  Dinner: Moon,
  Snacks: Apple,
};

interface MealCategoryCardProps {
  category: MealCategory;
  onAnalysisComplete: (data: MealNutritionalAnalysisOutput, category: MealCategory, mealTime: string, imagePath?: string) => void;
  totalCalories: number;
}

export const MealCategoryCard = memo(function MealCategoryCard({ category, onAnalysisComplete, totalCalories }: MealCategoryCardProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const Icon = CATEGORY_ICONS[category];

  const handleComplete = (
    data: MealNutritionalAnalysisOutput,
    finalCategory: MealCategory,
    mealTime: string,
    imagePath?: string
  ) => {
    onAnalysisComplete(data, finalCategory, mealTime, imagePath);
    setOpen(false);
  };

  const FormContent = (
    <MealAnalysisTool
      initialCategory={category}
      onAnalysisComplete={handleComplete}
      onCancel={() => setOpen(false)}
    />
  );

  return (
    <Card className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs hover:border-[#6D28D9] transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#F5F3FF] text-[#6D28D9] transition-colors">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-[#1E293B]">{category}</CardTitle>
              <p className="text-[11px] font-semibold text-[#64748B]">Nutrition Slot</p>
            </div>
          </div>

          {isMobile ? (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  aria-label={`Log ${category}`}
                  className="rounded-xl bg-[#F5F3FF] text-[#6D28D9] hover:bg-[#EDE9FE] h-9 w-9 transition-colors"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[90svh] rounded-t-2xl border-t border-[#E2E8F0] bg-white p-6 flex flex-col">
                <div className="w-12 h-1.5 bg-[#E2E8F0] rounded-full mx-auto mb-4" />
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-2xl font-bold text-[#1E293B] text-left">
                    Log {category}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-hidden">
                  {FormContent}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  aria-label={`Log ${category}`}
                  className="rounded-xl bg-[#F5F3FF] text-[#6D28D9] hover:bg-[#EDE9FE] h-9 w-9 transition-colors"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xl">
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-2xl font-bold text-[#1E293B]">
                    Log {category}
                  </DialogTitle>
                </DialogHeader>
                {FormContent}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-[#1E293B]">{totalCalories}</span>
          <span className="text-xs text-[#64748B] font-semibold">kcal</span>
        </div>
        <div className="mt-4 w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
          <div 
            className="bg-[#6D28D9] h-full transition-all duration-500 ease-out" 
            style={{ width: `${Math.min((totalCalories / 600) * 100, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
});

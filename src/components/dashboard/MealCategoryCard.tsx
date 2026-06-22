'use client';

import { useState } from 'react';
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

export function MealCategoryCard({ category, onAnalysisComplete, totalCalories }: MealCategoryCardProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const Icon = CATEGORY_ICONS[category];

  const handleComplete = (data: MealNutritionalAnalysisOutput, mealTime: string, imagePath?: string) => {
    onAnalysisComplete(data, category, mealTime, imagePath);
    setOpen(false);
  };

  const FormContent = (
    <MealAnalysisTool 
      category={category} 
      onAnalysisComplete={handleComplete} 
      onCancel={() => setOpen(false)} 
    />
  );

  return (
    <Card className="glass-card border-white/60 rounded-3xl overflow-hidden group hover:scale-[1.02]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">{category}</CardTitle>
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Nutrition Slot</p>
            </div>
          </div>

          {isMobile ? (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  aria-label={`Log ${category}`}
                  className="rounded-full hover:bg-primary hover:text-primary-foreground h-10 w-10 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[90svh] rounded-t-[3rem] border-none glass-card p-8 flex flex-col">
                <div className="w-12 h-1.5 bg-foreground/10 rounded-full mx-auto mb-8" />
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-3xl font-bold text-primary text-left">
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
                  className="rounded-full hover:bg-primary hover:text-primary-foreground h-10 w-10 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] glass-card border-none rounded-[2.5rem] p-10">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-3xl font-bold text-primary">
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
          <span className="text-4xl font-bold text-primary">{totalCalories}</span>
          <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">kcal</span>
        </div>
        <div className="mt-5 w-full bg-black/5 dark:bg-white/5 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(var(--primary),0.3)]" 
            style={{ width: `${Math.min((totalCalories / 600) * 100, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

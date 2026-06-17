
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
    <Card className="overflow-hidden group hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-md bg-card border-primary/10 border-[0.5px]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-headline">{category}</CardTitle>
              <p className="text-xs text-muted-foreground font-body">Nutritional Slot</p>
            </div>
          </div>

          {isMobile ? (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-primary hover:text-primary-foreground h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[90svh] sm:h-auto rounded-t-[2.5rem] border-t-0 p-6 flex flex-col bg-background">
                <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
                <SheetHeader className="mb-2">
                  <SheetTitle className="text-2xl font-headline font-bold text-primary text-left">
                    Log your {category}
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
                  className="rounded-full hover:bg-primary hover:text-primary-foreground h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-3xl p-8">
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-2xl font-headline font-bold text-primary">
                    Log your {category}
                  </DialogTitle>
                </DialogHeader>
                {FormContent}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-primary">{totalCalories}</span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">kcal</span>
        </div>
        <div className="mt-4 w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-500 ease-out" 
            style={{ width: `${Math.min((totalCalories / 600) * 100, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

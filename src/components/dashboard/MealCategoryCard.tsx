'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MealCategory } from '@/lib/types';
import { Plus, Coffee, Utensils, Moon, Apple } from 'lucide-react';

const CATEGORY_ICONS = {
  Breakfast: Coffee,
  Lunch: Utensils,
  Dinner: Moon,
  Snacks: Apple,
};

interface MealCategoryCardProps {
  category: MealCategory;
  onAddClick: () => void;
  totalCalories: number;
}

export function MealCategoryCard({ category, onAddClick, totalCalories }: MealCategoryCardProps) {
  const Icon = CATEGORY_ICONS[category];

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
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onAddClick} 
            className="rounded-full hover:bg-primary hover:text-primary-foreground h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
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

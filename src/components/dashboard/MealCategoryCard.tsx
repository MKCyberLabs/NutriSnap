
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
    <Card className="overflow-hidden group hover:border-accent/40 transition-all duration-300 shadow-sm hover:shadow-md bg-white border-slate-100">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-50 text-accent group-hover:bg-accent group-hover:text-white transition-colors duration-300">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-headline">{category}</CardTitle>
              <p className="text-sm text-muted-foreground font-body">Recommended intake</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onAddClick} className="rounded-full hover:bg-accent hover:text-white">
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-primary">{totalCalories}</span>
          <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">kcal logged</span>
        </div>
        <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-accent h-full transition-all duration-500 ease-out" 
            style={{ width: `${Math.min((totalCalories / 600) * 100, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}


export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  onboarded: boolean;
  metrics?: UserMetrics;
}

export interface UserMetrics {
  height: number;
  weight: number;
  age: number;
}

export type MealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';

export interface FoodItem {
  id: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  saturatedFat: number;
  sugar: number;
}

export interface MealLog {
  id: string;
  category: MealCategory;
  timestamp: string;
  items: FoodItem[];
  totalNutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    saturatedFat: number;
    sugar: number;
  };
  healthInsight?: string;
  description?: string;
  photoUrl?: string;
}

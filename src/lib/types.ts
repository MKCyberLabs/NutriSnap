
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
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
}

export interface MealLog {
  id: string;
  category: MealCategory;
  timestamp: string;
  items: FoodItem[];
  totalNutrients: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
  healthInsight?: string;
  description?: string;
  photoUrl?: string;
}

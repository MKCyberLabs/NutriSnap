
export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  onboarded: boolean;
  metrics?: UserMetrics;
  telegramId?: string | null;
}

export interface UserMetrics {
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female';
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
  rating?: number;
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
  photoUrl?: string; // Legacy field
  imagePath?: string; // New field for local storage path
  isPending?: boolean; // True while waiting for DB save
}

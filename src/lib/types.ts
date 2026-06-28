
export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  onboarded: boolean;
  metrics?: UserMetrics;
  telegramId?: string | null;
  dailyWaterGoal?: number;
}

export interface UserMetrics {
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female';
}

export type MealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';

export type DrinkType = 'Water' | 'Coffee' | 'Soft Drink' | 'Milk' | 'Smoothie';

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

export interface HydrationEntry {
  id: string;
  amountMl: number;
  drinkType: DrinkType;
  createdAt: string;
}

export interface HydrationSettingData {
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  activeDays: string[];
  isActive: boolean;
}


'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { User, MealCategory, MealLog, FoodItem, UserMetrics } from '@/lib/types';
import { MealCategoryCard } from '@/components/dashboard/MealCategoryCard';
import { mealNutritionalAnalysis, MealNutritionalAnalysisOutput } from '@/ai/flows/meal-nutritional-analysis';
import { fetchUserLogs, saveMealLog, deleteMealLog, updateMealLogItems } from '@/ai/actions/db-logs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import { 
  Calendar as CalendarIcon, 
  History, 
  TrendingUp, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  BrainCircuit,
  BarChart3,
  Flame,
  Trash2,
  X,
  Plus,
  Loader2,
  Sparkles,
  Coffee,
  Utensils,
  Apple,
  Edit2,
  Check
} from 'lucide-react';
import { format, isSameDay, addDays, subDays, eachDayOfInterval, isValid, parseISO, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, Variants } from 'framer-motion';

// Animation variants for staggered cascade
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

// ⚡ Bolt Optimization: Localized state for "Edit Grams" to prevent the entire DashboardPage from re-rendering on every keystroke.
function EditGramsPopover({ item, logId, onUpdate }: { item: FoodItem, logId: string, onUpdate: (logId: string, itemId: string, newGramsStr: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(item.grams.toString());

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) setValue(item.grams.toString());
    }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold hover:text-primary transition-colors">
          {item.grams}g <Edit2 className="h-2.5 w-2.5 text-primary/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="glass-card w-40 p-3 rounded-xl border-none shadow-xl" align="start">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="h-8 text-xs rounded-lg"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg"
            onClick={() => {
              onUpdate(logId, item.id, value);
              setOpen(false);
            }}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ⚡ Bolt Optimization: Localized state for "Append Item" input to isolate keystroke re-renders from the massive parent page.
function AddItemPopover({ logId, onAdd, isAdding }: { logId: string, onAdd: (logId: string, text: string) => Promise<void>, isAdding: boolean }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={(isOpen) => { if (!isAdding) setOpen(isOpen); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-[10px] gap-2 font-bold uppercase tracking-wider text-primary hover:bg-primary/5 rounded-lg">
          <Plus className="h-3.5 w-3.5" /> Append Item
        </Button>
      </PopoverTrigger>
      <PopoverContent className="glass-card w-80 p-5 rounded-2xl border-none shadow-2xl" align="end">
        <div className="space-y-4">
          <h4 className="font-bold text-sm text-foreground">Add new item</h4>
          <div className="space-y-3">
            <Input
              placeholder="e.g., 2 Large Eggs"
              className="h-10 text-sm bg-white/20 border-white/40 rounded-xl"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isAdding}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && text.trim() && !isAdding) {
                  await onAdd(logId, text);
                  setText('');
                  setOpen(false);
                }
              }}
            />
            <Button
              className="w-full h-10 gap-2 font-bold rounded-xl"
              disabled={isAdding || !text.trim()}
              onClick={async () => {
                await onAdd(logId, text);
                setText('');
                setOpen(false);
              }}
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isAdding ? 'Analyzing...' : 'Add Item'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function calculateNutrientTargets(user?: any) {
  // Use default metrics if none are provided to skip mandatory onboarding
  const activeMetrics = user?.metrics || { height: 175, weight: 70, age: 30, gender: 'male' };
  
  const { weight, height, age, gender } = activeMetrics;
  
  const bmr = gender === 'male'
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;

  const tdee = bmr * 1.5; // Activity factor for demo

  return {
    calories: user?.dailyCaloriesGoal || Math.round(tdee),
    protein: user?.dailyProteinGoal || Math.round((tdee * 0.30) / 4),
    carbs: user?.dailyCarbsGoal || Math.round((tdee * 0.40) / 4),
    fat: user?.dailyFatGoal || Math.round((tdee * 0.30) / 9),
    sugar: 35
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('daily');
  const [isMounted, setIsMounted] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState<string | null>(null);

  const [weeklyPivotDate, setWeeklyPivotDate] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    setIsMounted(true);
    const session = getAuthSession();
    if (!session) {
      router.push('/');
      return;
    }
    if (session.role === 'ADMIN') {
      router.push('/admin');
      return;
    }
    if (!session.onboarded) {
      router.push('/onboarding');
      return;
    }
    setUser(session);
    
    // Fetch logs from the real database
    fetchUserLogs(session.id).then(dbLogs => {
      if (dbLogs && dbLogs.length > 0) {
        setLogs(dbLogs as MealLog[]);
      } else {
        // Fallback to localStorage for migration or backward compatibility
        const savedLogs = localStorage.getItem('nutrisnap_logs');
        if (savedLogs) {
          try {
            const parsedLogs = JSON.parse(savedLogs);
            const sanitizedLogs = (Array.isArray(parsedLogs) ? parsedLogs : [])
               .filter(log => log && typeof log === 'object' && log.id)
               .map(log => ({
                 ...log,
                 timestamp: typeof log.timestamp === 'string' ? log.timestamp : new Date().toISOString(),
                 imagePath: log.imagePath || log.photoUrl || undefined
               }));
            setLogs(sanitizedLogs);
          } catch (e) {
            setLogs([]);
          }
        }
      }
    });
  }, [router]);

  const saveLogsToStorage = (updatedLogs: MealLog[]) => {
    setLogs(updatedLogs);
    localStorage.setItem('nutrisnap_logs', JSON.stringify(updatedLogs));
  };

  const userTargets = useMemo(() => calculateNutrientTargets(user), [user]);

  const handleMealCardComplete = async (data: MealNutritionalAnalysisOutput, category: MealCategory, mealTime: string, imagePath?: string) => {
    const logTimestamp = new Date(selectedDate);
    if (mealTime && mealTime.includes(':')) {
      const [hours, minutes] = mealTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        logTimestamp.setHours(hours, minutes, 0, 0);
      }
    }

    const isoTimestamp = isValid(logTimestamp) ? logTimestamp.toISOString() : new Date().toISOString();

    const newLog: MealLog = {
      id: Math.random().toString(36).substr(2, 9),
      category: category,
      timestamp: isoTimestamp,
      items: (data.foodItems || []).map(item => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9),
      })),
      totalNutrients: {
        calories: Number(data.calories),
        protein: Number(data.protein),
        carbs: Number(data.carbs),
        fat: Number(data.fat),
        fiber: Number(data.fiber || 0),
        saturatedFat: Number(data.saturatedFat || 0),
        sugar: Number(data.sugar || 0),
      },
      healthInsight: data.healthInsight,
      imagePath: imagePath,
      isPending: true
    };

    saveLogsToStorage([newLog, ...logs]);
    
    // Save to Postgres and update local ID
    const res = await saveMealLog(user?.id || '', newLog, newLog.items);
    if (res && res.success && res.log) {
      setLogs(prev => {
        const updated = prev.map(l => l.id === newLog.id ? { ...l, id: res.log.id, isPending: false } : l);
        localStorage.setItem('nutrisnap_logs', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleUpdateItemGrams = (logId: string, itemId: string, newGramsStr: string) => {
    const newGrams = parseFloat(newGramsStr);
    if (isNaN(newGrams) || newGrams <= 0) {
      toast({ variant: "destructive", title: "Invalid weight", description: "Grams must be greater than zero." });
      return;
    }

    const updatedLogs = logs.map(log => {
      if (log.id !== logId) return log;
      
      const updatedItems = log.items.map(item => {
        if (item.id !== itemId) return item;
        
        const scale = newGrams / item.grams;
        return {
          ...item,
          grams: newGrams,
          calories: Math.round(item.calories * scale),
          protein: Number((item.protein * scale).toFixed(1)),
          carbs: Number((item.carbs * scale).toFixed(1)),
          fat: Number((item.fat * scale).toFixed(1)),
          fiber: Number((item.fiber * scale).toFixed(1)),
          saturatedFat: Number((item.saturatedFat * scale).toFixed(1)),
          sugar: Number((item.sugar * scale).toFixed(1)),
        };
      });

      const totalCalories = updatedItems.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
      const totalProtein = updatedItems.reduce((sum, i) => sum + (Number(i.protein) || 0), 0);
      const totalCarbs = updatedItems.reduce((sum, i) => sum + (Number(i.carbs) || 0), 0);
      const totalFat = updatedItems.reduce((sum, i) => sum + (Number(i.fat) || 0), 0);
      const totalFiber = updatedItems.reduce((sum, i) => sum + (Number(i.fiber) || 0), 0);
      const totalSatFat = updatedItems.reduce((sum, i) => sum + (Number(i.saturatedFat) || 0), 0);
      const totalSugar = updatedItems.reduce((sum, i) => sum + (Number(i.sugar) || 0), 0);

      return {
        ...log,
        items: updatedItems,
        totalNutrients: {
          ...log.totalNutrients,
          calories: totalCalories,
          protein: Number(totalProtein.toFixed(1)),
          carbs: Number(totalCarbs.toFixed(1)),
          fat: Number(totalFat.toFixed(1)),
          fiber: Number(totalFiber.toFixed(1)),
          saturatedFat: Number(totalSatFat.toFixed(1)),
          sugar: Number(totalSugar.toFixed(1)),
        }
      };
    });

    saveLogsToStorage(updatedLogs);
    
    const updatedLog = updatedLogs.find(l => l.id === logId);
    if (updatedLog) {
      updateMealLogItems(logId, updatedLog.items, updatedLog.totalNutrients);
    }

    toast({ title: "Weight Updated", description: "Nutritional values have been recalculated." });
  };

  const handleAddItemToLog = async (logId: string, text: string) => {
    if (!text.trim()) return;
    setIsAddingItem(logId);
    try {
      const result = await mealNutritionalAnalysis({ mealDescription: text });
      const updatedLogs = logs.map(log => {
        if (log.id !== logId) return log;
        const newItems: FoodItem[] = (result.foodItems || []).map(item => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
        }));
        const combinedItems = [...log.items, ...newItems];
        const totalCalories = combinedItems.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
        const totalProtein = combinedItems.reduce((sum, i) => sum + (Number(i.protein) || 0), 0);
        const totalCarbs = combinedItems.reduce((sum, i) => sum + (Number(i.carbs) || 0), 0);
        const totalFat = combinedItems.reduce((sum, i) => sum + (Number(i.fat) || 0), 0);
        const totalFiber = combinedItems.reduce((sum, i) => sum + (Number(i.fiber) || 0), 0);
        const totalSatFat = combinedItems.reduce((sum, i) => sum + (Number(i.saturatedFat) || 0), 0);
        const totalSugar = combinedItems.reduce((sum, i) => sum + (Number(i.sugar) || 0), 0);

        return {
          ...log,
          items: combinedItems,
          totalNutrients: {
            ...log.totalNutrients,
            calories: totalCalories,
            protein: Number(totalProtein.toFixed(1)),
            carbs: Number(totalCarbs.toFixed(1)),
            fat: Number(totalFat.toFixed(1)),
            fiber: Number(totalFiber.toFixed(1)),
            saturatedFat: Number(totalSatFat.toFixed(1)),
            sugar: Number(totalSugar.toFixed(1)),
          }
        };
      });
      saveLogsToStorage(updatedLogs);
      
      const updatedLog = updatedLogs.find(l => l.id === logId);
      if (updatedLog) {
        updateMealLogItems(logId, updatedLog.items, updatedLog.totalNutrients);
      }

      toast({ title: "Item Added", description: "Successfully updated your meal record." });
    } catch (error) {
      toast({ variant: "destructive", title: "Update failed", description: "Could not analyze item." });
    } finally {
      setIsAddingItem(null);
    }
  };

  const handleDeleteItem = (logId: string, itemId: string) => {
    const updatedLogs = logs.map(log => {
      if (log.id !== logId) return log;
      const updatedItems = log.items.filter(item => item.id !== itemId);
      const totalCalories = updatedItems.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
      const totalProtein = updatedItems.reduce((sum, i) => sum + (Number(i.protein) || 0), 0);
      const totalCarbs = updatedItems.reduce((sum, i) => sum + (Number(i.carbs) || 0), 0);
      const totalFat = updatedItems.reduce((sum, i) => sum + (Number(i.fat) || 0), 0);
      const totalFiber = updatedItems.reduce((sum, i) => sum + (Number(i.fiber) || 0), 0);
      const totalSatFat = updatedItems.reduce((sum, i) => sum + (Number(i.saturatedFat) || 0), 0);
      const totalSugar = updatedItems.reduce((sum, i) => sum + (Number(i.sugar) || 0), 0);

      return {
        ...log,
        items: updatedItems,
        totalNutrients: {
          ...log.totalNutrients,
          calories: totalCalories,
          protein: Number(totalProtein.toFixed(1)),
          carbs: Number(totalCarbs.toFixed(1)),
          fat: Number(totalFat.toFixed(1)),
          fiber: Number(totalFiber.toFixed(1)),
          saturatedFat: Number(totalSatFat.toFixed(1)),
          sugar: Number(totalSugar.toFixed(1)),
        }
      };
    });
    saveLogsToStorage(updatedLogs);
    
    const updatedLog = updatedLogs.find(l => l.id === logId);
    if (updatedLog) {
      updateMealLogItems(logId, updatedLog.items, updatedLog.totalNutrients);
    }
    
    toast({ title: "Item Deleted", description: "The food item has been removed." });
  };

  const handleDeleteLog = async (logId: string) => {
    saveLogsToStorage(logs.filter(l => l.id !== logId));
    try {
      const res = await deleteMealLog(logId);
      if (res.success) {
        toast({ title: "Log Removed", description: "The record has been deleted from the database." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete the record from the database." });
      }
    } catch (error) {
      console.error("Failed to delete log:", error);
    }
  };

  // ⚡ Bolt Optimization: Group logs by date string (yyyy-MM-dd) to change O(N*D) date parsing
  // during render into O(N) one-time parsing and O(1) lookups per day.
  const logsByDateStr = useMemo(() => {
    const map = new Map<string, MealLog[]>();
    logs.forEach(log => {
      if (!log || !log.timestamp) return;
      try {
        const logDate = typeof log.timestamp === 'string' ? parseISO(log.timestamp) : new Date(log.timestamp);
        if (isValid(logDate)) {
          const dateStr = format(logDate, 'yyyy-MM-dd');
          if (!map.has(dateStr)) {
            map.set(dateStr, []);
          }
          map.get(dateStr)!.push(log);
        }
      } catch (e) {
        // ignore invalid dates
      }
    });
    return map;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!isValid(selectedDate)) return [];
    return logsByDateStr.get(format(selectedDate, 'yyyy-MM-dd')) || [];
  }, [logsByDateStr, selectedDate]);

  const activeWeeklyRange = useMemo(() => {
    if (customRange?.from) {
      return { 
        from: startOfDay(customRange.from), 
        to: endOfDay(customRange.to || customRange.from) 
      };
    }
    return { from: startOfDay(subDays(weeklyPivotDate, 6)), to: endOfDay(weeklyPivotDate) };
  }, [weeklyPivotDate, customRange]);

  const dynamicWeeklyData = useMemo(() => {
    try {
      const days = eachDayOfInterval({ start: activeWeeklyRange.from, end: activeWeeklyRange.to });
      return days.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayLogs = logsByDateStr.get(dateStr) || [];

        // ⚡ Bolt Optimization: Consolidate 5 separate reductions into a single O(N) loop
        let calories = 0, protein = 0, carbs = 0, fat = 0, sugar = 0;
        for (const log of dayLogs) {
          calories += Number(log.totalNutrients.calories) || 0;
          protein += Number(log.totalNutrients.protein) || 0;
          carbs += Number(log.totalNutrients.carbs) || 0;
          fat += Number(log.totalNutrients.fat) || 0;
          sugar += Number(log.totalNutrients.sugar) || 0;
        }

        return {
          day: format(date, 'EEE'),
          fullDate: date,
          calories,
          protein,
          carbs,
          fat,
          sugar,
        };
      });
    } catch (e) {
      return [];
    }
  }, [logsByDateStr, activeWeeklyRange]);

  // ⚡ Bolt Optimization: Calculate daily totals and category calorie breakdowns in a single O(N) pass.
  // Replaces 4 inline .filter().reduce() loops on every render.
  const dailyTotals = useMemo(() => {
    let protein = 0, carbs = 0, fat = 0, sugar = 0, calories = 0;
    const byCategory: Record<MealCategory, number> = {
      Breakfast: 0,
      Lunch: 0,
      Dinner: 0,
      Snacks: 0,
    };

    filteredLogs.forEach(log => {
      protein += Number(log.totalNutrients.protein || 0);
      carbs += Number(log.totalNutrients.carbs || 0);
      fat += Number(log.totalNutrients.fat || 0);
      sugar += Number(log.totalNutrients.sugar || 0);

      const logCals = Number(log.totalNutrients.calories || 0);
      calories += logCals;
      if (log.category && byCategory[log.category] !== undefined) {
        byCategory[log.category] += logCals;
      }
    });
    return { protein, carbs, fat, sugar, calories, byCategory };
  }, [filteredLogs]);

  const { protein: totalP, carbs: totalC, fat: totalF, sugar: totalS, calories: totalCals, byCategory } = dailyTotals;

  // ⚡ Bolt Optimization: Memoize and consolidate weekly total aggregations
  // Replaces 4 separate O(N) array reductions (one in weeklyAvgCalories, three in render)
  // with a single O(N) pass to reduce redundant iteration over dynamicWeeklyData.
  const weeklyTotals = useMemo(() => {
    let protein = 0, carbs = 0, fat = 0, calories = 0;
    for (const day of dynamicWeeklyData) {
      protein += day.protein;
      carbs += day.carbs;
      fat += day.fat;
      calories += day.calories;
    }
    return { protein, carbs, fat, calories };
  }, [dynamicWeeklyData]);

  const weeklyAvgCalories = useMemo(() => {
    if (dynamicWeeklyData.length === 0) return 0;
    const totalDaysInRange = differenceInDays(activeWeeklyRange.to, activeWeeklyRange.from) + 1;
    return Math.round(weeklyTotals.calories / totalDaysInRange);
  }, [dynamicWeeklyData, activeWeeklyRange, weeklyTotals.calories]);

  if (!isMounted) return null;

  return (
    <div className="min-h-svh bg-gradient-to-br from-rose-50 via-slate-100 to-emerald-50 dark:from-slate-950 dark:via-rose-950/20 dark:to-emerald-950/20 font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Wellness Hub</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                  <TabsList className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/10 p-1 rounded-xl">
                    <TabsTrigger value="daily" className="data-[state=active]:bg-white/80 dark:data-[state=active]:bg-white/20 rounded-lg">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="data-[state=active]:bg-white/80 dark:data-[state=active]:bg-white/20 rounded-lg">Weekly</TabsTrigger>
                  </TabsList>
                </Tabs>
                {activeTab === 'daily' ? (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="glass-card justify-start text-left font-normal min-w-[200px] rounded-xl border-white/60">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {format(selectedDate, 'EEEE, MMM do')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                        <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" aria-label="Previous day" className="glass-card h-10 w-10 rounded-xl border-white/60" onClick={() => setSelectedDate(subDays(selectedDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" aria-label="Next day" className="glass-card h-10 w-10 rounded-xl border-white/60" onClick={() => setSelectedDate(addDays(selectedDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="glass-card flex items-center gap-2 p-1 rounded-xl border-white/60">
                      <Button variant="ghost" size="icon" aria-label="Previous week" className="h-8 w-8" onClick={() => {
                        setCustomRange(undefined);
                        setWeeklyPivotDate(subDays(weeklyPivotDate, 7));
                      }}><ChevronLeft className="h-4 w-4" /></Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="text-xs font-bold px-4 h-8 rounded-lg hover:text-primary transition-colors">
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {format(activeWeeklyRange.from, 'MMM d')} - {format(activeWeeklyRange.to, 'MMM d')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="center">
                          <Calendar 
                            mode="range" 
                            selected={customRange} 
                            onSelect={setCustomRange} 
                            initialFocus 
                            numberOfMonths={isMobile ? 1 : 2}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button variant="ghost" size="icon" aria-label="Next week" className="h-8 w-8" onClick={() => {
                        setCustomRange(undefined);
                        setWeeklyPivotDate(addDays(weeklyPivotDate, 7));
                      }}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    {customRange && (
                      <Button variant="ghost" size="sm" onClick={() => setCustomRange(undefined)} className="text-[10px] font-bold uppercase tracking-widest h-8 px-3 rounded-lg bg-white/40 dark:bg-black/40 border border-white/60">Reset Range</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <Card className="glass-card bg-primary text-primary-foreground border-none px-6 py-4 flex items-center gap-4 rounded-2xl">
            <div className="p-2 bg-white/20 rounded-xl"><TrendingUp className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">{activeTab === 'daily' ? 'Intake' : 'Range Avg'}</p>
              <p className="text-2xl font-bold">{activeTab === 'daily' ? totalCals : weeklyAvgCalories} <span className="text-sm font-normal opacity-70"> kcal</span></p>
            </div>
          </Card>
        </header>

        {activeTab === 'daily' ? (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as MealCategory[]).map((cat) => (
                  <motion.div key={cat} variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring' as const, stiffness: 400, damping: 17 }}>
                    <MealCategoryCard 
                      category={cat} 
                      totalCalories={byCategory[cat]}
                      onAnalysisComplete={(data, category, mealTime, imagePath) => handleMealCardComplete(data, category, mealTime, imagePath)} 
                    />
                  </motion.div>
                ))}
              </section>

              <motion.div variants={itemVariants}>
                <Card className="glass-card border-white/60 rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground"><History className="h-5 w-5 text-primary" /> Daily Activity</CardTitle>
                    <CardDescription>Visual timeline of your metabolic intake.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[650px] pr-4">
                    {filteredLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed border-white/40 rounded-3xl bg-white/20">
                        <p className="font-medium">No activity recorded for this day.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {filteredLogs.map((log) => (
                          <motion.div key={log.id} variants={itemVariants} className="relative pl-6 border-l-2 border-primary/20 pb-4 last:pb-0">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-background" />
                            <div className="glass-card rounded-2xl p-5 border-white/60">
                              <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-primary/10 text-primary h-6 px-3 rounded-lg text-xs font-bold">{log.category}</Badge>
                                    <span className="text-xs">
                                      {'⭐'.repeat(log.items.length > 0 ? Math.round(log.items.reduce((s, i) => s + (i.rating || 3), 0) / log.items.length) : 3)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground font-medium">{format(parseISO(log.timestamp), 'h:mm a')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-3 bg-white/30 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-white/40">
                                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/40 bg-white/40 shadow-sm flex items-center justify-center group shrink-0">
                                      <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                        {log.category === 'Breakfast' && <Coffee className="w-5 h-5 text-muted-foreground" />}
                                        {(log.category === 'Lunch' || log.category === 'Dinner') && <Utensils className="w-5 h-5 text-muted-foreground" />}
                                        {log.category === 'Snacks' && <Apple className="w-5 h-5 text-muted-foreground" />}
                                      </div>
                                      {log.imagePath && (
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <div className="absolute inset-0 z-10 cursor-pointer hover:scale-105 transition-transform bg-white/10 backdrop-blur-[1px]">
                                              <img 
                                                src={log.imagePath} 
                                                alt={log.category} 
                                                className="w-full h-full object-cover" 
                                              />
                                            </div>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[600px] glass-card border-none rounded-3xl overflow-hidden">
                                            <DialogHeader><DialogTitle className="text-2xl font-bold">{log.category} Details</DialogTitle></DialogHeader>
                                            <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-2xl bg-black/5 flex items-center justify-center">
                                              <img src={log.imagePath} alt={log.category} className="max-w-full max-h-full object-contain" />
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-lg text-primary">{log.totalNutrients.calories}</span>
                                      <span className="text-[10px] ml-1 text-muted-foreground font-bold uppercase">kcal</span>
                                    </div>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" aria-label="Delete log" disabled={log.isPending} className="h-8 w-8 p-0 bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive border-none shadow-none rounded-full disabled:opacity-50">
                                          {log.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="glass-card border-none rounded-3xl">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Log?</AlertDialogTitle>
                                          <AlertDialogDescription>This will permanently remove this meal entry from your database.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteLog(log.id)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                {log.items.map((item) => (
                                  <div key={item.id} className="p-3 rounded-xl bg-white/30 dark:bg-black/20 border border-white/40 flex items-center justify-between group">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-foreground">
                                        {item.name} <span className="text-xs font-normal">{'⭐'.repeat(item.rating || 3)}</span>
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <EditGramsPopover item={item} logId={log.id} onUpdate={handleUpdateItemGrams} />
                                        <span className="text-[10px] text-muted-foreground opacity-60">•</span>
                                        <span className="text-[10px] text-muted-foreground font-medium">{item.calories} kcal</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="flex gap-1.5 overflow-x-auto">
                                        <Badge variant="outline" className="text-[9px] h-5 border-white/40 font-bold px-2 rounded-md whitespace-nowrap">P: {item.protein}g</Badge>
                                        <Badge variant="outline" className="text-[9px] h-5 border-white/40 font-bold px-2 rounded-md whitespace-nowrap">C: {item.carbs}g</Badge>
                                        <Badge variant="outline" className="text-[9px] h-5 border-white/40 font-bold px-2 rounded-md whitespace-nowrap">F: {item.fat}g</Badge>
                                        <Badge variant="outline" className="text-[9px] h-5 border-white/40 font-bold px-2 rounded-md whitespace-nowrap">S: {item.sugar}g</Badge>
                                      </div>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" aria-label="Remove item" className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="glass-card border-none rounded-3xl">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to remove "{item.name}" from this meal? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                              onClick={() => handleDeleteItem(log.id, item.id)} 
                                              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </div>
                                ))}

                                <div className="pt-2 flex justify-end">
                                  <AddItemPopover logId={log.id} onAdd={handleAddItemToLog} isAdding={isAddingItem === log.id} />
                                </div>
                              </div>
                              
                              <div className="mt-4 pt-4 border-t border-primary/5 grid grid-cols-3 gap-y-3">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase text-primary/60">Total P</span>
                                  <span className="text-sm font-bold text-primary">{log.totalNutrients.protein}g</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase text-primary/60">Total C</span>
                                  <span className="text-sm font-bold text-primary">{log.totalNutrients.carbs}g</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase text-primary/60">Total F</span>
                                  <span className="text-sm font-bold text-primary">{log.totalNutrients.fat}g</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase text-primary/60">Total Fiber</span>
                                  <span className="text-sm font-bold text-primary">{log.totalNutrients.fiber}g</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase text-primary/60">Total Sat. Fat</span>
                                  <span className="text-sm font-bold text-primary">{log.totalNutrients.saturatedFat}g</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase text-primary/60">Total Sugar</span>
                                  <span className="text-sm font-bold text-primary">{log.totalNutrients.sugar}g</span>
                                </div>
                              </div>

                              {log.healthInsight && (
                                <div className="mt-4 p-4 bg-white/30 dark:bg-black/10 border border-white/40 rounded-2xl flex items-start gap-3">
                                  <BrainCircuit className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                  <p className="text-xs italic leading-relaxed text-foreground/80">{log.healthInsight}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
              </motion.div>
            </div>

            <aside className="space-y-6">
              <motion.div variants={itemVariants}>
              <Card className="glass-card border-white/60 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-foreground">Biometric Targets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[ 
                    { label: 'Protein', val: totalP, max: userTargets.protein }, 
                    { label: 'Carbs', val: totalC, max: userTargets.carbs }, 
                    { label: 'Fats', val: totalF, max: userTargets.fat },
                    { label: 'Sugar', val: totalS, max: userTargets.sugar, isLimit: true }
                  ].map(m => {
                    const isOver = m.val > m.max;
                    const percentage = Math.min((m.val / m.max) * 100, 100);
                    return (
                      <div key={m.label} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{m.label}</span>
                            {m.isLimit && isOver && <Badge variant="destructive" className="h-4 text-[8px] px-1 animate-pulse">Limit Reached</Badge>}
                          </div>
                          <span className={cn("text-foreground", isOver && !m.isLimit && "text-emerald-500 font-bold")}>
                            {m.val.toFixed(0)}g / {m.max}g
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                          <div className={cn("h-full transition-all duration-700 ease-out", m.isLimit && isOver ? "bg-primary" : "bg-primary/80")} style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
              <Card className="glass-card border-white/60 rounded-3xl bg-secondary/30">
                <CardHeader className="pb-2"><CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground"><Info className="h-4 w-4 text-primary" /> Daily Insight</CardTitle></CardHeader>
                <CardContent className="text-sm leading-relaxed text-foreground/80">
                  {filteredLogs.length === 0 ? "Log your first meal to generate metabolic insights." : 
                    `Precision tracking active. You have achieved ${Math.round((totalP / userTargets.protein) * 100)}% of your daily protein target.`}
                </CardContent>
              </Card>
              </motion.div>
            </aside>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <motion.div variants={itemVariants}>
              <Card className="glass-card border-white/60 rounded-3xl">
                <CardHeader><CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground"><BarChart3 className="h-5 w-5 text-primary" /> Calorie Trends</CardTitle></CardHeader>
                <CardContent className="pt-6">
                  {dynamicWeeklyData.length > 0 ? (
                    <ChartContainer config={{ calories: { label: "Calories", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dynamicWeeklyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.1)" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                          <Bar dataKey="calories" radius={[8, 8, 8, 8]} maxBarSize={32}>
                            {dynamicWeeklyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.calories > userTargets.calories ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.6)'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-white/5 rounded-2xl border border-dashed">
                      Select a valid range to view trends
                    </div>
                  )}
                </CardContent>
              </Card>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[ 
                  { icon: Flame, val: weeklyAvgCalories, label: 'Avg Kcal' }, 
                  { icon: BarChart3, val: dynamicWeeklyData.length > 0 ? Math.max(...dynamicWeeklyData.map(d => d.calories)) : 0, label: 'Peak Day' }, 
                  { icon: History, val: dynamicWeeklyData.filter(d => d.calories > 0).length, label: 'Tracked Days' } 
                ].map((s, i) => (
                  <motion.div key={i} variants={itemVariants} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring' as const, stiffness: 400, damping: 17 }}>
                    <Card className="glass-card border-white/60 rounded-2xl"><CardContent className="pt-6 text-center"><div className="flex justify-center mb-2"><s.icon className="h-6 w-6 text-primary" /></div><p className="text-2xl font-bold text-foreground">{s.val}</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{s.label}</p></CardContent></Card>
                  </motion.div>
                ))}
              </div>
            </div>
            <aside className="space-y-6">
              <motion.div variants={itemVariants}>
              <Card className="glass-card border-white/60 rounded-3xl">
                <CardHeader><CardTitle className="text-xl font-bold text-foreground">Range Progress</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {[ 
                    { label: 'Protein', val: weeklyTotals.protein, max: userTargets.protein * (differenceInDays(activeWeeklyRange.to, activeWeeklyRange.from) + 1) },
                    { label: 'Carbs', val: weeklyTotals.carbs, max: userTargets.carbs * (differenceInDays(activeWeeklyRange.to, activeWeeklyRange.from) + 1) },
                    { label: 'Fats', val: weeklyTotals.fat, max: userTargets.fat * (differenceInDays(activeWeeklyRange.to, activeWeeklyRange.from) + 1) }
                  ].map(m => {
                    const percentage = Math.min((m.val / (m.max || 1)) * 100, 100);
                    return (
                      <div key={m.label} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                          <span>{m.label}</span>
                          <span className="text-foreground">{m.val.toFixed(0)}g / {m.max.toFixed(0)}g</span>
                        </div>
                        <div className="h-2.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/80 transition-all duration-700 ease-out" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
              <Card className="glass-card border-white/60 rounded-3xl bg-secondary/30"><CardHeader className="pb-2"><CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground"><BrainCircuit className="h-4 w-4 text-primary" /> Period Insight</CardTitle></CardHeader>
                <CardContent className="text-sm leading-relaxed text-foreground/80">Historical tracking analysis complete. The weekly averages are derived from your actual logged entries for this period.</CardContent>
              </Card>
              </motion.div>
            </aside>
          </motion.div>
        )}
      </main>
    </div>
  );
}

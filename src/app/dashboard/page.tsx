
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { User, MealCategory, MealLog } from '@/lib/types';
import { MealCategoryCard } from '@/components/dashboard/MealCategoryCard';
import { MealNutritionalAnalysisOutput } from '@/ai/flows/meal-nutritional-analysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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
  Filter
} from 'lucide-react';
import { format, isSameDay, addDays, subDays, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

/**
 * Generates dynamic mock data based on a date range to simulate historical logs.
 */
function generateMockDataForRange(from: Date, to: Date) {
  const days = eachDayOfInterval({ start: from, end: to });
  return days.map(date => {
    const seed = date.getTime() % 1000;
    const baseCals = 1600 + (seed % 600);
    return {
      day: format(date, 'EEE'),
      fullDate: date,
      calories: baseCals,
      protein: Math.round(baseCals * 0.08),
      carbs: Math.round(baseCals * 0.12),
      fat: Math.round(baseCals * 0.03),
    };
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('daily');
  const [isMounted, setIsMounted] = useState(false);

  const [weeklyPivotDate, setWeeklyPivotDate] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });

  useEffect(() => {
    setIsMounted(true);
    const session = getAuthSession();
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session);
    
    const savedLogs = localStorage.getItem('nutrisnap_logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
  }, [router]);

  const handleAnalysisComplete = (data: MealNutritionalAnalysisOutput, category: MealCategory) => {
    const now = new Date();
    const logTimestamp = new Date(selectedDate);
    logTimestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    const newLog: MealLog = {
      id: Math.random().toString(36).substr(2, 9),
      category: category,
      timestamp: logTimestamp.toISOString(),
      items: (data.foodItems || []).map(item => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9),
      })),
      totalNutrients: {
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
      },
      healthInsight: data.healthInsight
    };

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    localStorage.setItem('nutrisnap_logs', JSON.stringify(updatedLogs));
  };

  const filteredLogs = logs.filter(log => isSameDay(new Date(log.timestamp), selectedDate));

  const activeWeeklyRange = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      return { from: customRange.from, to: customRange.to };
    }
    return {
      from: subDays(weeklyPivotDate, 6),
      to: weeklyPivotDate
    };
  }, [weeklyPivotDate, customRange]);

  const dynamicWeeklyData = useMemo(() => {
    return generateMockDataForRange(activeWeeklyRange.from, activeWeeklyRange.to);
  }, [activeWeeklyRange]);

  const totalCaloriesForDay = filteredLogs.reduce((sum, l) => sum + l.totalNutrients.calories, 0);
  const parseAmount = (str: string) => parseInt(str.replace(/[^0-9]/g, '')) || 0;
  
  const totalProtein = filteredLogs.reduce((acc, log) => acc + parseAmount(log.totalNutrients.protein), 0);
  const totalCarbs = filteredLogs.reduce((acc, log) => acc + parseAmount(log.totalNutrients.carbs), 0);
  const totalFats = filteredLogs.reduce((acc, log) => acc + parseAmount(log.totalNutrients.fat), 0);

  const weeklyAvgCalories = Math.round(dynamicWeeklyData.reduce((acc, d) => acc + d.calories, 0) / dynamicWeeklyData.length);
  const weeklyTotalProtein = dynamicWeeklyData.reduce((acc, d) => acc + d.protein, 0);
  const weeklyTotalCarbs = dynamicWeeklyData.reduce((acc, d) => acc + d.carbs, 0);
  const weeklyTotalFats = dynamicWeeklyData.reduce((acc, d) => acc + d.fat, 0);

  const chartConfig = {
    calories: {
      label: "Calories",
      color: "hsl(var(--primary))",
    },
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-svh bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary">Wellness Hub</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                  <TabsList className="bg-secondary/50 p-1">
                    <TabsTrigger value="daily" className="data-[state=active]:bg-background data-[state=active]:text-primary">Daily Tracker</TabsTrigger>
                    <TabsTrigger value="weekly" className="data-[state=active]:bg-background data-[state=active]:text-primary">Weekly Summary</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                {activeTab === 'daily' ? (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className={cn(
                            "justify-start text-left font-normal border-primary/20 hover:bg-secondary min-w-[200px]",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {format(selectedDate, 'EEEE, MMMM do')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-primary hover:bg-secondary" 
                        onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-primary hover:bg-secondary" 
                        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary" 
                          onClick={() => {
                            setWeeklyPivotDate(subDays(weeklyPivotDate, 7));
                            setCustomRange(undefined);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-bold text-primary/80 px-2 min-w-[160px] text-center">
                          {format(activeWeeklyRange.from, 'MMM d')} - {format(activeWeeklyRange.to, 'MMM d, yyyy')}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary" 
                          onClick={() => {
                            setWeeklyPivotDate(addDays(weeklyPivotDate, 7));
                            setCustomRange(undefined);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="border-primary/20 hover:bg-secondary gap-2">
                          <Filter className="h-3.5 w-3.5" />
                          Custom Range
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={activeWeeklyRange.from}
                          selected={customRange}
                          onSelect={setCustomRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Card className="bg-primary text-primary-foreground border-none shadow-lg px-6 py-4 flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">
                  {activeTab === 'daily' ? 'Intake' : 'Range Avg'}
                </p>
                <p className="text-2xl font-bold">
                  {activeTab === 'daily' ? totalCaloriesForDay : weeklyAvgCalories} 
                  <span className="text-sm font-normal opacity-70"> kcal</span>
                </p>
              </div>
            </Card>
          </div>
        </header>

        {activeTab === 'daily' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as MealCategory[]).map((cat) => (
                  <MealCategoryCard 
                    key={cat} 
                    category={cat} 
                    totalCalories={filteredLogs.filter(l => l.category === cat).reduce((sum, log) => sum + log.totalNutrients.calories, 0)}
                    onAnalysisComplete={handleAnalysisComplete} 
                  />
                ))}
              </section>

              <Card className="border-primary/10 shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2 text-primary">
                      <History className="h-5 w-5 text-primary" /> Daily Activity
                    </CardTitle>
                    <CardDescription>
                      {isSameDay(selectedDate, new Date()) ? 'Real-time metabolic intake' : `Nutritional history for ${format(selectedDate, 'MMM do')}`}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    {filteredLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed border-primary/20 rounded-xl bg-muted/30">
                        <p className="font-medium">No activity recorded yet.</p>
                        <p className="text-xs opacity-60">Log a meal to see biological insights.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredLogs.map((log) => (
                          <div key={log.id} className="relative pl-6 border-l-2 border-secondary pb-4 last:pb-0">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-background shadow-sm" />
                            <div className="bg-secondary/30 rounded-xl p-4 hover:bg-secondary/50 transition-colors border border-primary/5">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{log.category}</Badge>
                                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                    {format(new Date(log.timestamp), 'h:mm a')}
                                  </span>
                                </div>
                                <span className="font-bold text-primary">{log.totalNutrients.calories} kcal</span>
                              </div>
                              
                              {log.healthInsight && (
                                <div className="mb-3 p-3 bg-white/40 border border-primary/5 rounded-lg flex items-start gap-2">
                                  <BrainCircuit className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  <p className="text-xs italic text-foreground/80 leading-relaxed">{log.healthInsight}</p>
                                </div>
                              )}

                              <div className="mt-3 flex gap-4 text-[10px] uppercase font-bold tracking-widest text-primary/70">
                                <span>P: {log.totalNutrients.protein}</span>
                                <span>C: {log.totalNutrients.carbs}</span>
                                <span>F: {log.totalNutrients.fat}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-6">
              <Card className="border-primary/10 shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="font-headline text-xl text-primary">Biometric Targets</CardTitle>
                  <CardDescription>Target vs Actual intake</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Protein</span>
                      <span className="text-primary">{totalProtein}g / 150g</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${Math.min((totalProtein / 150) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Carbs</span>
                      <span className="text-primary">{totalCarbs}g / 220g</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${Math.min((totalCarbs / 220) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Fats</span>
                      <span className="text-primary">{totalFats}g / 65g</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${Math.min((totalFats / 65) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary/20 border-secondary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="font-headline text-lg flex items-center gap-2 text-secondary-foreground">
                    <Info className="h-4 w-4" /> Insight
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-secondary-foreground/90 font-body leading-relaxed">
                  {filteredLogs.length === 0 
                    ? "Initialize your daily log to unlock personalized wellness analytics."
                    : "Metabolic tracking active. You have achieved " + Math.round((totalProtein / 150) * 100) + "% of your daily protein target."
                  }
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-primary/10 shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="font-headline text-2xl flex items-center gap-2 text-primary">
                    <BarChart3 className="h-5 w-5" /> Calorie Trends
                  </CardTitle>
                  <CardDescription>Daily intake for the selected window</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dynamicWeeklyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                        <XAxis 
                          dataKey="day" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                        />
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Bar 
                          dataKey="calories" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={40}
                        >
                          {dynamicWeeklyData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.calories > 2000 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.7)'} 
                              className="hover:opacity-80 transition-opacity"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-secondary/30 border-primary/5">
                  <CardContent className="pt-6 text-center">
                    <div className="flex justify-center mb-2">
                      <Flame className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-primary">{weeklyAvgCalories}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Avg Daily Kcal</p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30 border-primary/5">
                  <CardContent className="pt-6 text-center">
                    <div className="flex justify-center mb-2">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-primary">{Math.max(...dynamicWeeklyData.map(d => d.calories))}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Peak Day Kcal</p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30 border-primary/5">
                  <CardContent className="pt-6 text-center">
                    <div className="flex justify-center mb-2">
                      <History className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-primary">{dynamicWeeklyData.length} / {dynamicWeeklyData.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Days Tracked</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <aside className="space-y-6">
              <Card className="border-primary/10 shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="font-headline text-xl text-primary">Biometric Progress</CardTitle>
                  <CardDescription>Accumulated macros for this period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Protein</span>
                      <span className="text-secondary-foreground">{weeklyTotalProtein}g / {150 * dynamicWeeklyData.length}g</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary-foreground transition-all duration-500" 
                        style={{ width: `${Math.min((weeklyTotalProtein / (150 * dynamicWeeklyData.length)) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Carbs</span>
                      <span className="text-secondary-foreground">{weeklyTotalCarbs}g / {220 * dynamicWeeklyData.length}g</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary-foreground transition-all duration-500" 
                        style={{ width: `${Math.min((weeklyTotalCarbs / (220 * dynamicWeeklyData.length)) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Fats</span>
                      <span className="text-secondary-foreground">{weeklyTotalFats}g / {65 * dynamicWeeklyData.length}g</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary-foreground transition-all duration-500" 
                        style={{ width: `${Math.min((weeklyTotalFats / (65 * dynamicWeeklyData.length)) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary/20 border-secondary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="font-headline text-lg flex items-center gap-2 text-secondary-foreground">
                    <BrainCircuit className="h-4 w-4" /> Period Insight
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-secondary-foreground/90 font-body leading-relaxed">
                  Historical tracking active! Based on the selected range from {format(activeWeeklyRange.from, 'MMM d')} to {format(activeWeeklyRange.to, 'MMM d')}, you are maintaining a consistent metabolic rate. Your average caloric intake is {weeklyAvgCalories} kcal/day.
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}


'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { User, MealCategory, MealLog, FoodItem } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
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
  Filter,
  Trash2
} from 'lucide-react';
import { format, isSameDay, addDays, subDays, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
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

  const saveLogsToStorage = (updatedLogs: MealLog[]) => {
    setLogs(updatedLogs);
    localStorage.setItem('nutrisnap_logs', JSON.stringify(updatedLogs));
  };

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
        calories: Number(data.calories),
        protein: Number(data.protein),
        carbs: Number(data.carbs),
        fat: Number(data.fat),
        fiber: Number(data.fiber),
        saturatedFat: Number(data.saturatedFat),
        sugar: Number(data.sugar),
      },
      healthInsight: data.healthInsight
    };

    saveLogsToStorage([newLog, ...logs]);
  };

  const handleUpdateGrams = (logId: string, itemId: string, newGrams: number) => {
    if (isNaN(newGrams) || newGrams < 0) return;

    const updatedLogs = logs.map(log => {
      if (log.id !== logId) return log;

      const updatedItems = log.items.map(item => {
        if (item.id !== itemId) return item;

        const ratio = newGrams / item.grams;
        return {
          ...item,
          grams: newGrams,
          calories: Math.round(item.calories * ratio),
          protein: Number((item.protein * ratio).toFixed(1)),
          carbs: Number((item.carbs * ratio).toFixed(1)),
          fat: Number((item.fat * ratio).toFixed(1)),
          fiber: Number((item.fiber * ratio).toFixed(1)),
          saturatedFat: Number((item.saturatedFat * ratio).toFixed(1)),
          sugar: Number((item.sugar * ratio).toFixed(1)),
        };
      });

      const totalCalories = updatedItems.reduce((sum, i) => sum + i.calories, 0);
      const totalProtein = updatedItems.reduce((sum, i) => sum + i.protein, 0);
      const totalCarbs = updatedItems.reduce((sum, i) => sum + i.carbs, 0);
      const totalFat = updatedItems.reduce((sum, i) => sum + i.fat, 0);
      const totalFiber = updatedItems.reduce((sum, i) => sum + (i.fiber || 0), 0);
      const totalSaturatedFat = updatedItems.reduce((sum, i) => sum + (i.saturatedFat || 0), 0);
      const totalSugar = updatedItems.reduce((sum, i) => sum + (i.sugar || 0), 0);

      return {
        ...log,
        items: updatedItems,
        totalNutrients: {
          calories: totalCalories,
          protein: Number(totalProtein.toFixed(1)),
          carbs: Number(totalCarbs.toFixed(1)),
          fat: Number(totalFat.toFixed(1)),
          fiber: Number(totalFiber.toFixed(1)),
          saturatedFat: Number(totalSaturatedFat.toFixed(1)),
          sugar: Number(totalSugar.toFixed(1)),
        }
      };
    });

    saveLogsToStorage(updatedLogs);
  };

  const handleDeleteLog = (logId: string) => {
    const updatedLogs = logs.filter(l => l.id !== logId);
    saveLogsToStorage(updatedLogs);
    toast({ title: "Log Removed", description: "The meal record has been deleted." });
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

  const totalCaloriesForDay = filteredLogs.reduce((sum, l) => sum + Number(l.totalNutrients.calories || 0), 0);
  const totalProtein = filteredLogs.reduce((acc, log) => acc + Number(log.totalNutrients.protein || 0), 0);
  const totalCarbs = filteredLogs.reduce((acc, log) => acc + Number(log.totalNutrients.carbs || 0), 0);
  const totalFats = filteredLogs.reduce((acc, log) => acc + Number(log.totalNutrients.fat || 0), 0);

  const weeklyAvgCalories = Math.round(dynamicWeeklyData.reduce((acc, d) => acc + d.calories, 0) / dynamicWeeklyData.length);
  const weeklyTotalProtein = dynamicWeeklyData.reduce((acc, d) => acc + d.protein, 0);
  const weeklyTotalCarbs = dynamicWeeklyData.reduce((acc, d) => acc + d.carbs, 0);
  const weeklyTotalFats = dynamicWeeklyData.reduce((acc, d) => acc + d.fat, 0);

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
                        <Button variant="outline" className="justify-start text-left font-normal border-primary/20 hover:bg-secondary min-w-[200px]">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {format(selectedDate, 'EEEE, MMMM do')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => setSelectedDate(subDays(selectedDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => setSelectedDate(addDays(selectedDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-lg border border-primary/10">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setWeeklyPivotDate(subDays(weeklyPivotDate, 7))}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-xs font-bold text-primary/80 px-2 min-w-[160px] text-center">{format(activeWeeklyRange.from, 'MMM d')} - {format(activeWeeklyRange.to, 'MMM d, yyyy')}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setWeeklyPivotDate(addDays(weeklyPivotDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="border-primary/20 hover:bg-secondary gap-2"><Filter className="h-3.5 w-3.5" />Custom Range</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="range" selected={customRange} onSelect={setCustomRange} numberOfMonths={2} />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Card className="bg-primary text-primary-foreground border-none shadow-lg px-6 py-4 flex items-center gap-4">
            <div className="p-2 bg-white/10 rounded-lg"><TrendingUp className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">{activeTab === 'daily' ? 'Intake' : 'Range Avg'}</p>
              <p className="text-2xl font-bold">{activeTab === 'daily' ? totalCaloriesForDay : weeklyAvgCalories} <span className="text-sm font-normal opacity-70"> kcal</span></p>
            </div>
          </Card>
        </header>

        {activeTab === 'daily' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as MealCategory[]).map((cat) => (
                  <MealCategoryCard key={cat} category={cat} totalCalories={filteredLogs.filter(l => l.category === cat).reduce((sum, log) => sum + log.totalNutrients.calories, 0)} onAnalysisComplete={handleAnalysisComplete} />
                ))}
              </section>

              <Card className="border-primary/10 shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2 text-primary"><History className="h-5 w-5" /> Daily Activity</CardTitle>
                    <CardDescription>{isSameDay(selectedDate, new Date()) ? 'Real-time intake' : `Nutritional history for ${format(selectedDate, 'MMM do')}`}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    {filteredLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed border-primary/20 rounded-xl bg-muted/30">
                        <p className="font-medium">No activity recorded yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredLogs.map((log) => (
                          <div key={log.id} className="relative pl-6 border-l-2 border-secondary pb-4 last:pb-0">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-background" />
                            <div className="bg-secondary/30 rounded-xl p-4 border border-primary/5">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="bg-primary/10 text-primary">{log.category}</Badge>
                                  <span className="text-[10px] text-muted-foreground font-medium">{format(new Date(log.timestamp), 'h:mm a')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-primary">{log.totalNutrients.calories} kcal</span>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/60 hover:text-primary"><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>Delete entry?</AlertDialogTitle><AlertDialogDescription>Permanently remove this {log.category.toLowerCase()} log.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteLog(log.id)} className="bg-primary text-primary-foreground">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                              
                              <div className="mt-4 mb-4 space-y-4">
                                {log.items.map((item) => (
                                  <div key={item.id} className="p-3 rounded-lg bg-white/50 border border-primary/5 space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-foreground/90">{item.name}</span>
                                        <div className="flex items-center gap-1 ml-2">
                                          <Input 
                                            type="number" 
                                            className="w-16 h-7 text-[10px] text-center p-0 border-primary/10 focus:ring-primary/20 bg-background"
                                            defaultValue={item.grams}
                                            onBlur={(e) => handleUpdateGrams(log.id, item.id, parseInt(e.target.value))}
                                            onKeyDown={(e) => { if(e.key === 'Enter') handleUpdateGrams(log.id, item.id, parseInt((e.target as HTMLInputElement).value)) }}
                                          />
                                          <span className="text-[10px] font-bold text-muted-foreground">g</span>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-none bg-secondary/60 text-secondary-foreground font-bold">{item.calories} kcal</Badge>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-none bg-secondary/60 text-secondary-foreground font-bold">P: {item.protein}g</Badge>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-none bg-secondary/60 text-secondary-foreground font-bold">C: {item.carbs}g</Badge>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-none bg-secondary/60 text-secondary-foreground font-bold">F: {item.fat}g</Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground/80 ml-4 flex flex-wrap gap-4">
                                      <span>Fiber: {item.fiber}g</span>
                                      <span>•</span>
                                      <span>Sat. Fat: {item.saturatedFat}g</span>
                                      <span>•</span>
                                      <span>Sugar: {item.sugar}g</span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {log.healthInsight && (
                                <div className="mb-3 p-3 bg-white/40 border border-primary/5 rounded-lg flex items-start gap-2">
                                  <BrainCircuit className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  <p className="text-xs italic text-foreground/80">{log.healthInsight}</p>
                                </div>
                              )}

                              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/70">
                                <span>TOTAL P: {log.totalNutrients.protein}g</span>
                                <span>TOTAL C: {log.totalNutrients.carbs}g</span>
                                <span>TOTAL F: {log.totalNutrients.fat}g</span>
                                <span>TOTAL FIBER: {log.totalNutrients.fiber}g</span>
                                <span>TOTAL SAT. FAT: {log.totalNutrients.saturatedFat}g</span>
                                <span>TOTAL SUGAR: {log.totalNutrients.sugar}g</span>
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
                <CardHeader><CardTitle className="font-headline text-xl text-primary">Biometric Targets</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {[ 
                    { label: 'Protein', val: totalProtein, max: 150 }, 
                    { label: 'Carbs', val: totalCarbs, max: 220 }, 
                    { label: 'Fats', val: totalFats, max: 65 } 
                  ].map(m => (
                    <div key={m.label} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                        <span>{m.label}</span>
                        <span className="text-primary">{Number(m.val || 0).toFixed(1)}g / {m.max}g</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min((Number(m.val || 0) / m.max) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-secondary/20 border-secondary/20"><CardHeader className="pb-2"><CardTitle className="font-headline text-lg flex items-center gap-2 text-secondary-foreground"><Info className="h-4 w-4" /> Insight</CardTitle></CardHeader>
                <CardContent className="text-sm text-secondary-foreground/90 leading-relaxed">{filteredLogs.length === 0 ? "Log a meal to unlock analytics." : `Metabolic tracking active. Achieving ${Math.round((totalProtein / 150) * 100)}% of protein target.`}</CardContent>
              </Card>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-primary/10 shadow-sm bg-card">
                <CardHeader><CardTitle className="font-headline text-2xl flex items-center gap-2 text-primary"><BarChart3 className="h-5 w-5" /> Calorie Trends</CardTitle></CardHeader>
                <CardContent className="pt-6">
                  <ChartContainer config={{ calories: { label: "Calories", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dynamicWeeklyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Bar dataKey="calories" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {dynamicWeeklyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.calories > 2000 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.7)'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[ { icon: Flame, val: weeklyAvgCalories, label: 'Avg Daily Kcal' }, { icon: BarChart3, val: Math.max(...dynamicWeeklyData.map(d => d.calories)), label: 'Peak Day Kcal' }, { icon: History, val: `${dynamicWeeklyData.length} / ${dynamicWeeklyData.length}`, label: 'Days Tracked' } ].map((s, i) => (
                  <Card key={i} className="bg-secondary/30 border-primary/5"><CardContent className="pt-6 text-center"><div className="flex justify-center mb-2"><s.icon className="h-6 w-6 text-primary" /></div><p className="text-2xl font-bold text-primary">{s.val}</p><p className="text-[10px] text-muted-foreground uppercase font-bold">{s.label}</p></CardContent></Card>
                ))}
              </div>
            </div>
            <aside className="space-y-6">
              <Card className="border-primary/10 shadow-sm bg-card">
                <CardHeader><CardTitle className="font-headline text-xl text-primary">Biometric Progress</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {[ { label: 'Protein', val: weeklyTotalProtein, max: 150 }, { label: 'Carbs', val: weeklyTotalCarbs, max: 220 }, { label: 'Fats', val: weeklyTotalFats, max: 65 } ].map(m => (
                    <div key={m.label} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground"><span>{m.label}</span><span className="text-secondary-foreground">{Number(m.val || 0).toFixed(1)}g / {(m.max * dynamicWeeklyData.length).toFixed(1)}g</span></div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-secondary-foreground" style={{ width: `${Math.min((Number(m.val || 0) / (m.max * dynamicWeeklyData.length)) * 100, 100)}%` }} /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-secondary/20 border-secondary/20"><CardHeader className="pb-2"><CardTitle className="font-headline text-lg flex items-center gap-2 text-secondary-foreground"><BrainCircuit className="h-4 w-4" /> Period Insight</CardTitle></CardHeader>
                <CardContent className="text-sm text-secondary-foreground/90 leading-relaxed">Historical tracking active. Maintaining a consistent metabolic rate with an average of {weeklyAvgCalories} kcal/day.</CardContent>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

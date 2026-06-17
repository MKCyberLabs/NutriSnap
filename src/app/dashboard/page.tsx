'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { User, MealCategory, MealLog } from '@/lib/types';
import { MealCategoryCard } from '@/components/dashboard/MealCategoryCard';
import { MealAnalysisTool } from '@/components/dashboard/MealAnalysisTool';
import { MealNutritionalAnalysisOutput } from '@/ai/flows/meal-nutritional-analysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, History, TrendingUp, Info, ChevronLeft, ChevronRight, BrainCircuit } from 'lucide-react';
import { format, isSameDay, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<MealCategory | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMounted, setIsMounted] = useState(false);

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

  const handleAnalysisComplete = (data: MealNutritionalAnalysisOutput) => {
    if (!activeAnalysis) return;

    const now = new Date();
    const logTimestamp = new Date(selectedDate);
    logTimestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    const newLog: MealLog = {
      id: Math.random().toString(36).substr(2, 9),
      category: activeAnalysis,
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
    setActiveAnalysis(null);
  };

  const filteredLogs = logs.filter(log => isSameDay(new Date(log.timestamp), selectedDate));

  const getCategoryTotal = (cat: MealCategory) => {
    return filteredLogs
      .filter(l => l.category === cat)
      .reduce((sum, log) => sum + log.totalNutrients.calories, 0);
  };

  const totalCaloriesForDay = filteredLogs.reduce((sum, l) => sum + l.totalNutrients.calories, 0);

  const parseAmount = (str: string) => parseInt(str.replace(/[^0-9]/g, '')) || 0;

  const totalProtein = filteredLogs.reduce((acc, log) => acc + parseAmount(log.totalNutrients.protein), 0);
  const totalCarbs = filteredLogs.reduce((acc, log) => acc + parseAmount(log.totalNutrients.carbs), 0);
  const totalFats = filteredLogs.reduce((acc, log) => acc + parseAmount(log.totalNutrients.fat), 0);

  if (!isMounted) return null;

  return (
    <div className="min-h-svh bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary">Wellness Hub</h1>
              <div className="flex items-center gap-2 mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "justify-start text-left font-normal border-primary/20 hover:bg-secondary",
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
            </div>
          </div>
          <div className="flex gap-4">
            <Card className="bg-primary text-primary-foreground border-none shadow-lg px-6 py-4 flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Intake</p>
                <p className="text-2xl font-bold">{totalCaloriesForDay} <span className="text-sm font-normal opacity-70">kcal</span></p>
              </div>
            </Card>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as MealCategory[]).map((cat) => (
                <MealCategoryCard 
                  key={cat} 
                  category={cat} 
                  totalCalories={getCategoryTotal(cat)}
                  onAddClick={() => setActiveAnalysis(cat)} 
                />
              ))}
            </section>

            {activeAnalysis && (
              <section className="animate-in slide-in-from-bottom-4 duration-300">
                <MealAnalysisTool 
                  category={activeAnalysis} 
                  onAnalysisComplete={handleAnalysisComplete}
                  onCancel={() => setActiveAnalysis(null)}
                />
              </section>
            )}

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

            <Card className="bg-accent/10 border-accent/20">
              <CardHeader className="pb-2">
                <CardTitle className="font-headline text-lg flex items-center gap-2 text-accent-foreground">
                  <Info className="h-4 w-4" /> Insight
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-accent-foreground/90 font-body leading-relaxed">
                {filteredLogs.length === 0 
                  ? "Initialize your daily log to unlock personalized wellness analytics."
                  : "Metabolic tracking active. You have achieved " + Math.round((totalProtein / 150) * 100) + "% of your daily protein target."
                }
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

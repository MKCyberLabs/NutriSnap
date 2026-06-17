
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
import { Separator } from '@/components/ui/separator';
import { Calendar, History, TrendingUp, Info } from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<MealCategory | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session);
    
    // Load logs from local storage
    const savedLogs = localStorage.getItem('nutrisnap_logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
  }, [router]);

  const handleAnalysisComplete = (data: MealNutritionalAnalysisOutput) => {
    if (!activeAnalysis) return;

    const newLog: MealLog = {
      id: Math.random().toString(36).substr(2, 9),
      category: activeAnalysis,
      timestamp: new Date().toISOString(),
      items: data.foodItems.map(item => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9),
      })),
      totalNutrients: data.totalNutrients,
    };

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    localStorage.setItem('nutrisnap_logs', JSON.stringify(updatedLogs));
    setActiveAnalysis(null);
  };

  const getCategoryTotal = (cat: MealCategory) => {
    return logs
      .filter(l => l.category === cat)
      .reduce((sum, log) => sum + log.totalNutrients.calories, 0);
  };

  const totalToday = logs.reduce((sum, l) => sum + l.totalNutrients.calories, 0);

  return (
    <div className="min-h-svh bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-headline font-bold text-primary">Daily Overview</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" /> {format(new Date(), 'EEEE, MMMM do')}
            </p>
          </div>
          <div className="flex gap-4">
            <Card className="bg-primary text-primary-foreground border-none shadow-lg px-6 py-4 flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs opacity-70 font-medium uppercase tracking-tighter">Total Calories</p>
                <p className="text-2xl font-bold">{totalToday} <span className="text-sm font-normal opacity-70">kcal</span></p>
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

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <History className="h-5 w-5 text-accent" /> Activity Log
                  </CardTitle>
                  <CardDescription>Your chronological intake feed</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-xl">
                      <p>No activity logged for today.</p>
                      <p className="text-sm opacity-60">Tap + on a category above to start.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {logs.map((log) => (
                        <div key={log.id} className="relative pl-6 border-l-2 border-slate-100 pb-4 last:pb-0">
                          <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-accent border-4 border-white shadow-sm" />
                          <div className="bg-slate-50 rounded-xl p-4 hover:bg-slate-100/50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge variant="secondary" className="mb-1">{log.category}</Badge>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {format(new Date(log.timestamp), 'h:mm a')}
                                </span>
                              </div>
                              <span className="font-bold text-primary">{log.totalNutrients.calories} kcal</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {log.items.map((item) => (
                                <div key={item.id} className="text-xs bg-white border border-slate-100 rounded-md p-2 flex flex-col">
                                  <span className="font-semibold truncate">{item.name}</span>
                                  <span className="text-muted-foreground">{item.calories} cal</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex gap-4 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                              <span>P: {log.totalNutrients.protein}g</span>
                              <span>C: {log.totalNutrients.carbs}g</span>
                              <span>F: {log.totalNutrients.fat}g</span>
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
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="font-headline text-xl">Target Macros</CardTitle>
                <CardDescription>Based on your profile metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Protein</span>
                    <span className="text-muted-foreground">120g / 150g</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '80%' }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Carbohydrates</span>
                    <span className="text-muted-foreground">180g / 220g</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '82%' }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Fats</span>
                    <span className="text-muted-foreground">45g / 65g</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500" style={{ width: '69%' }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-accent/10 border-none">
              <CardHeader>
                <CardTitle className="font-headline text-lg flex items-center gap-2 text-accent">
                  <Info className="h-4 w-4" /> Insight
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-accent-foreground font-body leading-relaxed">
                You've tracked 85% of your protein goal for today. Adding a snack like Greek yogurt or almonds could help you reach your target.
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

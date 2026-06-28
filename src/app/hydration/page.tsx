'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { getHydrationLogs, getWeeklyHydrationData, logHydration, deleteHydrationLog, updateHydrationLog, getUserDailyWaterGoal } from './actions';
import { User, HydrationEntry, DrinkType } from '@/lib/types';
import { format, subDays, addDays, startOfWeek, endOfWeek, differenceInDays, parseISO, isSameDay, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

import { GlassWater, Droplets, Wine, Plus, Clock, ChevronLeft, ChevronRight, Pen, Trash2, Coffee, CupSoda, Milk, TrendingUp, BarChart3, History, Info, Calendar as CalendarIcon, Loader2 } from 'lucide-react';

const DRINK_TYPES = [
  { type: 'Water', emoji: '💧', icon: GlassWater },
  { type: 'Coffee', emoji: '☕', icon: Coffee },
  { type: 'Soft Drink', emoji: '🥤', icon: CupSoda },
  { type: 'Milk', emoji: '🥛', icon: Milk },
  { type: 'Smoothie', emoji: '🥤', icon: CupSoda },
];

export default function HydrationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [date, setDate] = useState<Date>(new Date());
  
  // Weekly dates state
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  const [dailyGoal, setDailyGoal] = useState<number>(2750);
  const [logs, setLogs] = useState<HydrationEntry[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<HydrationEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Custom log modal state
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customMl, setCustomMl] = useState<number>(250);
  const [customType, setCustomType] = useState<DrinkType>('Water');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const session = getAuthSession() as User | null;
    if (!session) {
      router.push('/');
      return;
    }
    if (!session.onboarded) {
      router.push('/onboarding');
      return;
    }
    setUser(session);
    
    // Load daily goal
    getUserDailyWaterGoal(session.id).then(goal => setDailyGoal(goal));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    refreshData();
  }, [user, date, weekStart, activeTab]);

  const refreshData = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      if (activeTab === 'daily') {
        const data = await getHydrationLogs(user.id, date);
        setLogs(data as any);
      } else {
        const end = addDays(weekStart, 6);
        const data = await getWeeklyHydrationData(user.id, weekStart, end);
        setWeeklyLogs(data as any);
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load hydration data.' });
    }
    setIsRefreshing(false);
  };

  const handleQuickAdd = async (amount: number) => {
    if (!user) return;
    try {
      await logHydration(user.id, amount, 'Water');
      toast({ title: 'Logged!', description: `Added ${amount}ml of Water.` });
      refreshData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to log drink.' });
    }
  };

  const handleSaveCustom = async () => {
    if (!user) return;
    try {
      if (editingLogId) {
        await updateHydrationLog(editingLogId, customMl, customType);
        toast({ title: 'Updated!', description: 'Hydration entry updated.' });
      } else {
        await logHydration(user.id, customMl, customType);
        toast({ title: 'Logged!', description: `Added ${customMl}ml of ${customType}.` });
      }
      setCustomDialogOpen(false);
      refreshData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save entry.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteHydrationLog(deleteId);
      toast({ title: 'Deleted', description: 'Hydration entry removed.' });
      setDeleteId(null);
      refreshData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete entry.' });
    }
  };

  const openCustomModal = (log?: HydrationEntry) => {
    if (log) {
      setEditingLogId(log.id);
      setCustomMl(log.amountMl);
      setCustomType(log.drinkType as DrinkType);
    } else {
      setEditingLogId(null);
      setCustomMl(250);
      setCustomType('Water');
    }
    setCustomDialogOpen(true);
  };

  const totalIntake = useMemo(() => {
    return logs.reduce((sum, log) => sum + log.amountMl, 0);
  }, [logs]);

  const progressPercentage = useMemo(() => {
    const pct = (totalIntake / dailyGoal) * 100;
    return Math.min(100, Math.round(pct));
  }, [totalIntake, dailyGoal]);

  const filledGlasses = useMemo(() => {
    return Math.min(8, Math.round((totalIntake / dailyGoal) * 8));
  }, [totalIntake, dailyGoal]);

  // Weekly calculations
  const weeklyStats = useMemo(() => {
    if (activeTab !== 'weekly') return null;
    
    let totalWater = 0;
    let totalOther = 0;
    let maxDay = 0;
    
    // Aggregate by day
    const dayTotals = new Array(7).fill(0);
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    weeklyLogs.forEach(log => {
      if (log.drinkType === 'Water') totalWater += log.amountMl;
      else totalOther += log.amountMl;
      
      const logDate = new Date(log.createdAt);
      // get day index relative to weekStart
      const dayIndex = differenceInDays(startOfDay(logDate), startOfDay(weekStart));
      if (dayIndex >= 0 && dayIndex < 7) {
        dayTotals[dayIndex] += log.amountMl;
      }
    });

    const chartData = dayTotals.map((total, i) => {
      maxDay = Math.max(maxDay, total);
      return {
        day: dayLabels[i],
        total
      };
    });

    // Calculate streak (consecutive days hitting goal starting from today backwards)
    let streak = 0;
    for (let i = 6; i >= 0; i--) {
      if (dayTotals[i] >= dailyGoal) {
        streak++;
      } else {
        // If we want a strict streak that resets on missed day, break here
        // Except if day i is in the future, don't break.
        const dayDate = addDays(weekStart, i);
        if (dayDate <= new Date() && dayTotals[i] < dailyGoal) {
            break;
        }
      }
    }

    const avgTotal = Math.round((totalWater + totalOther) / 7);
    
    return {
      chartData,
      totalWater,
      totalOther,
      avgTotal,
      maxDay,
      streak
    };
  }, [weeklyLogs, weekStart, activeTab, dailyGoal]);

  const getIconForType = (type: string) => {
    const dt = DRINK_TYPES.find(d => d.type === type);
    const Icon = dt ? dt.icon : CupSoda;
    return <Icon className="h-5 w-5 text-white" />;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  if (!user) return null;

  return (
    <div className="hydration-theme min-h-svh bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
        
        {/* Header & Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-sky-950 flex items-center gap-2">
              <Droplets className="h-8 w-8 text-sky-500" />
              Hydration Hub
            </h1>
            <p className="text-sky-700 mt-1">Track your daily water intake and stay hydrated.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/50 p-2 rounded-2xl backdrop-blur-sm border border-white/60">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2 bg-sky-100/50">
                <TabsTrigger value="daily" className="data-[state=active]:bg-white data-[state=active]:text-sky-600 data-[state=active]:shadow-sm rounded-xl">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="data-[state=active]:bg-white data-[state=active]:text-sky-600 data-[state=active]:shadow-sm rounded-xl">Weekly</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-sky-100">
              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="Previous period"
                onClick={() => activeTab === 'daily' ? setDate(subDays(date, 1)) : setWeekStart(subDays(weekStart, 7))}
                className="h-8 w-8 rounded-lg hover:bg-sky-50 text-sky-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-8 px-2 text-sm font-medium hover:bg-sky-50 text-sky-700 min-w-[120px] justify-center">
                    <CalendarIcon className="h-4 w-4 mr-2 text-sky-500" />
                    {activeTab === 'daily' 
                      ? format(date, 'MMM d, yyyy')
                      : `${format(weekStart, 'MMM d')} - ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-sky-100" align="center">
                  <Calendar
                    mode="single"
                    selected={activeTab === 'daily' ? date : weekStart}
                    onSelect={(d) => {
                      if (d) {
                        if (activeTab === 'daily') setDate(d);
                        else setWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
                      }
                    }}
                    initialFocus
                    className="rounded-xl border-sky-100"
                  />
                </PopoverContent>
              </Popover>

              <Button 
                variant="ghost" 
                size="icon"
                aria-label="Next period"
                disabled={activeTab === 'daily' ? isSameDay(date, new Date()) : isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))}
                onClick={() => activeTab === 'daily' ? setDate(addDays(date, 1)) : setWeekStart(addDays(weekStart, 7))}
                className="h-8 w-8 rounded-lg hover:bg-sky-50 text-sky-600"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab + (activeTab === 'daily' ? date.toISOString() : weekStart.toISOString())}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit="hidden"
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* LEFT COLUMN: The Bottle */}
            <motion.div variants={itemVariants} className="lg:col-span-3 flex justify-center lg:justify-start">
              <div className="relative w-64 h-[500px] md:h-[600px] flex flex-col items-center">
                {/* Bottle Cap/Neck */}
                <div className="w-20 h-12 bg-sky-100 border-x-4 border-t-4 border-blue-200 rounded-t-xl z-10 relative">
                  <div className="absolute top-2 w-full h-2 bg-sky-200/50"></div>
                  <div className="absolute top-6 w-full h-2 bg-sky-200/50"></div>
                </div>
                
                {/* Bottle Body */}
                <div className="relative w-full flex-1 bg-sky-50/50 border-4 border-blue-200 rounded-[4rem] overflow-hidden shadow-inner flex flex-col justify-end">
                  
                  {/* Water Fill */}
                  <div 
                    className="relative w-full bg-gradient-to-b from-cyan-400 to-blue-500"
                    style={{ 
                      height: `${activeTab === 'daily' ? progressPercentage : (weeklyStats ? Math.min(100, (weeklyStats.avgTotal / dailyGoal) * 100) : 0)}%`,
                      transition: 'height 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                  >
                    {/* SVG Waves using CSS animations defined in globals.css */}
                    <div className="absolute -top-[5%] w-[200%] h-12 wave-animation-1 text-cyan-400 opacity-80" style={{ transformOrigin: 'bottom' }}>
                      <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-full fill-current">
                        <path d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,144C672,139,768,181,864,197.3C960,213,1056,203,1152,176C1248,149,1344,107,1392,85.3L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                      </svg>
                    </div>
                    <div className="absolute -top-[2%] w-[200%] h-10 wave-animation-2 text-cyan-300 opacity-60 ml-[-50%]" style={{ transformOrigin: 'bottom' }}>
                      <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-full fill-current">
                        <path d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,117.3C960,139,1056,181,1152,192C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                      </svg>
                    </div>

                    {/* Bubbles */}
                    <div className="absolute bottom-10 left-10 w-3 h-3 bg-white/40 rounded-full bubble-animation" style={{ animationDelay: '0s' }}></div>
                    <div className="absolute bottom-20 left-1/2 w-4 h-4 bg-white/40 rounded-full bubble-animation" style={{ animationDelay: '1s' }}></div>
                    <div className="absolute bottom-14 right-12 w-2 h-2 bg-white/40 rounded-full bubble-animation" style={{ animationDelay: '2s' }}></div>
                    <div className="absolute bottom-32 left-1/3 w-3 h-3 bg-white/40 rounded-full bubble-animation" style={{ animationDelay: '1.5s' }}></div>
                  </div>
                  
                  {/* Floating Stats Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 pointer-events-none">
                    {activeTab === 'daily' ? (
                      <>
                        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-sm rounded-3xl p-4 shadow-xl border border-white/50 w-full mt-auto mb-12">
                          <p className="text-3xl font-extrabold text-cyan-600 mb-1">{totalIntake} ml</p>
                          <div className="w-12 h-1 bg-cyan-200 mx-auto rounded-full mb-1"></div>
                          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{dailyGoal} ml Goal</p>
                        </div>
                        <div className="absolute top-1/3 text-6xl font-black text-white/90 drop-shadow-md">
                          {progressPercentage}%
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-sm rounded-3xl p-4 shadow-xl border border-white/50 w-full mt-auto mb-12">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weekly Avg</p>
                          <p className="text-3xl font-extrabold text-cyan-600 mb-1">{weeklyStats?.avgTotal || 0} ml</p>
                          <div className="w-12 h-1 bg-cyan-200 mx-auto rounded-full"></div>
                        </div>
                        <div className="absolute top-1/3 text-6xl font-black text-white/90 drop-shadow-md flex flex-col items-center">
                          {weeklyStats ? Math.min(100, Math.round((weeklyStats.avgTotal / dailyGoal) * 100)) : 0}%
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* MIDDLE COLUMN */}
            <div className="lg:col-span-6 space-y-6">
              {activeTab === 'daily' ? (
                <>
                  {/* Quick Add Grid */}
                  <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <button onClick={() => handleQuickAdd(250)} className="group bg-white rounded-3xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm border border-sky-50 hover:shadow-md transition-all hover:-translate-y-1">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                        <GlassWater className="h-7 w-7" />
                      </div>
                      <span className="font-bold text-slate-700">250 ml</span>
                    </button>
                    
                    <button onClick={() => handleQuickAdd(500)} className="group bg-white rounded-3xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm border border-sky-50 hover:shadow-md transition-all hover:-translate-y-1">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                        <Droplets className="h-7 w-7" />
                      </div>
                      <span className="font-bold text-slate-700">500 ml</span>
                    </button>
                    
                    <button onClick={() => handleQuickAdd(750)} className="group bg-white rounded-3xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm border border-sky-50 hover:shadow-md transition-all hover:-translate-y-1">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                        <Wine className="h-7 w-7" />
                      </div>
                      <span className="font-bold text-slate-700">750 ml</span>
                    </button>
                    
                    <button onClick={() => openCustomModal()} className="group bg-white rounded-3xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm border border-sky-50 hover:shadow-md transition-all hover:-translate-y-1 border-dashed border-2 border-sky-200 bg-sky-50/30">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-sky-200 flex items-center justify-center text-sky-500 group-hover:bg-sky-50 transition-colors">
                        <Plus className="h-7 w-7" />
                      </div>
                      <span className="font-bold text-sky-600">Custom</span>
                    </button>
                  </motion.div>

                  {/* Daily Activity Timeline */}
                  <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-50">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                          <History className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-800">Daily Activity</h2>
                          <p className="text-sm text-slate-500">Visual timeline of your hydration intake.</p>
                        </div>
                      </div>
                      {isRefreshing && <Loader2 className="h-5 w-5 text-sky-500 animate-spin" />}
                    </div>

                    <ScrollArea className="h-[350px] pr-4">
                      {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center border-2 border-dashed border-sky-100 rounded-2xl p-8 text-center text-slate-400 font-medium">
                          No activity recorded for this day.<br/>Drink some water! 💧
                        </div>
                      ) : (
                        <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:left-[11px] before:w-[2px] before:-z-10 before:bg-sky-100">
                          {logs.map((log) => (
                            <div key={log.id} className="relative flex items-center gap-4">
                              <div className="absolute -left-[29px] w-3 h-3 rounded-full bg-white border-2 border-sky-500 shadow-sm" />
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                {getIconForType(log.drinkType)}
                              </div>
                              <div className="flex-1">
                                <h3 className="font-bold text-slate-800 text-lg leading-tight flex items-center gap-2">
                                  {log.amountMl} ml <span className="text-sm font-medium text-slate-500">({log.drinkType})</span>
                                </h3>
                                <p className="text-sm font-medium text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  {format(new Date(log.createdAt), 'h:mm a')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" aria-label="Edit hydration log" onClick={() => openCustomModal(log)} className="h-8 w-8 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl">
                                  <Pen className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Delete hydration log" onClick={() => setDeleteId(log.id)} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Weekly Trends Chart */}
                  <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-50">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-sky-500" />
                      Hydration Trends
                    </h2>
                    <div className="h-[300px] w-full">
                      {weeklyStats && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyStats.chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={50}>
                              {weeklyStats.chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.total >= dailyGoal ? '#0ea5e9' : '#38bdf8'} opacity={entry.total > 0 ? 1 : 0.2} />
                              ))}
                              <LabelList dataKey="total" position="top" fill="#0ea5e9" fontSize={10} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </motion.div>

                  {/* Weekly Stat Cards */}
                  <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-sky-50 flex flex-col items-center text-center">
                      <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-500 mb-3">
                        <Droplets className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Consum</span>
                      <span className="text-2xl font-bold text-slate-800">{weeklyStats?.avgTotal || 0}</span>
                      <span className="text-xs font-medium text-slate-500">ml/day</span>
                    </div>
                    
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-sky-50 flex flex-col items-center text-center">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mb-3">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Max Consum</span>
                      <span className="text-2xl font-bold text-slate-800">{weeklyStats?.maxDay || 0}</span>
                      <span className="text-xs font-medium text-slate-500">ml</span>
                    </div>

                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-sky-50 flex flex-col items-center text-center">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 mb-3">
                        <History className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Days Streak</span>
                      <span className="text-2xl font-bold text-slate-800">{weeklyStats?.streak || 0}</span>
                      <span className="text-xs font-medium text-slate-500">days</span>
                    </div>
                  </motion.div>
                </>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-3 space-y-6">
              {activeTab === 'daily' ? (
                <>
                  {/* Hydration Insights */}
                  <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-50">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Hydration Insights</h2>
                    
                    <div className="grid grid-cols-4 gap-y-4 gap-x-2 mb-6">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex justify-center">
                          <GlassWater className={`h-8 w-8 transition-colors duration-500 ${i < filledGlasses ? 'text-cyan-500 drop-shadow-sm' : 'text-slate-200'}`} fill={i < filledGlasses ? 'currentColor' : 'none'} />
                        </div>
                      ))}
                    </div>

                    <p className="text-sm font-semibold text-slate-600 text-center mb-4">
                      {progressPercentage >= 100 
                        ? "Goal reached! Excellent hydration today! 🎉" 
                        : `You're ${progressPercentage}% of the way to your goal! Keep it up!`}
                    </p>

                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-sky-400 to-cyan-400 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${progressPercentage}%` }} 
                      />
                    </div>
                  </motion.div>

                  {/* Did you know? */}
                  <motion.div variants={itemVariants} className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <Info className="h-24 w-24 text-emerald-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Info className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-emerald-900">Did you know?</h3>
                    </div>
                    <p className="text-emerald-800 text-sm font-medium leading-relaxed">
                      Drinking water before meals can help with digestion and portion control by making you feel fuller faster.
                    </p>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Range Progress */}
                  <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-50">
                    <h2 className="text-lg font-bold text-slate-800 mb-6">Range Progress</h2>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plain Water</span>
                          <span className="text-sm font-bold text-slate-700">{weeklyStats?.totalWater || 0} / {dailyGoal * 7} ml</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-sky-500 rounded-full" 
                            style={{ width: `${Math.min(100, ((weeklyStats?.totalWater || 0) / (dailyGoal * 7)) * 100)}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Other Beverages</span>
                          <span className="text-sm font-bold text-slate-700">{weeklyStats?.totalOther || 0} ml</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-400 rounded-full" 
                            style={{ width: `${Math.min(100, ((weeklyStats?.totalOther || 0) / (dailyGoal * 3)) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Period Insight */}
                  <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-100 to-transparent rounded-bl-[100px] -z-0 opacity-50"></div>
                    <h2 className="text-lg font-bold text-slate-800 mb-3 relative z-10">Period Insight</h2>
                    <p className="text-rose-500 font-semibold text-sm mb-3 relative z-10">
                      Historical tracking analysis complete.
                    </p>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed relative z-10">
                      The weekly averages are derived from your actual logged entries for this period.
                      <br/><br/>
                      Great job on maintaining a consistent hydration routine this week! Keep it up.
                    </p>
                  </motion.div>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Custom Log Dialog */}
      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border-0 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold text-center">
              {editingLogId ? 'Edit Drink' : 'Log Custom Drink'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8 py-2">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center mb-4">Select Drink Type</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {DRINK_TYPES.map((dt) => (
                  <button
                    key={dt.type}
                    onClick={() => setCustomType(dt.type as DrinkType)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${customType === dt.type ? 'bg-sky-500 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    <span className="text-2xl">{dt.emoji}</span>
                    <span className="text-xs font-semibold">{dt.type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center mb-2">Amount</p>
              <div className="text-center mb-4">
                <span className="text-4xl font-extrabold text-sky-600">{customMl}</span>
                <span className="text-xl font-bold text-sky-400 ml-1">ml</span>
              </div>
              
              <div className="px-4">
                <input 
                  type="range" 
                  min="50" 
                  max="2000" 
                  step="50"
                  value={customMl}
                  onChange={(e) => setCustomMl(Number(e.target.value))}
                  className="w-full accent-sky-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" 
                />
                <div className="flex justify-between mt-2 text-xs font-bold text-slate-400">
                  <span>50 ml</span>
                  <span>2000 ml</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveCustom} 
              className="w-full h-14 rounded-2xl text-lg font-bold bg-sky-500 hover:bg-sky-600 shadow-lg shadow-sky-500/30"
            >
              {editingLogId ? 'Update Entry' : 'Log Drink'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Hydration Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This entry will be permanently removed from your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { getAuthSession } from '@/lib/auth-mock';
import { getHydrationLogs, getWeeklyHydrationData, logHydration, deleteHydrationLog, updateHydrationLog, getUserDailyWaterGoal } from './actions';
import { User, HydrationEntry, DrinkType } from '@/lib/types';
import { format, subDays, addDays, startOfWeek, endOfWeek, differenceInDays, parseISO, isSameDay, startOfDay } from 'date-fns';
import { motion, AnimatePresence, Variants } from 'framer-motion';
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



// ⚡ Bolt Optimization: Localized state for the custom drink dialog to prevent the slider
// from re-rendering the entire page on every single value change during drag.
function CustomDrinkDialog({
  open,
  onOpenChange,
  editingLog,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLog: HydrationEntry | null;
  onSave: (ml: number, type: DrinkType, logId: string | null) => Promise<void>;
}) {
  const [customMl, setCustomMl] = useState<number>(250);
  const [customType, setCustomType] = useState<DrinkType>('Water');

  useEffect(() => {
    if (open) {
      if (editingLog) {
        setCustomMl(editingLog.amountMl);
        setCustomType(editingLog.drinkType as DrinkType);
      } else {
        setCustomMl(250);
        setCustomType('Water');
      }
    }
  }, [open, editingLog]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 border border-[#E2E8F0] bg-white shadow-xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-center text-[#1E293B]">
            {editingLog ? 'Edit Drink' : 'Log Custom Drink'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div>
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider text-center mb-3">Select Drink Type</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {DRINK_TYPES.map((dt) => (
                <button
                  key={dt.type}
                  type="button"
                  aria-label={dt.type}
                  aria-pressed={customType === dt.type}
                  onClick={() => setCustomType(dt.type as DrinkType)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${customType === dt.type ? 'bg-[#F5F3FF] border-[#6D28D9] text-[#6D28D9] shadow-xs font-bold' : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'}`}
                >
                  <span className="text-2xl" aria-hidden="true">{dt.emoji}</span>
                  <span className="text-xs">{dt.type}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider text-center mb-1">Amount</p>
            <div className="text-center mb-3">
              <span className="text-4xl font-extrabold text-[#0284C7]">{customMl}</span>
              <span className="text-xl font-bold text-[#38BDF8] ml-1">ml</span>
            </div>

            <div className="px-4">
              <input
                aria-label="Custom hydration amount in milliliters"
                type="range"
                min="50"
                max="2000"
                step="50"
                value={customMl}
                onChange={(e) => setCustomMl(Number(e.target.value))}
                className="w-full accent-[#0284C7] h-2 bg-[#F1F5F9] rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between mt-2 text-xs font-semibold text-[#94A3B8]">
                <span>50 ml</span>
                <span>2000 ml</span>
              </div>
            </div>
          </div>

          <Button
            onClick={() => onSave(customMl, customType, editingLog ? editingLog.id : null)}
            className="w-full h-12 rounded-xl text-base font-semibold bg-[#6D28D9] hover:bg-[#5B21B6] text-white shadow-xs"
          >
            {editingLog ? 'Update Entry' : 'Log Drink'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ⚡ Bolt Optimization: Hoist invariant static arrays outside the component
// Prevents O(N) array allocations on every render.
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GLASSES_ARRAY = Array.from({ length: 8 });

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
  const [editingLog, setEditingLog] = useState<HydrationEntry | null>(null);

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

  const handleSaveCustom = async (ml: number, type: DrinkType, logId: string | null) => {
    if (!user) return;
    try {
      if (logId) {
        await updateHydrationLog(logId, ml, type);
        toast({ title: 'Updated!', description: 'Hydration entry updated.' });
      } else {
        await logHydration(user.id, ml, type);
        toast({ title: 'Logged!', description: `Added ${ml}ml of ${type}.` });
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
    setEditingLog(log || null);
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
    const dayLabels = DAY_LABELS;
    
    // ⚡ Bolt Optimization: Calculate invariant startOfDay(weekStart) outside the loop
    // Prevents redundant O(N) object allocations and date math on every iteration
    const weekStartDay = startOfDay(weekStart);

    weeklyLogs.forEach(log => {
      if (log.drinkType === 'Water') totalWater += log.amountMl;
      else totalOther += log.amountMl;
      
      const logDate = new Date(log.createdAt);
      // get day index relative to weekStart
      const dayIndex = differenceInDays(startOfDay(logDate), weekStartDay);
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

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header & Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#1E293B] flex items-center gap-2">
              <Droplets className="h-6 w-6 text-[#0284C7]" />
              Water
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-normal">Track your daily water intake and stay hydrated.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-1.5 rounded-xl border border-[#E2E8F0] shadow-xs">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-[180px]">
              <TabsList className="grid w-full grid-cols-2 bg-[#F1F5F9] rounded-lg p-0.5">
                <TabsTrigger value="daily" className="data-[state=active]:bg-white data-[state=active]:text-[#6D28D9] data-[state=active]:shadow-xs rounded-md text-xs font-semibold">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="data-[state=active]:bg-white data-[state=active]:text-[#6D28D9] data-[state=active]:shadow-xs rounded-md text-xs font-semibold">Weekly</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-[#E2E8F0]">
              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="Previous period"
                onClick={() => activeTab === 'daily' ? setDate(subDays(date, 1)) : setWeekStart(subDays(weekStart, 7))}
                className="h-8 w-8 rounded-md hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#6D28D9]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-8 px-2 text-xs font-semibold hover:bg-[#F5F3FF] text-[#1E293B] hover:text-[#6D28D9] min-w-[120px] justify-center">
                    <CalendarIcon className="h-3.5 w-3.5 mr-2 text-[#6D28D9]" />
                    {activeTab === 'daily' 
                      ? format(date, 'MMM d, yyyy')
                      : `${format(weekStart, 'MMM d')} - ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border border-[#E2E8F0] bg-white rounded-xl shadow-xl" align="center">
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
                    className="rounded-xl border-none"
                  />
                </PopoverContent>
              </Popover>

              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="Next period"
                disabled={activeTab === 'daily' ? isSameDay(date, new Date()) : isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))}
                onClick={() => activeTab === 'daily' ? setDate(addDays(date, 1)) : setWeekStart(addDays(weekStart, 7))}
                className="h-8 w-8 rounded-md hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#6D28D9]"
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
                    <button type="button" aria-label="Quick add 250 milliliters of water" onClick={() => handleQuickAdd(250)} className="group bg-white rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-xs border border-[#E2E8F0] hover:border-[#6D28D9] hover:bg-[#F5F3FF] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]">
                      <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#0284C7] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <GlassWater className="h-6 w-6" />
                      </div>
                      <span className="font-bold text-[#1E293B] text-sm">250 ml</span>
                    </button>
                    
                    <button type="button" aria-label="Quick add 500 milliliters of water" onClick={() => handleQuickAdd(500)} className="group bg-white rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-xs border border-[#E2E8F0] hover:border-[#6D28D9] hover:bg-[#F5F3FF] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]">
                      <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#0284C7] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Droplets className="h-6 w-6" />
                      </div>
                      <span className="font-bold text-[#1E293B] text-sm">500 ml</span>
                    </button>
                    
                    <button type="button" aria-label="Quick add 750 milliliters of water" onClick={() => handleQuickAdd(750)} className="group bg-white rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-xs border border-[#E2E8F0] hover:border-[#6D28D9] hover:bg-[#F5F3FF] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]">
                      <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#0284C7] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Wine className="h-6 w-6" />
                      </div>
                      <span className="font-bold text-[#1E293B] text-sm">750 ml</span>
                    </button>
                    
                    <button type="button" aria-label="Log custom drink entry" onClick={() => openCustomModal()} className="group bg-[#F8FAFC] rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-xs border border-dashed border-[#DDD6FE] hover:border-[#6D28D9] hover:bg-[#F5F3FF] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]">
                      <div className="w-12 h-12 rounded-xl bg-white border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9] group-hover:bg-[#F5F3FF] transition-colors">
                        <Plus className="h-6 w-6" />
                      </div>
                      <span className="font-bold text-[#6D28D9] text-sm">Custom</span>
                    </button>
                  </motion.div>

                  {/* Daily Activity Timeline */}
                  <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-xs border border-[#E2E8F0]">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#0284C7]">
                          <History className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-[#1E293B]">Daily Activity</h2>
                          <p className="text-xs text-[#64748B]">Visual timeline of your hydration intake.</p>
                        </div>
                      </div>
                      {isRefreshing && <Loader2 className="h-5 w-5 text-[#6D28D9] animate-spin" />}
                    </div>

                    <ScrollArea className="h-[350px] pr-4">
                      {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center text-[#64748B] text-sm font-medium bg-[#F8FAFC]">
                          No activity recorded for this day.<br/>Drink some water! 💧
                        </div>
                      ) : (
                        <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:left-[11px] before:w-[2px] before:-z-10 before:bg-[#E2E8F0]">
                          {logs.map((log) => (
                            <div key={log.id} className="relative flex items-center gap-4">
                              <div className="absolute -left-[29px] w-3 h-3 rounded-full bg-white border-2 border-[#0284C7] shadow-xs" />
                              <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#0284C7] flex items-center justify-center flex-shrink-0 shadow-xs">
                                {getIconForType(log.drinkType)}
                              </div>
                              <div className="flex-1">
                                <h3 className="font-bold text-[#1E293B] text-base leading-tight flex items-center gap-2">
                                  {log.amountMl} ml <span className="text-xs font-medium text-[#64748B]">({log.drinkType})</span>
                                </h3>
                                <p className="text-xs font-medium text-[#94A3B8] flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(log.createdAt), 'h:mm a')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" aria-label="Edit hydration log" onClick={() => openCustomModal(log)} className="h-8 w-8 text-[#64748B] hover:text-[#6D28D9] hover:bg-[#F5F3FF] rounded-lg">
                                  <Pen className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Delete hydration log" onClick={() => setDeleteId(log.id)} className="h-8 w-8 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg">
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
                  <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-xs border border-[#E2E8F0]">
                    <h2 className="text-xl font-bold text-[#1E293B] mb-6 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[#0284C7]" />
                      Hydration Trends
                    </h2>
                    <div className="h-[300px] w-full">
                      {weeklyStats && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyStats.chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={44}>
                              {weeklyStats.chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.total >= dailyGoal ? '#0284C7' : '#38BDF8'} opacity={entry.total > 0 ? 1 : 0.3} />
                              ))}
                              <LabelList dataKey="total" position="top" fill="#0284C7" fontSize={10} fontWeight="bold" formatter={(val: number) => val > 0 ? val : ''} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </motion.div>

                  {/* Weekly Stat Cards */}
                  <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#E2E8F0] flex flex-col items-center text-center">
                      <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#0284C7] mb-2">
                        <Droplets className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Avg Consum</span>
                      <span className="text-2xl font-bold text-[#1E293B]">{weeklyStats?.avgTotal || 0}</span>
                      <span className="text-xs font-medium text-[#64748B]">ml/day</span>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#E2E8F0] flex flex-col items-center text-center">
                      <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#0284C7] mb-2">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Max Consum</span>
                      <span className="text-2xl font-bold text-[#1E293B]">{weeklyStats?.maxDay || 0}</span>
                      <span className="text-xs font-medium text-[#64748B]">ml</span>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#E2E8F0] flex flex-col items-center text-center">
                      <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#0284C7] mb-2">
                        <History className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Days Streak</span>
                      <span className="text-2xl font-bold text-[#1E293B]">{weeklyStats?.streak || 0}</span>
                      <span className="text-xs font-medium text-[#64748B]">days</span>
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
                  <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-xs border border-[#E2E8F0]">
                    <h2 className="text-lg font-bold text-[#1E293B] mb-4">Hydration Insights</h2>
                    
                    <div className="grid grid-cols-4 gap-y-4 gap-x-2 mb-6">
                      {GLASSES_ARRAY.map((_, i) => (
                        <div key={i} className="flex justify-center">
                          <GlassWater className={`h-8 w-8 transition-colors duration-500 ${i < filledGlasses ? 'text-[#0284C7] drop-shadow-sm' : 'text-[#CBD5E1]'}`} fill={i < filledGlasses ? 'currentColor' : 'none'} />
                        </div>
                      ))}
                    </div>

                    <p className="text-sm font-semibold text-[#1E293B] text-center mb-4">
                      {progressPercentage >= 100 
                        ? "Goal reached! Excellent hydration today! 🎉" 
                        : `You're ${progressPercentage}% of the way to your goal! Keep it up!`}
                    </p>

                    <div className="h-2.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#0284C7] rounded-full transition-all duration-700 ease-out" 
                        style={{ width: `${progressPercentage}%` }} 
                      />
                    </div>
                  </motion.div>

                  {/* Did you know? */}
                  <motion.div variants={itemVariants} className="bg-[#F0FDF4] rounded-2xl p-5 border border-[#BBF7D0] shadow-xs relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <Info className="h-24 w-24 text-emerald-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
                        <Info className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-[#14532D]">Did you know?</h3>
                    </div>
                    <p className="text-[#166534] text-xs font-medium leading-relaxed">
                      Drinking water before meals can help with digestion and portion control by making you feel fuller faster.
                    </p>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Range Progress */}
                  <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-xs border border-[#E2E8F0]">
                    <h2 className="text-lg font-bold text-[#1E293B] mb-6">Range Progress</h2>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Plain Water</span>
                          <span className="text-sm font-bold text-[#1E293B]">{weeklyStats?.totalWater || 0} / {dailyGoal * 7} ml</span>
                        </div>
                        <div className="h-2 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#0284C7] rounded-full" 
                            style={{ width: `${Math.min(100, ((weeklyStats?.totalWater || 0) / (dailyGoal * 7)) * 100)}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Other Beverages</span>
                          <span className="text-sm font-bold text-[#1E293B]">{weeklyStats?.totalOther || 0} ml</span>
                        </div>
                        <div className="h-2 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${Math.min(100, ((weeklyStats?.totalOther || 0) / (dailyGoal * 3)) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Period Insight */}
                  <motion.div variants={itemVariants} className="bg-[#F5F3FF] rounded-2xl p-6 shadow-xs border border-[#DDD6FE] relative overflow-hidden">
                    <h2 className="text-lg font-bold text-[#6D28D9] mb-2 relative z-10">Period Insight</h2>
                    <p className="text-[#475569] text-xs font-medium leading-relaxed relative z-10">
                      The weekly averages are derived from your actual logged entries for this period. Great job on maintaining a consistent hydration routine this week! Keep it up.
                    </p>
                  </motion.div>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Custom Log Dialog */}
        <CustomDrinkDialog
          open={customDialogOpen}
          onOpenChange={setCustomDialogOpen}
          editingLog={editingLog}
          onSave={handleSaveCustom}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-[#1E293B]">Delete Hydration Entry?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-[#64748B]">
                This action cannot be undone. This entry will be permanently removed from your history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl border-[#E2E8F0]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

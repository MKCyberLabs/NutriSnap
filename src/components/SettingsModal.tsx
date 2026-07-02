'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, saveAuthSession } from '@/lib/auth-mock';
import { getReminders, saveReminder, toggleReminder, getUserTimezone, updateTimezone, getHydrationSetting, saveHydrationSetting } from '@/app/settings/actions';
import { getUserDailyWaterGoal, saveUserDailyWaterGoal } from '@/app/hydration/actions';
import { updateUserSettings } from '@/ai/actions/db-users';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Loader2, Save, KeyRound, MessageCircle, Clock, Target, Check, ChevronsUpDown, ShieldAlert, Activity, Settings2, Droplets } from 'lucide-react';
import { User } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';

const CATEGORIES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

type Tab = 'account' | 'health' | 'notifications' | 'preferences';

export function SettingsModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);

  // Reminders state
  const [reminders, setReminders] = useState<any[]>([]);
  const [savingReminder, setSavingReminder] = useState<string | null>(null);
  const [times, setTimes] = useState<Record<string, string>>({
    Breakfast: '08:00',
    Lunch: '13:00',
    Snack: '16:00',
    Dinner: '20:00'
  });
  const [hydrationSetting, setHydrationSetting] = useState<any>(null);

  // Settings form state
  const [initialState, setInitialState] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [calGoal, setCalGoal] = useState('');
  const [proGoal, setProGoal] = useState('');
  const [carbGoal, setCarbGoal] = useState('');
  const [fatGoal, setFatGoal] = useState('');
  
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('male');
  const [waterGoal, setWaterGoal] = useState('');

  // Timezone Combobox state
  const [tzSearch, setTzSearch] = useState('');
  const [isTzOpen, setIsTzOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const allTimezones = useMemo(() => {
    try {
      const tzs = Intl.supportedValuesOf('timeZone');
      if (!tzs.includes('Asia/Kolkata')) {
        tzs.push('Asia/Kolkata');
        tzs.sort();
      }
      return tzs;
    } catch (e) {
      return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata'];
    }
  }, []);

  const filteredTimezones = useMemo(() => {
    if (!tzSearch) return allTimezones;
    return allTimezones.filter(tz => tz.toLowerCase().includes(tzSearch.toLowerCase()));
  }, [allTimezones, tzSearch]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialState) return false;
    if (newPassword !== '') return true;
    if (telegramId !== initialState.telegramId) return true;
    if (timezone !== initialState.timezone) return true;
    if (calGoal !== initialState.calGoal) return true;
    if (proGoal !== initialState.proGoal) return true;
    if (carbGoal !== initialState.carbGoal) return true;
    if (fatGoal !== initialState.fatGoal) return true;
    if (age !== initialState.age) return true;
    if (weight !== initialState.weight) return true;
    if (height !== initialState.height) return true;
    if (gender !== initialState.gender) return true;
    if (waterGoal !== initialState.waterGoal) return true;
    return false;
  }, [initialState, newPassword, telegramId, timezone, calGoal, proGoal, carbGoal, fatGoal, age, weight, height, gender, waterGoal]);

  useEffect(() => {
    const session = getAuthSession() as any;
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session);
    setTelegramId(session.telegramId || '');
    setCalGoal(session.dailyCaloriesGoal ? String(session.dailyCaloriesGoal) : '');
    setProGoal(session.dailyProteinGoal ? String(session.dailyProteinGoal) : '');
    setCarbGoal(session.dailyCarbsGoal ? String(session.dailyCarbsGoal) : '');
    setFatGoal(session.dailyFatGoal ? String(session.dailyFatGoal) : '');
    setAge(session.age ? String(session.age) : '');
    setWeight(session.weight ? String(session.weight) : '');
    setHeight(session.height ? String(session.height) : '');
    setGender(session.gender || 'male');
    
    getReminders(session.id).then((data) => {
      setReminders(data);
      const newTimes = { ...times };
      data.forEach(r => {
        newTimes[r.category] = r.time;
      });
      setTimes(newTimes);
      
      getHydrationSetting(session.id).then((hs) => {
        if (hs) {
          setHydrationSetting(hs);
        } else {
          setHydrationSetting({
            startTime: '08:00',
            endTime: '22:00',
            intervalMinutes: 120,
            activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            isActive: true
          });
        }
      });

      getUserTimezone(session.id).then((tz) => {
        const userTz = tz || session.timezone || 'UTC';
        setTimezone(userTz);
        getUserDailyWaterGoal(session.id).then(g => {
          setWaterGoal(String(g));
          setInitialState({
            telegramId: session.telegramId || '',
            timezone: userTz,
            calGoal: session.dailyCaloriesGoal ? String(session.dailyCaloriesGoal) : '',
            proGoal: session.dailyProteinGoal ? String(session.dailyProteinGoal) : '',
            carbGoal: session.dailyCarbsGoal ? String(session.dailyCarbsGoal) : '',
            fatGoal: session.dailyFatGoal ? String(session.dailyFatGoal) : '',
            age: session.age ? String(session.age) : '',
            weight: session.weight ? String(session.weight) : '',
            height: session.height ? String(session.height) : '',
            gender: session.gender || 'male',
            waterGoal: String(g)
          });
          setLoading(false);
        });
      });
    });
  }, [router]);

  const requestTabChange = (tab: Tab) => {
    if (tab === activeTab) return;
    if (hasUnsavedChanges) {
      setPendingTab(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const confirmTabChange = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
      if (initialState) {
        setNewPassword('');
        setTelegramId(initialState.telegramId);
        setTimezone(initialState.timezone);
        setCalGoal(initialState.calGoal);
        setProGoal(initialState.proGoal);
        setCarbGoal(initialState.carbGoal);
        setFatGoal(initialState.fatGoal);
        setAge(initialState.age);
        setWeight(initialState.weight);
        setHeight(initialState.height);
        setGender(initialState.gender);
        setWaterGoal(initialState.waterGoal);
      }
    }
  };

  const handleSaveReminder = async (category: string) => {
    if (!user) return;
    setSavingReminder(category);
    try {
      const time = times[category];
      const existing = reminders.find(r => r.category === category);
      const isActive = existing ? existing.isActive : true;
      
      await saveReminder(user.id, category, time, isActive);
      
      const fresh = await getReminders(user.id);
      setReminders(fresh);
      
      toast({ title: 'Saved', description: `${category} reminder set to ${time}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save reminder.' });
    } finally {
      setSavingReminder(null);
    }
  };

  const handleToggleReminder = async (id: string, currentStatus: boolean) => {
    try {
      await toggleReminder(id, !currentStatus);
      const fresh = await getReminders(user!.id);
      setReminders(fresh);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to toggle reminder.' });
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.id) return;

    if (newPassword) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
      if (!passwordRegex.test(newPassword)) {
        toast({ 
          variant: "destructive", 
          title: "Weak Password", 
          description: "Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a special character." 
        });
        return;
      }
    } else if (activeTab === 'account') {
      toast({ variant: "destructive", title: "Validation Error", description: "Please enter a new password to save." });
      return;
    }

    setSavingSettings(true);

    const payload = {
      telegramId: telegramId || undefined,
      password: newPassword || undefined,
      timezone: timezone,
      dailyCaloriesGoal: calGoal ? parseInt(calGoal, 10) : undefined,
      dailyProteinGoal: proGoal ? parseInt(proGoal, 10) : undefined,
      dailyCarbsGoal: carbGoal ? parseInt(carbGoal, 10) : undefined,
      dailyFatGoal: fatGoal ? parseInt(fatGoal, 10) : undefined,
      age: age ? parseInt(age, 10) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      height: height ? parseFloat(height) : undefined,
      gender: gender,
    };

    const res = await updateUserSettings(user.id, payload);
    
    if (waterGoal) {
      await saveUserDailyWaterGoal(user.id, parseInt(waterGoal, 10));
    }

    if (res.success) {
      const updatedUser = { ...user, ...payload, telegramId: telegramId || undefined } as User;
      saveAuthSession(updatedUser as any);
      setUser(updatedUser);
      setInitialState({
        ...initialState,
        telegramId: telegramId,
        timezone: timezone,
        calGoal: calGoal,
        proGoal: proGoal,
        carbGoal: carbGoal,
        fatGoal: fatGoal,
        age: age,
        weight: weight,
        height: height,
        gender: gender,
        waterGoal: waterGoal,
      });
      toast({ title: "Settings Saved", description: "Your profile has been updated successfully!" });
      setNewPassword('');
    } else {
      toast({ variant: "destructive", title: "Error", description: "Could not save settings." });
    }
    setSavingSettings(false);
  };

  const tabClasses = (tab: Tab) => 
    `flex-1 justify-center items-center text-center font-medium text-sm md:text-base px-6 py-4 rounded-2xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/40 text-foreground/60 hover:text-foreground'}`;

  const glassInputClasses = "rounded-xl bg-white dark:bg-black/60 shadow-inner focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all border border-gray-200 dark:border-gray-800 text-foreground";

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col overflow-hidden glass-card bg-white/80 dark:bg-slate-950/80 backdrop-blur-3xl border-white/50 p-6 md:p-8 rounded-[2.5rem] !gap-0 shadow-2xl">
        <DialogTitle className="text-4xl font-bold tracking-tight text-foreground mb-6 shrink-0">Settings</DialogTitle>
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>
        ) : (
          <div className="w-full flex-1 min-h-0 flex flex-col">
        
        <div className="flex flex-col gap-6 flex-1 min-h-0">
          {/* Top Navigation */}
          <div className="w-full flex gap-3 shrink-0 overflow-x-auto pb-2 custom-scrollbar">
            <Button variant="ghost" onClick={() => requestTabChange('account')} className={tabClasses('account')}>
              <ShieldAlert className="mr-2 h-5 w-5" /> Account & Security
            </Button>
            <Button variant="ghost" onClick={() => requestTabChange('health')} className={tabClasses('health')}>
              <Activity className="mr-2 h-5 w-5" /> Health & Biometrics
            </Button>
            <Button variant="ghost" onClick={() => requestTabChange('notifications')} className={tabClasses('notifications')}>
              <Bell className="mr-2 h-5 w-5" /> Notifications
            </Button>
            <Button variant="ghost" onClick={() => requestTabChange('preferences')} className={tabClasses('preferences')}>
              <Settings2 className="mr-2 h-5 w-5" /> Preferences
            </Button>
          </div>

          {/* Bottom Content Area */}
          <div className="w-full flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
            <Card className="glass-card border-white/60 rounded-3xl min-h-[500px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {activeTab === 'account' && (
                    <div>
                      <CardHeader>
                        <CardTitle className="text-2xl font-bold text-foreground">Account & Security</CardTitle>
                        <CardDescription>Update your password and secure your account.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="password" className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-primary" /> Reset Password</Label>
                          <Input 
                            id="password" 
                            type="password" 
                            placeholder="Enter new password to reset" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className={`h-12 ${glassInputClasses}`} 
                          />
                        </div>
                        <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-8 shadow-lg shadow-primary/20">
                          {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
                        </Button>
                      </CardContent>
                    </div>
                  )}

                  {activeTab === 'health' && (
                    <div>
                      <CardHeader>
                        <CardTitle className="text-2xl font-bold text-foreground">Health & Biometrics</CardTitle>
                        <CardDescription>Configure your daily macro goals and demographic info to improve AI accuracy.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        <div className="space-y-4 p-5 rounded-2xl bg-white/30 dark:bg-black/20 border border-white/40">
                          <h3 className="font-bold text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Biometrics</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="age">Age</Label>
                              <Input id="age" type="number" placeholder="30" value={age} onChange={e => setAge(e.target.value)} className={glassInputClasses} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="weight">Weight (kg)</Label>
                              <Input id="weight" type="number" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} className={glassInputClasses} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="height">Height (cm)</Label>
                              <Input id="height" type="number" placeholder="175" value={height} onChange={e => setHeight(e.target.value)} className={glassInputClasses} />
                            </div>
                            <div className="space-y-2 flex flex-col">
                              <Label className="mb-1">Gender</Label>
                              <select 
                                value={gender} 
                                onChange={e => setGender(e.target.value)}
                                className={`flex h-10 w-full items-center justify-between px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none ${glassInputClasses}`}
                              >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <Tabs defaultValue="nutrition" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/40 dark:bg-black/40 rounded-xl p-1 h-auto border border-white/20">
                            <TabsTrigger value="nutrition" className="rounded-lg py-2 transition-opacity data-[state=inactive]:opacity-60 data-[state=inactive]:hover:opacity-100 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Nutrition Goals</TabsTrigger>
                            <TabsTrigger value="hydration" className="rounded-lg py-2 transition-opacity data-[state=inactive]:opacity-60 data-[state=inactive]:hover:opacity-100 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-sm">Hydration Goal</TabsTrigger>
                          </TabsList>
                          <TabsContent value="nutrition" className="mt-0 outline-none">
                            <div className="space-y-4 p-5 rounded-2xl bg-white/30 dark:bg-black/20 border border-white/40">
                              <h3 className="font-bold text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Daily Nutrition Goals</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="calories">Calories (kcal)</Label>
                                  <Input id="calories" type="number" placeholder="2000" value={calGoal} onChange={e => setCalGoal(e.target.value)} className={glassInputClasses} />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="protein">Protein (g)</Label>
                                  <Input id="protein" type="number" placeholder="150" value={proGoal} onChange={e => setProGoal(e.target.value)} className={glassInputClasses} />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="carbs">Carbs (g)</Label>
                                  <Input id="carbs" type="number" placeholder="250" value={carbGoal} onChange={e => setCarbGoal(e.target.value)} className={glassInputClasses} />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="fat">Fat (g)</Label>
                                  <Input id="fat" type="number" placeholder="65" value={fatGoal} onChange={e => setFatGoal(e.target.value)} className={glassInputClasses} />
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                          <TabsContent value="hydration" className="mt-0 outline-none">
                            <div className="space-y-4 p-5 rounded-2xl bg-white/30 dark:bg-black/20 border border-white/40">
                              <h3 className="font-bold text-lg flex items-center gap-2"><Droplets className="h-5 w-5 text-sky-500" /> Daily Hydration Goal</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="waterGoal">Water (ml)</Label>
                                  <Input id="waterGoal" type="number" placeholder="2750" value={waterGoal} onChange={e => setWaterGoal(e.target.value)} className={glassInputClasses} />
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>

                        <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-8 shadow-lg shadow-primary/20">
                          {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Health Data
                        </Button>
                      </CardContent>
                    </div>
                  )}

                  {activeTab === 'notifications' && (
                    <div>
                      <CardHeader>
                        <CardTitle className="text-2xl font-bold text-foreground">Notifications</CardTitle>
                        <CardDescription>Manage Telegram bot integration and meal reminders.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        <div className="space-y-4">
                          <h3 className="font-bold text-lg flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Telegram Integration</h3>
                          <div className="space-y-2 max-w-md">
                            <Label htmlFor="telegram">Telegram ID</Label>
                            <div className="flex gap-2">
                              <Input 
                                id="telegram" 
                                placeholder="e.g. 123456789" 
                                value={telegramId} 
                                onChange={e => setTelegramId(e.target.value)} 
                                className={glassInputClasses} 
                              />
                              <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-6">
                                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Required to receive reminders and log meals via Telegram.</p>
                          </div>
                        </div>

                        <Tabs defaultValue="nutrisnap" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/40 dark:bg-black/40 rounded-xl p-1 h-auto border border-white/20">
                            <TabsTrigger value="nutrisnap" className="rounded-lg py-2 transition-opacity data-[state=inactive]:opacity-60 data-[state=inactive]:hover:opacity-100 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">NutriSnap Reminders</TabsTrigger>
                            <TabsTrigger value="hydration" className="rounded-lg py-2 transition-opacity data-[state=inactive]:opacity-60 data-[state=inactive]:hover:opacity-100 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-sm">Hydration Reminders</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="nutrisnap" className="mt-0 outline-none">
                            <div className="space-y-4 p-5 rounded-2xl bg-white/30 dark:bg-black/20 border border-white/40">
                              <h3 className="font-bold text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Telegram Reminders</h3>
                              <div className="space-y-4">
                                {CATEGORIES.map((cat) => {
                                  const existing = reminders.find(r => r.category === cat);
                                  const isActive = existing ? existing.isActive : false;
                                  
                                  return (
                                    <div key={cat} className="p-4 rounded-xl bg-white/20 dark:bg-black/20 border border-white/30 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                      <div className="flex items-center gap-4">
                                        <Switch 
                                          checked={isActive} 
                                          onCheckedChange={() => {
                                            if (existing) handleToggleReminder(existing.id, isActive);
                                            else handleSaveReminder(cat);
                                          }} 
                                        />
                                        <div>
                                          <h4 className="font-bold">{cat}</h4>
                                          <p className="text-xs text-muted-foreground">{isActive ? 'Active' : 'Disabled'}</p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        <Input 
                                          type="time" 
                                          value={times[cat]} 
                                          onChange={(e) => setTimes({ ...times, [cat]: e.target.value })}
                                          className={`w-32 ${glassInputClasses}`}
                                        />
                                        <Button onClick={() => handleSaveReminder(cat)} disabled={savingReminder === cat} variant="secondary" size="icon" aria-label={`Save ${cat} reminder`} className="shrink-0 rounded-xl bg-white/40 hover:bg-white/60">
                                          {savingReminder === cat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="hydration" className="mt-0 outline-none">
                            <div className="space-y-4 p-5 rounded-2xl bg-white/30 dark:bg-black/20 border border-white/40">
                              <h3 className="font-bold text-lg flex items-center gap-2"><Droplets className="h-5 w-5 text-blue-500" /> Hydration Reminders</h3>
                              {hydrationSetting && (
                                <div className="p-4 rounded-xl bg-white/20 dark:bg-black/20 border border-white/30 backdrop-blur-md space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="font-bold">Telegram Hydration Alerts</h4>
                                      <p className="text-xs text-muted-foreground">{hydrationSetting.isActive ? 'Active' : 'Disabled'}</p>
                                    </div>
                                    <Switch 
                                      checked={hydrationSetting.isActive} 
                                      onCheckedChange={async (checked) => {
                                        const next = { ...hydrationSetting, isActive: checked };
                                        setHydrationSetting(next);
                                        if (user) await saveHydrationSetting(user.id, next);
                                      }} 
                                    />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Wake Up Time</Label>
                                      <Input 
                                        type="time" 
                                        value={hydrationSetting.startTime} 
                                        onChange={(e) => setHydrationSetting({ ...hydrationSetting, startTime: e.target.value })}
                                        className={glassInputClasses}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Sleep Time</Label>
                                      <Input 
                                        type="time" 
                                        value={hydrationSetting.endTime} 
                                        onChange={(e) => setHydrationSetting({ ...hydrationSetting, endTime: e.target.value })}
                                        className={glassInputClasses}
                                      />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                      <Label>Reminder Interval</Label>
                                      <Select 
                                        value={String(hydrationSetting.intervalMinutes)}
                                        onValueChange={(val) => setHydrationSetting({ ...hydrationSetting, intervalMinutes: parseInt(val) })}
                                      >
                                        <SelectTrigger className={glassInputClasses}>
                                          <SelectValue placeholder="Select interval" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="30">30 minutes</SelectItem>
                                          <SelectItem value="60">1 hour</SelectItem>
                                          <SelectItem value="90">1.5 hours</SelectItem>
                                          <SelectItem value="120">2 hours</SelectItem>
                                          <SelectItem value="180">3 hours</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                      <Label className="mb-2 block">Active Days</Label>
                                      <div className="flex items-center gap-2">
                                        {['S','M','T','W','T','F','S'].map((dayLabel, idx) => {
                                          const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                                          const dayName = dayNames[idx];
                                          const isActiveDay = hydrationSetting.activeDays.includes(dayName);
                                          return (
                                            <button
                                              key={idx}
                                              onClick={() => {
                                                const newDays = isActiveDay 
                                                  ? hydrationSetting.activeDays.filter((d: string) => d !== dayName)
                                                  : [...hydrationSetting.activeDays, dayName];
                                                setHydrationSetting({ ...hydrationSetting, activeDays: newDays });
                                              }}
                                              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${isActiveDay ? 'bg-sky-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}
                                            >
                                              {dayLabel}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  <Button 
                                    onClick={async () => {
                                      if (user) {
                                        await saveHydrationSetting(user.id, hydrationSetting);
                                        toast({ title: "Saved", description: "Hydration settings updated." });
                                      }
                                    }} 
                                    className="w-full mt-4 bg-sky-500 hover:bg-sky-600 text-white"
                                  >
                                    Save Hydration Settings
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </div>
                  )}

                  {activeTab === 'preferences' && (
                    <div>
                      <CardHeader>
                        <CardTitle className="text-2xl font-bold text-foreground">Preferences</CardTitle>
                        <CardDescription>Regional and display settings.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2 max-w-md">
                          <Label className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Timezone</Label>
                          <Popover open={isTzOpen} onOpenChange={setIsTzOpen} modal={true}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" aria-expanded={isTzOpen} className={`w-full justify-between font-normal h-11 ${glassInputClasses}`}>
                                {timezone || "Select timezone..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0 rounded-xl border-none shadow-xl glass-card">
                              <div className="flex flex-col">
                                <Input
                                  placeholder="Search timezone..."
                                  value={tzSearch}
                                  onChange={(e) => setTzSearch(e.target.value)}
                                  className="border-0 border-b border-white/20 rounded-none focus-visible:ring-0 bg-transparent"
                                />
                                <ScrollArea className="h-64">
                                  {filteredTimezones.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">No timezone found.</div>
                                  ) : (
                                    <div className="p-1">
                                      {filteredTimezones.map((tz) => (
                                        <div
                                          key={tz}
                                          onClick={() => {
                                            setTimezone(tz);
                                            setIsTzOpen(false);
                                          }}
                                          className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-primary/10 hover:text-primary ${timezone === tz ? "bg-primary/10 font-medium text-primary" : ""}`}
                                        >
                                          {timezone === tz && (
                                            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                              <Check className="h-4 w-4" />
                                            </span>
                                          )}
                                          {tz}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </ScrollArea>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-8 shadow-lg shadow-primary/20">
                          {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Preferences
                        </Button>
                      </CardContent>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </Card>
          </div>
        </div>
        
        <AlertDialog open={!!pendingTab} onOpenChange={(open) => { if (!open) setPendingTab(null); }}>
          <AlertDialogContent className="glass-card border-white/40 sm:rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes in the current tab. If you switch tabs, these changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl border-white/40 bg-white/20 hover:bg-white/40">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmTabChange} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Discard Changes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

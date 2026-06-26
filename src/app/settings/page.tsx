'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession, saveAuthSession } from '@/lib/auth-mock';
import { getReminders, saveReminder, toggleReminder, getUserTimezone, updateTimezone } from './actions';
import { updateUserSettings } from '@/ai/actions/db-users';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Loader2, Save, KeyRound, MessageCircle, Clock, Target, Check, ChevronsUpDown, ShieldAlert, Activity, Settings2 } from 'lucide-react';
import { User } from '@/lib/types';

const CATEGORIES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

type Tab = 'account' | 'health' | 'notifications' | 'preferences';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('account');

  // Reminders state
  const [reminders, setReminders] = useState<any[]>([]);
  const [savingReminder, setSavingReminder] = useState<string | null>(null);
  const [times, setTimes] = useState<Record<string, string>>({
    Breakfast: '08:00',
    Lunch: '13:00',
    Snack: '16:00',
    Dinner: '20:00'
  });

  // Settings form state
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

  // Timezone Combobox state
  const [tzSearch, setTzSearch] = useState('');
  const [isTzOpen, setIsTzOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const allTimezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch (e) {
      return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata'];
    }
  }, []);

  const filteredTimezones = useMemo(() => {
    if (!tzSearch) return allTimezones;
    return allTimezones.filter(tz => tz.toLowerCase().includes(tzSearch.toLowerCase()));
  }, [allTimezones, tzSearch]);

  useEffect(() => {
    const session = getAuthSession() as any;
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session);
    setTelegramId(session.telegramId || '');
    setTimezone(session.timezone || 'UTC');
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
      
      getUserTimezone(session.id).then((tz) => {
        setTimezone(tz || session.timezone || 'UTC');
        setLoading(false);
      });
    });
  }, [router]);

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

    if (res.success) {
      const updatedUser = { ...user, ...payload, telegramId: telegramId || undefined } as User;
      saveAuthSession(updatedUser as any);
      setUser(updatedUser);
      toast({ title: "Settings Saved", description: "Your profile has been updated successfully!" });
      setNewPassword('');
    } else {
      toast({ variant: "destructive", title: "Error", description: "Could not save settings." });
    }
    setSavingSettings(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  const tabClasses = (tab: Tab) => 
    `w-full justify-start text-left font-medium text-lg px-4 py-6 rounded-2xl transition-all ${activeTab === tab ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/40 text-foreground'}`;

  return (
    <div className="min-h-svh bg-gradient-to-br from-rose-50 via-slate-100 to-emerald-50 dark:from-slate-950 dark:via-rose-950/20 dark:to-emerald-950/20 font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-8">Settings</h1>
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Column: Sidebar Navigation */}
          <div className="w-full md:w-1/4 space-y-3">
            <Button variant="ghost" onClick={() => setActiveTab('account')} className={tabClasses('account')}>
              <ShieldAlert className="mr-3 h-5 w-5" /> Account & Security
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab('health')} className={tabClasses('health')}>
              <Activity className="mr-3 h-5 w-5" /> Health & Biometrics
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab('notifications')} className={tabClasses('notifications')}>
              <Bell className="mr-3 h-5 w-5" /> Notifications
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab('preferences')} className={tabClasses('preferences')}>
              <Settings2 className="mr-3 h-5 w-5" /> Preferences
            </Button>
          </div>

          {/* Right Column: Content Area */}
          <div className="w-full md:w-3/4">
            <Card className="glass-card border-white/60 rounded-3xl overflow-hidden min-h-[500px]">
              
              {activeTab === 'account' && (
                <>
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
                        className="rounded-xl h-12 bg-white/50 dark:bg-black/40" 
                      />
                    </div>
                    <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-8">
                      {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
                    </Button>
                  </CardContent>
                </>
              )}

              {activeTab === 'health' && (
                <>
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold text-foreground">Health & Biometrics</CardTitle>
                    <CardDescription>Configure your daily macro goals and demographic info to improve AI accuracy.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Daily Nutrition Goals</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="calories">Calories (kcal)</Label>
                          <Input id="calories" type="number" placeholder="2000" value={calGoal} onChange={e => setCalGoal(e.target.value)} className="rounded-xl bg-white/50 dark:bg-black/40" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="protein">Protein (g)</Label>
                          <Input id="protein" type="number" placeholder="150" value={proGoal} onChange={e => setProGoal(e.target.value)} className="rounded-xl bg-white/50 dark:bg-black/40" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="carbs">Carbs (g)</Label>
                          <Input id="carbs" type="number" placeholder="250" value={carbGoal} onChange={e => setCarbGoal(e.target.value)} className="rounded-xl bg-white/50 dark:bg-black/40" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fat">Fat (g)</Label>
                          <Input id="fat" type="number" placeholder="65" value={fatGoal} onChange={e => setFatGoal(e.target.value)} className="rounded-xl bg-white/50 dark:bg-black/40" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-primary/10">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Biometrics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="age">Age</Label>
                          <Input id="age" type="number" placeholder="30" value={age} onChange={e => setAge(e.target.value)} className="rounded-xl bg-white/50 dark:bg-black/40" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="weight">Weight (kg)</Label>
                          <Input id="weight" type="number" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} className="rounded-xl bg-white/50 dark:bg-black/40" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="height">Height (cm)</Label>
                          <Input id="height" type="number" placeholder="175" value={height} onChange={e => setHeight(e.target.value)} className="rounded-xl bg-white/50 dark:bg-black/40" />
                        </div>
                        <div className="space-y-2 flex flex-col">
                          <Label className="mb-1">Gender</Label>
                          <select 
                            value={gender} 
                            onChange={e => setGender(e.target.value)}
                            className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-white/50 dark:bg-black/40 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-8">
                      {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Health Data
                    </Button>
                  </CardContent>
                </>
              )}

              {activeTab === 'notifications' && (
                <>
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
                            className="rounded-xl bg-white/50 dark:bg-black/40" 
                          />
                          <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-6">
                            {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Required to receive reminders and log meals via Telegram.</p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-primary/10">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Telegram Reminders</h3>
                      <div className="space-y-4">
                        {CATEGORIES.map((cat) => {
                          const existing = reminders.find(r => r.category === cat);
                          const isActive = existing ? existing.isActive : false;
                          
                          return (
                            <div key={cat} className="p-4 rounded-xl bg-white/30 dark:bg-black/20 border border-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                  className="w-32 bg-white/50 dark:bg-black/40 rounded-xl"
                                />
                                <Button onClick={() => handleSaveReminder(cat)} disabled={savingReminder === cat} variant="secondary" size="icon" className="shrink-0 rounded-xl">
                                  {savingReminder === cat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </>
              )}

              {activeTab === 'preferences' && (
                <>
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold text-foreground">Preferences</CardTitle>
                    <CardDescription>Regional and display settings.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2 max-w-md">
                      <Label className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Timezone</Label>
                      <Popover open={isTzOpen} onOpenChange={setIsTzOpen} modal={true}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={isTzOpen} className="w-full justify-between rounded-xl font-normal bg-white/50 dark:bg-black/40 h-11">
                            {timezone || "Select timezone..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0 rounded-xl border-none shadow-xl">
                          <div className="flex flex-col">
                            <Input
                              placeholder="Search timezone..."
                              value={tzSearch}
                              onChange={(e) => setTzSearch(e.target.value)}
                              className="border-0 border-b rounded-none focus-visible:ring-0"
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
                                      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-primary/10 hover:text-primary ${timezone === tz ? "bg-primary/5 font-medium text-primary" : ""}`}
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
                    <Button onClick={() => handleSaveSettings()} disabled={savingSettings} className="rounded-xl px-8">
                      {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Preferences
                    </Button>
                  </CardContent>
                </>
              )}

            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

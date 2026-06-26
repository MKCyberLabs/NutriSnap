'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, UserCircle, Settings, KeyRound, MessageCircle, Clock, Target, Check, ChevronsUpDown } from 'lucide-react';
import { getAuthSession, clearAuthSession, saveAuthSession } from '@/lib/auth-mock';
import { useEffect, useState, useMemo } from 'react';
import { User } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateUserSettings } from '@/ai/actions/db-users';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<Partial<User & { telegramId?: string | null, timezone?: string, dailyCaloriesGoal?: number, dailyProteinGoal?: number, dailyCarbsGoal?: number, dailyFatGoal?: number }> | null>(null);
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  // Fetch available timezones using Intl API
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
    setUser(session);
    if (session) {
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
    }
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

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
      setIsSettingsOpen(false);
      setNewPassword('');
    } else {
      toast({ variant: "destructive", title: "Error", description: "Could not save settings." });
    }
  };

  if (pathname === '/') return null;

  return (
    <nav className="glass-nav sticky top-0 z-50 w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            N
          </div>
          <span className="text-xl font-bold tracking-tight text-primary">NutriSnap</span>
        </Link>

        <div className="flex items-center gap-4">
          {user?.role === 'ADMIN' && (
            <Link href="/admin">
              <Button variant="ghost" className="hidden md:flex gap-2 rounded-xl">
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[100px] truncate">{user?.name || 'User'}</span>
          </div>
          
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Account Security" className="rounded-full h-10 w-10 border-white/40 hover:bg-white/40 text-primary">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none glass-card p-8 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Account Settings</DialogTitle>
                <DialogDescription>Manage your profile, security, and daily goals.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveSettings} className="space-y-6 py-4">
                
                {/* Security */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Reset Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Enter new password to reset" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="rounded-xl" 
                  />
                </div>
                
                {/* Telegram */}
                <div className="space-y-2 pt-2 border-t border-primary/10">
                  <Label htmlFor="telegram" className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Telegram ID</Label>
                  <Input 
                    id="telegram" 
                    placeholder="e.g. 123456789" 
                    value={telegramId} 
                    onChange={e => setTelegramId(e.target.value)} 
                    className="rounded-xl" 
                  />
                </div>

                {/* Timezone */}
                <div className="space-y-2 pt-2 border-t border-primary/10">
                  <Label className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Timezone</Label>
                  <Popover open={isTzOpen} onOpenChange={setIsTzOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isTzOpen}
                        className="w-full justify-between rounded-xl font-normal"
                      >
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

                {/* Daily Goals */}
                <Accordion type="single" collapsible className="w-full border-t border-primary/10 pt-2">
                  <AccordionItem value="goals" className="border-none">
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Daily Nutrition Goals</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-4 pt-2 pb-1">
                        <div className="space-y-1">
                          <Label htmlFor="calories" className="text-xs">Calories (kcal)</Label>
                          <Input 
                            id="calories" 
                            type="number" 
                            placeholder="2000" 
                            value={calGoal} 
                            onChange={e => setCalGoal(e.target.value)} 
                            className="rounded-lg h-9" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="protein" className="text-xs">Protein (g)</Label>
                          <Input 
                            id="protein" 
                            type="number" 
                            placeholder="150" 
                            value={proGoal} 
                            onChange={e => setProGoal(e.target.value)} 
                            className="rounded-lg h-9" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="carbs" className="text-xs">Carbs (g)</Label>
                          <Input 
                            id="carbs" 
                            type="number" 
                            placeholder="250" 
                            value={carbGoal} 
                            onChange={e => setCarbGoal(e.target.value)} 
                            className="rounded-lg h-9" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="fat" className="text-xs">Fat (g)</Label>
                          <Input 
                            id="fat" 
                            type="number" 
                            placeholder="65" 
                            value={fatGoal} 
                            onChange={e => setFatGoal(e.target.value)} 
                            className="rounded-lg h-9" 
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="biometrics" className="border-none pt-2">
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Biometrics & Demographics</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-4 pt-2 pb-1">
                        <div className="space-y-1">
                          <Label htmlFor="age" className="text-xs">Age</Label>
                          <Input 
                            id="age" 
                            type="number" 
                            placeholder="30" 
                            value={age} 
                            onChange={e => setAge(e.target.value)} 
                            className="rounded-lg h-9" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="weight" className="text-xs">Weight (kg)</Label>
                          <Input 
                            id="weight" 
                            type="number" 
                            placeholder="70" 
                            value={weight} 
                            onChange={e => setWeight(e.target.value)} 
                            className="rounded-lg h-9" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="height" className="text-xs">Height (cm)</Label>
                          <Input 
                            id="height" 
                            type="number" 
                            placeholder="175" 
                            value={height} 
                            onChange={e => setHeight(e.target.value)} 
                            className="rounded-lg h-9" 
                          />
                        </div>
                        <div className="space-y-1 flex flex-col">
                          <Label className="text-xs mb-1">Gender</Label>
                          <select 
                            value={gender} 
                            onChange={e => setGender(e.target.value)}
                            className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <DialogFooter className="pt-4 border-t border-primary/10">
                  <Button type="submit" className="w-full h-11 rounded-xl shadow-lg shadow-primary/20">Save All Changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="icon" aria-label="Log out" onClick={handleLogout} className="rounded-full h-10 w-10 border-white/40 hover:bg-white/40">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

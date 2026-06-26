'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { getReminders, saveReminder, toggleReminder, getUserTimezone, updateTimezone } from './actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bell, Loader2, Save } from 'lucide-react';
import { User } from '@/lib/types';

const CATEGORIES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>('UTC');
  const [savingTz, setSavingTz] = useState(false);

  // Local state for time inputs
  const [times, setTimes] = useState<Record<string, string>>({
    Breakfast: '08:00',
    Lunch: '13:00',
    Snack: '16:00',
    Dinner: '20:00'
  });

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session);
    
    getReminders(session.id).then((data) => {
      setReminders(data);
      const newTimes = { ...times };
      data.forEach(r => {
        newTimes[r.category] = r.time;
      });
      setTimes(newTimes);
      
      getUserTimezone(session.id).then((tz) => {
        setTimezone(tz);
        setLoading(false);
      });
    });
  }, [router]);

  const handleSave = async (category: string) => {
    if (!user) return;
    setSaving(category);
    try {
      const time = times[category];
      const existing = reminders.find(r => r.category === category);
      const isActive = existing ? existing.isActive : true;
      
      await saveReminder(user.id, category, time, isActive);
      
      // Update local state
      const fresh = await getReminders(user.id);
      setReminders(fresh);
      
      toast({ title: 'Saved', description: `${category} reminder set to ${time}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save reminder.' });
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleReminder(id, !currentStatus);
      const fresh = await getReminders(user!.id);
      setReminders(fresh);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to toggle reminder.' });
    }
  };

  const handleSaveTimezone = async () => {
    if (!user) return;
    setSavingTz(true);
    try {
      await updateTimezone(user.id, timezone);
      toast({ title: 'Saved', description: `Timezone updated to ${timezone}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update timezone.' });
    } finally {
      setSavingTz(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-svh bg-gradient-to-br from-rose-50 via-slate-100 to-emerald-50 dark:from-slate-950 dark:via-rose-950/20 dark:to-emerald-950/20 font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl relative z-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-8">Settings</h1>
        
        <Card className="glass-card border-white/60 rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <Bell className="h-6 w-6 text-primary" /> Telegram Reminders
            </CardTitle>
            <CardDescription>
              Set times to receive meal log reminders in Telegram. (Ensure your Telegram account is linked!)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {CATEGORIES.map((cat) => {
              const existing = reminders.find(r => r.category === cat);
              const isActive = existing ? existing.isActive : false;
              
              return (
                <div key={cat} className="p-4 rounded-xl bg-white/30 dark:bg-black/20 border border-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Switch 
                      checked={isActive} 
                      onCheckedChange={() => {
                        if (existing) {
                          handleToggle(existing.id, isActive);
                        } else {
                          handleSave(cat); // Create it first if it doesn't exist
                        }
                      }} 
                    />
                    <div>
                      <h3 className="font-bold text-lg">{cat}</h3>
                      <p className="text-xs text-muted-foreground">{isActive ? 'Active' : 'Disabled'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input 
                      type="time" 
                      value={times[cat]} 
                      onChange={(e) => setTimes({ ...times, [cat]: e.target.value })}
                      className="w-32 bg-white/50 dark:bg-black/40"
                    />
                    <Button 
                      onClick={() => handleSave(cat)}
                      disabled={saving === cat}
                      variant="secondary"
                      size="icon"
                      className="shrink-0"
                    >
                      {saving === cat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="glass-card border-white/60 rounded-3xl overflow-hidden mt-8">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground">
              Regional Settings
            </CardTitle>
            <CardDescription>
              Set your local timezone so reminders and daily goals reset correctly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Input 
                list="timezones"
                value={timezone} 
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York or Asia/Kolkata"
                className="bg-white/50 dark:bg-black/40 flex-1"
              />
              <datalist id="timezones">
                <option value="Africa/Cairo" />
                <option value="Africa/Johannesburg" />
                <option value="Africa/Lagos" />
                <option value="America/Chicago" />
                <option value="America/Denver" />
                <option value="America/Los_Angeles" />
                <option value="America/New_York" />
                <option value="America/Sao_Paulo" />
                <option value="Asia/Bangkok" />
                <option value="Asia/Dubai" />
                <option value="Asia/Hong_Kong" />
                <option value="Asia/Kolkata" />
                <option value="Asia/Riyadh" />
                <option value="Asia/Seoul" />
                <option value="Asia/Shanghai" />
                <option value="Asia/Singapore" />
                <option value="Asia/Tokyo" />
                <option value="Australia/Brisbane" />
                <option value="Australia/Melbourne" />
                <option value="Australia/Perth" />
                <option value="Australia/Sydney" />
                <option value="Europe/Amsterdam" />
                <option value="Europe/Berlin" />
                <option value="Europe/Istanbul" />
                <option value="Europe/London" />
                <option value="Europe/Moscow" />
                <option value="Europe/Paris" />
                <option value="Europe/Rome" />
                <option value="Pacific/Auckland" />
                <option value="Pacific/Honolulu" />
                <option value="UTC" />
              </datalist>
              <Button onClick={handleSaveTimezone} disabled={savingTz} className="shrink-0 w-full sm:w-auto">
                {savingTz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Timezone
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Use standard IANA format (e.g., <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">America/New_York</code>, <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">Europe/London</code>, <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">Asia/Kolkata</code>)
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { SectionCard } from '@/components/design-system/SectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getAuthSession, saveAuthSession } from '@/lib/auth-mock';
import {
  getReminders,
  saveReminder,
  updateTimezone,
  getUserTimezone,
} from '@/app/settings/actions';
import {
  getUserDailyWaterGoal,
  saveUserDailyWaterGoal,
} from '@/app/hydration/actions';
import { updateUserSettings } from '@/ai/actions/db-users';
import {
  User,
  Clock,
  Send,
  Target,
  Info,
  Loader2,
  Check,
  Globe,
} from 'lucide-react';

const MEAL_CATEGORIES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Goals
  const [calGoal, setCalGoal] = useState('2000');
  const [proGoal, setProGoal] = useState('100');
  const [waterGoal, setWaterGoal] = useState('2750');

  // Meal Reminders
  const [reminders, setReminders] = useState<any[]>([]);
  const [times, setTimes] = useState<Record<string, string>>({
    Breakfast: '08:00',
    Lunch: '13:00',
    Snack: '16:00',
    Dinner: '20:00',
  });

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.push('/');
      return;
    }
    if (!session.onboarded) {
      router.push('/onboarding');
      return;
    }
    setCurrentUser(session);
    setName(session.name || '');
    setEmail(session.email || '');
    setTelegramId(session.telegramId || '');

    const uid = session.id;
    Promise.all([
      getReminders(uid).catch(() => []),
      getUserTimezone(uid).catch(() => 'Asia/Kolkata'),
      getUserDailyWaterGoal(uid).catch(() => 2750),
    ]).then(([rems, tz, wGoal]) => {
      setReminders(rems);
      setTimezone(tz || 'Asia/Kolkata');
      setWaterGoal(String(wGoal || 2750));

      const newTimes: Record<string, string> = { ...times };
      rems.forEach((r: any) => {
        if (r.category && (r.time || r.timeOfDay)) {
          newTimes[r.category] = r.time || r.timeOfDay;
        }
      });
      setTimes(newTimes);
      setLoading(false);
    });
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      const updates: any = {
        name,
        telegramId: telegramId.trim() || null,
        dailyCaloriesGoal: parseInt(calGoal, 10) || 2000,
        dailyProteinGoal: parseInt(proGoal, 10) || 100,
      };
      if (newPassword.trim()) {
        updates.password = newPassword.trim();
      }

      await Promise.all([
        updateUserSettings(currentUser.id, updates),
        updateTimezone(currentUser.id, timezone),
        saveUserDailyWaterGoal(currentUser.id, parseInt(waterGoal, 10) || 2750),
      ]);

      const updatedSession = {
        ...currentUser,
        name,
        telegramId: telegramId.trim() || null,
        timezone,
      };
      saveAuthSession(updatedSession);
      setCurrentUser(updatedSession);
      setNewPassword('');

      toast({
        title: 'Settings saved',
        description: 'Your profile, goals and preferences have been updated.',
      });
    } catch (err: any) {
      toast({
        title: 'Error saving settings',
        description: err?.message || 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMealReminder = async (cat: string, active: boolean) => {
    if (!currentUser) return;
    try {
      await saveReminder(currentUser.id, cat, times[cat] || '08:00', active);
      const rems = await getReminders(currentUser.id);
      setReminders(rems);
      toast({
        title: active ? `${cat} reminder on` : `${cat} reminder off`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const handleTimeChange = async (cat: string, newTime: string) => {
    setTimes((prev) => ({ ...prev, [cat]: newTime }));
    if (!currentUser) return;
    const existing = reminders.find((r) => r.category === cat);
    if (existing && existing.isActive) {
      try {
        await saveReminder(currentUser.id, cat, newTime, true);
        const rems = await getReminders(currentUser.id);
        setReminders(rems);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const isReminderActive = (cat: string) => {
    const rem = reminders.find((r) => r.category === cat);
    return rem ? rem.isActive : false;
  };

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Profile preferences, daily targets, meal reminders, and Telegram integration"
      />

      {loading ? (
        <div className="space-y-6">
          <div className="h-40 bg-white rounded-xl border border-[#E5ECE8] animate-pulse" />
          <div className="h-40 bg-white rounded-xl border border-[#E5ECE8] animate-pulse" />
        </div>
      ) : (
        <form onSubmit={handleSaveProfile} className="space-y-6 max-w-4xl">
          {/* Profile & Account Section */}
          <SectionCard
            title="Profile & Identity"
            description="Personal details and regional configuration"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="set-name" className="text-xs font-semibold text-[#344054]">
                  Full Name
                </Label>
                <Input
                  id="set-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-email" className="text-xs font-semibold text-[#344054]">
                  Email Address
                </Label>
                <Input
                  id="set-email"
                  type="email"
                  value={email}
                  disabled
                  className="h-11 rounded-[10px] border-[#E5ECE8] bg-[#F7FAF8] text-sm text-[#667085]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-password" className="text-xs font-semibold text-[#344054]">
                  Change Password (Optional)
                </Label>
                <Input
                  id="set-password"
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-tz" className="text-xs font-semibold text-[#344054]">
                  Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="set-tz" className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl bg-white border border-[#E5ECE8]">
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* Daily Goals Section */}
          <SectionCard
            title="Daily Health Goals"
            description="Targets used to track your nutrition and hydration bars"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="set-cal" className="text-xs font-semibold text-[#344054]">
                  Calories Goal (kcal)
                </Label>
                <Input
                  id="set-cal"
                  type="number"
                  min="500"
                  max="10000"
                  value={calGoal}
                  onChange={(e) => setCalGoal(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] text-sm tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-pro" className="text-xs font-semibold text-[#344054]">
                  Protein Goal (grams)
                </Label>
                <Input
                  id="set-pro"
                  type="number"
                  min="10"
                  max="500"
                  value={proGoal}
                  onChange={(e) => setProGoal(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] text-sm tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-water" className="text-xs font-semibold text-[#344054]">
                  Water Goal (ml)
                </Label>
                <Input
                  id="set-water"
                  type="number"
                  min="500"
                  max="10000"
                  value={waterGoal}
                  onChange={(e) => setWaterGoal(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] text-sm tabular-nums"
                  required
                />
              </div>
            </div>
          </SectionCard>

          {/* Telegram Integration Section */}
          <SectionCard
            title="Telegram Integration"
            description="Receive scheduled hydration & bill reminders, and log expenses via bot"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="set-tg" className="text-xs font-semibold text-[#344054]">
                  Telegram Chat / User ID
                </Label>
                <Input
                  id="set-tg"
                  type="text"
                  placeholder="e.g. 123456789"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7FAF8] border border-[#E5ECE8] text-xs text-[#667085] space-y-1">
                <div className="font-semibold text-[#111827]">How to link Telegram:</div>
                <p>
                  1. Message the NutriSnap bot on Telegram and send <code>/start</code>.
                </p>
                <p>
                  2. Obtain your Chat ID using <code>@userinfobot</code> or bot prompt and enter it above.
                </p>
                <p>
                  3. You can log quick expenses by messaging <code>/expense 250 Food</code> directly to the bot.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Daily Meal Reminders Section */}
          <SectionCard
            title="Daily Meal Reminders"
            description="Configure default notification times for regular daily meals"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MEAL_CATEGORIES.map((cat) => {
                const active = isReminderActive(cat);
                return (
                  <div
                    key={cat}
                    className="p-3.5 rounded-xl border border-[#E5ECE8] bg-white flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#EAF8EF] text-[#16A34A] flex items-center justify-center font-bold text-xs">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#111827]">{cat}</div>
                        <input
                          type="time"
                          value={times[cat] || '08:00'}
                          onChange={(e) => handleTimeChange(cat, e.target.value)}
                          className="text-xs text-[#667085] bg-transparent font-medium border-0 p-0 focus:ring-0 focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <Switch
                      checked={active}
                      onCheckedChange={(checked) => handleToggleMealReminder(cat, checked)}
                      aria-label={`Toggle ${cat} reminder`}
                      className="data-[state=checked]:bg-[#16A34A]"
                    />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="h-11 px-6 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm shadow-xs flex items-center gap-2"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save All Changes</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </AppShell>
  );
}

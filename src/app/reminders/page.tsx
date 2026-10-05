'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { getReminders, saveReminder } from '@/app/settings/actions';
import { getObligations, markObligationPaid } from '@/app/finance/actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  Utensils,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  Plus,
  Loader2,
  Repeat,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';

export default function RemindersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [healthReminders, setHealthReminders] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);

  // Dialog state for adding a health reminder
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('Breakfast');
  const [newTime, setNewTime] = useState('08:00');

  const loadData = useCallback(async (userId: string) => {
    try {
      const [rems, obs] = await Promise.all([
        getReminders(userId),
        getObligations(userId),
      ]);
      setHealthReminders(rems);
      setObligations(obs);
    } catch (err: any) {
      toast({
        title: 'Error loading reminders',
        description: err?.message || 'Could not fetch reminder data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
    loadData(session.id);
  }, [router, loadData]);

  const handleToggleReminder = async (rem: any, nextActive: boolean) => {
    const session = getAuthSession();
    if (!session) return;
    try {
      await saveReminder(session.id, rem.category || rem.title, rem.time || rem.timeOfDay, nextActive);
      toast({
        title: nextActive ? 'Reminder Enabled' : 'Reminder Disabled',
        description: `${rem.category || rem.title} reminder updated.`,
      });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to update reminder',
        variant: 'destructive',
      });
    }
  };

  const handleAddHealthReminder = async () => {
    const session = getAuthSession();
    if (!session) return;
    if (!newTime) {
      toast({ title: 'Validation', description: 'Please select a time', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await saveReminder(session.id, newCategory, newTime, true);
      toast({
        title: 'Reminder Saved',
        description: `Set daily ${newCategory} reminder for ${newTime}.`,
      });
      setReminderDialogOpen(false);
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save reminder',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (obligationId: string, nextDueAt: string) => {
    const session = getAuthSession();
    if (!session) return;
    setSubmitting(true);
    const occurrenceKey = nextDueAt.split('T')[0];
    try {
      await markObligationPaid(session.id, {
        obligationId,
        occurrenceKey,
        createExpense: true,
      });
      toast({
        title: 'Bill Paid',
        description: 'Obligation marked paid and next occurrence scheduled.',
      });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err?.message || 'Failed to mark obligation paid',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/60 pb-24 md:pb-12">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Shared Notification Hub
              </span>
              <Badge variant="outline" className="text-[10px] text-gray-500 py-0">
                Timezone Aware
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
              Reminders & Schedules
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              One unified recurrence engine for your health routines and wealth obligations
            </p>
          </div>

          <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200">
                <Plus className="h-4 w-4" /> Add Health Reminder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] rounded-2xl p-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Add Health Reminder</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold">Reminder Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="rounded-xl mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Breakfast">Breakfast</SelectItem>
                      <SelectItem value="Lunch">Lunch</SelectItem>
                      <SelectItem value="Dinner">Dinner</SelectItem>
                      <SelectItem value="Evening Snack">Evening Snack</SelectItem>
                      <SelectItem value="Hydration Check">Hydration Check</SelectItem>
                      <SelectItem value="Vitamins">Vitamins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Time of Day</Label>
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="rounded-xl mt-1 text-lg font-bold"
                  />
                </div>
                <Button
                  disabled={submitting || !newTime}
                  onClick={handleAddHealthReminder}
                  className="w-full rounded-xl mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Daily Reminder'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs for Health vs Wealth Reminders */}
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList className="bg-gray-100 p-1 rounded-2xl">
            <TabsTrigger value="health" className="rounded-xl text-xs font-semibold data-[state=active]:bg-white">
              Health Reminders ({healthReminders.length})
            </TabsTrigger>
            <TabsTrigger value="wealth" className="rounded-xl text-xs font-semibold data-[state=active]:bg-white">
              Wealth Obligations & Bills ({obligations.length})
            </TabsTrigger>
          </TabsList>

          {/* Health Reminders Tab */}
          <TabsContent value="health" className="space-y-4">
            {healthReminders.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 p-8 text-center bg-transparent">
                <Utensils className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No health reminders configured.</p>
                <p className="text-xs text-gray-400 mt-1">Add daily reminders for meals, snacks, or hydration.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {healthReminders.map((rem) => (
                  <Card key={rem.id} className="rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                        <Utensils className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{rem.category || rem.title}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> Daily at {rem.time || rem.timeOfDay}
                        </p>
                      </div>
                    </div>

                    <Switch
                      checked={rem.isActive}
                      onCheckedChange={(checked) => handleToggleReminder(rem, checked)}
                      aria-label={`Toggle ${rem.category || rem.title} reminder`}
                    />
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Wealth Obligations Tab */}
          <TabsContent value="wealth" className="space-y-4">
            {obligations.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 p-8 text-center bg-transparent">
                <Wallet className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No scheduled bills or obligations.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Schedule recharges, subscriptions, or credit card bills to receive automated reminders.
                </p>
                <Button asChild size="sm" className="rounded-xl mt-3 bg-emerald-600 text-white">
                  <Link href="/finance">Go to Money Hub</Link>
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {obligations.map((ob) => (
                  <Card key={ob.id} className="rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {ob.kind}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {ob.recurrenceType === 'EVERY_N_DAYS' ? `Every ${ob.recurrenceInterval} days` : ob.recurrenceType}
                        </Badge>
                      </div>
                      <p className="font-bold text-gray-900 text-base">{ob.title}</p>
                      {ob.amount && (
                        <p className="text-xl font-black text-gray-900">
                          ₹{parseFloat(ob.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-amber-500" />
                        Next Due: {format(new Date(ob.nextDueAt), 'EEEE, dd MMM yyyy')}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      disabled={submitting}
                      onClick={() => handleMarkPaid(ob.id, ob.nextDueAt)}
                      className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                    >
                      Mark Paid
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

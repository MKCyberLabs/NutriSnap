'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { SegmentedFilter } from '@/components/design-system/SegmentedFilter';
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount } from '@/components/design-system/MoneyAmount';
import { LoadingCard } from '@/components/design-system/LoadingCard';
import { EmptyState } from '@/components/design-system/EmptyState';
import { ErrorState } from '@/components/design-system/ErrorState';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAuthSession } from '@/lib/auth-mock';
import { getReminders, saveReminder, deleteReminder } from '@/app/settings/actions';
import {
  getObligations,
  markObligationPaid,
  revertObligationPayment,
  toggleObligationActive,
} from '@/app/finance/actions';
import {
  Bell,
  Utensils,
  Clock,
  Calendar,
  CheckCircle2,
  Plus,
  Loader2,
  ReceiptText,
  Smartphone,
  CreditCard,
  Building,
  RotateCcw,
  Trash2,
  Pencil,
  Pause,
  Play,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function RemindersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthReminders, setHealthReminders] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('ALL');

  // Dialog state for adding a health reminder
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('Breakfast');
  const [newTime, setNewTime] = useState('08:00');

  // Dialog state for editing a health reminder
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [editCategory, setEditCategory] = useState('Breakfast');
  const [editTime, setEditTime] = useState('08:00');

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [rems, obs] = await Promise.all([
        getReminders(userId),
        getObligations(userId),
      ]);
      setHealthReminders(rems);
      setObligations(obs);
    } catch (err: any) {
      setError(err?.message || 'Could not fetch reminder data.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleStartEdit = (rem: any) => {
    setEditingReminder(rem);
    setEditCategory(rem.category || rem.title);
    setEditTime(rem.time || rem.timeOfDay || '08:00');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    const session = getAuthSession();
    if (!session || !editingReminder) return;
    setSubmitting(true);
    try {
      await saveReminder(session.id, editCategory, editTime, editingReminder.isActive);
      toast({
        title: 'Reminder Updated',
        description: `Updated ${editCategory} reminder to ${editTime}.`,
      });
      setEditDialogOpen(false);
      setEditingReminder(null);
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to update reminder',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHealthReminder = async (rem: any) => {
    const session = getAuthSession();
    if (!session) return;

    setSubmitting(true);
    try {
      await deleteReminder(rem.id);
      toast({
        title: 'Reminder Deleted',
        description: `Removed ${rem.category || rem.title} reminder.`,
      });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to delete reminder',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoPaidObligation = async (obligationId: string) => {
    const session = getAuthSession();
    if (!session) return;
    setSubmitting(true);
    try {
      await revertObligationPayment(session.id, { obligationId });
      toast({
        title: 'Payment Undone',
        description: 'Latest payment reverted. Schedule restored.',
      });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err?.message || 'Could not revert payment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleObligation = async (obligationId: string, currentActive: boolean) => {
    const session = getAuthSession();
    if (!session) return;
    setSubmitting(true);
    try {
      await toggleObligationActive(session.id, obligationId, !currentActive);
      toast({
        title: !currentActive ? 'Obligation Resumed' : 'Obligation Paused',
        description: 'Status updated.',
      });
      await loadData(session.id);
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err?.message || 'Could not toggle obligation',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'RECHARGE':
        return <Smartphone className="h-4 w-4" />;
      case 'CREDIT_CARD':
        return <CreditCard className="h-4 w-4" />;
      case 'RENT':
        return <Building className="h-4 w-4" />;
      default:
        return <ReceiptText className="h-4 w-4" />;
    }
  };

  const activeObligations = obligations.filter((o) => o.isActive && !o.isArchived);

  const filterOptions = [
    { label: 'All', value: 'ALL', count: healthReminders.length + activeObligations.length },
    { label: 'Health', value: 'HEALTH', count: healthReminders.length },
    { label: 'Bills', value: 'BILLS', count: activeObligations.length },
  ];

  const showHealth = filter === 'ALL' || filter === 'HEALTH';
  const showBills = filter === 'ALL' || filter === 'BILLS';

  return (
    <AppShell>
      <PageHeader
        title="Reminders"
        description="Unified schedule for daily health habits and recurring financial obligations"
        action={
          <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-10 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold shadow-xs flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Add Health Reminder</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
              <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
                <DialogTitle className="text-base font-semibold text-[#111827]">
                  Add Daily Health Reminder
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#344054]">
                    Reminder Category
                  </Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                      <SelectItem value="Breakfast">Breakfast</SelectItem>
                      <SelectItem value="Lunch">Lunch</SelectItem>
                      <SelectItem value="Dinner">Dinner</SelectItem>
                      <SelectItem value="Evening Snack">Evening Snack</SelectItem>
                      <SelectItem value="Hydration Check">Hydration Check</SelectItem>
                      <SelectItem value="Vitamins">Vitamins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rem-time" className="text-xs font-semibold text-[#344054]">
                    Time of Day
                  </Label>
                  <Input
                    id="rem-time"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="h-11 rounded-[10px] border-[#E5ECE8] text-base font-semibold"
                  />
                </div>
                <Button
                  disabled={submitting || !newTime}
                  onClick={handleAddHealthReminder}
                  className="w-full h-11 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Reminder'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {error ? (
        <ErrorState
          title="Could not load reminders"
          message={error}
          onRetry={() => {
            const session = getAuthSession();
            if (session) loadData(session.id);
          }}
          className="my-8"
        />
      ) : loading ? (
        <div className="space-y-4">
          <LoadingCard height="60px" lines={1} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} height="120px" lines={3} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filter Chips */}
          <SegmentedFilter
            options={filterOptions}
            selected={filter}
            onChange={setFilter}
            size="md"
          />

          {/* Health Reminders Section */}
          {showHealth && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#111827]">
                  Health &amp; Nutrition Reminders
                </h2>
                <span className="text-xs text-[#667085]">
                  {healthReminders.length} scheduled
                </span>
              </div>

              {healthReminders.length === 0 ? (
                <EmptyState
                  icon={<Utensils className="h-5 w-5" />}
                  title="No health reminders configured"
                  description="Set daily reminders for meals, snacks, or hydration checks."
                  className="py-8 bg-white"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {healthReminders.map((rem) => (
                    <div
                      key={rem.id}
                      className="rounded-[14px] border border-[#E5ECE8] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] flex items-center justify-between gap-3 hover:border-[#16A34A]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-[#EAF8EF] text-[#16A34A] flex items-center justify-center shrink-0">
                          <Utensils className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#111827] truncate">
                            {rem.category || rem.title}
                          </div>
                          <div className="text-xs text-[#667085] flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>Daily at {rem.time || rem.timeOfDay}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(rem)}
                          className="h-8 w-8 p-0 rounded-lg text-[#667085] hover:text-[#16A34A] hover:bg-[#F0F5F2]"
                          title="Edit reminder"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC]"
                              title="Delete reminder"
                              aria-label="Delete reminder"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[18px] border-none">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Reminder?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this {rem.category || rem.title} reminder? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-[10px]">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteHealthReminder(rem)}
                                className="rounded-[10px] bg-red-600 text-white hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Switch
                          checked={rem.isActive}
                          onCheckedChange={(checked) => handleToggleReminder(rem, checked)}
                          aria-label={`Toggle ${rem.category || rem.title} reminder`}
                          className="data-[state=checked]:bg-[#16A34A]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bills & Wealth Reminders Section */}
          {showBills && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#111827]">
                  Wealth &amp; Bill Obligations
                </h2>
                <Link
                  href="/finance/bills"
                  className="text-xs font-semibold text-[#16A34A] hover:text-[#0F7A38]"
                >
                  Manage bills →
                </Link>
              </div>

              {activeObligations.length === 0 ? (
                <EmptyState
                  icon={<ReceiptText className="h-5 w-5" />}
                  title="No bills scheduled"
                  description="Schedule mobile recharges, utility bills, or credit card dues to get notified."
                  className="py-8 bg-white"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {activeObligations.map((ob) => {
                    let d: Date;
                    try {
                      d = typeof ob.nextDueAt === 'string' ? parseISO(ob.nextDueAt) : ob.nextDueAt;
                    } catch {
                      d = new Date();
                    }
                    const isPast = d.getTime() < Date.now();
                    const relativeText = formatDistanceToNow(d, { addSuffix: true });

                    return (
                      <div
                        key={ob.id}
                        className="rounded-[14px] border border-[#E5ECE8] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] flex flex-col justify-between gap-3 hover:border-[#F59E0B]/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-[#FFF4DF] text-[#F59E0B] flex items-center justify-center shrink-0">
                              {getKindIcon(ob.kind)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#111827] truncate">
                                {ob.title}
                              </div>
                              <div className="text-xs text-[#667085] flex items-center gap-1 mt-0.5">
                                <Calendar className="h-3 w-3" />
                                <span>Due {format(d, 'dd MMM yyyy')}</span>
                              </div>
                            </div>
                          </div>
                          <StatusPill
                            label={isPast ? 'Overdue' : relativeText}
                            tone={isPast ? 'red' : 'amber'}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#E5ECE8]/60">
                          <div>
                            <MoneyAmount
                              amount={ob.amount}
                              type="NEUTRAL"
                              size="sm"
                            />
                            <div className="text-[10px] text-[#667085]">
                              {ob.recurrenceType === 'EVERY_N_DAYS'
                                ? `Every ${ob.recurrenceInterval}d`
                                : ob.recurrenceType}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={submitting}
                              onClick={() => handleToggleObligation(ob.id, ob.isActive)}
                              className="h-8 w-8 p-0 rounded-lg text-[#667085] hover:text-[#344054] hover:bg-[#F0F5F2]"
                              title={ob.isActive ? 'Pause bill reminder' : 'Resume bill reminder'}
                            >
                              {ob.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>

                            {ob.lastCompletedAt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={submitting}
                                onClick={() => handleUndoPaidObligation(ob.id)}
                                className="h-8 px-2 rounded-lg text-[11px] font-semibold text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC] flex items-center gap-1"
                                title="Undo last payment"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Undo</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              disabled={submitting}
                              onClick={() => handleMarkPaid(ob.id, ob.nextDueAt)}
                              className="h-8 px-3 rounded-lg bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Paid</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Health Reminder Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
          <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
            <DialogTitle className="text-base font-semibold text-[#111827]">
              Edit Health Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#344054]">
                Reminder Category
              </Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                  <SelectItem value="Breakfast">Breakfast</SelectItem>
                  <SelectItem value="Lunch">Lunch</SelectItem>
                  <SelectItem value="Dinner">Dinner</SelectItem>
                  <SelectItem value="Evening Snack">Evening Snack</SelectItem>
                  <SelectItem value="Hydration Check">Hydration Check</SelectItem>
                  <SelectItem value="Vitamins">Vitamins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-rem-time" className="text-xs font-semibold text-[#344054]">
                Time of Day
              </Label>
              <Input
                id="edit-rem-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="h-11 rounded-[10px] border-[#E5ECE8] text-base font-semibold"
              />
            </div>
            <Button
              disabled={submitting || !editTime}
              onClick={handleSaveEdit}
              className="w-full h-11 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Update Reminder'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

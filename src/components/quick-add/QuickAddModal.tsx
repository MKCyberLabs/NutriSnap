'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getAuthSession } from '@/lib/auth-mock';
import { logHydration } from '@/app/hydration/actions';
import { recordTransaction, getAccounts } from '@/app/finance/actions';
import { saveReminder } from '@/app/settings/actions';
import { Plus, Utensils, Droplets, ArrowDownRight, ArrowUpRight, Bell, Loader2 } from 'lucide-react';
import { TRANSACTION_CATEGORIES } from '@/lib/finance/finance';

interface QuickAddModalProps {
  children?: React.ReactNode;
  defaultTab?: 'food' | 'water' | 'expense' | 'income' | 'reminder';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickAddModal({
  children,
  defaultTab = 'food',
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: QuickAddModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Water state
  const [waterAmount, setWaterAmount] = useState<number>(250);

  // Expense / Income state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');

  // Reminder state
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('12:00');
  const [reminderCategory, setReminderCategory] = useState('Lunch');

  useEffect(() => {
    if (open) {
      const user = getAuthSession();
      if (user) {
        getAccounts(user.id).then((accs) => {
          setAccounts(accs);
          if (accs.length > 0 && !accountId) {
            setAccountId(accs[0].id);
          }
        }).catch(() => {});
      }
    }
  }, [open, accountId]);

  const handleLogWater = async (amt: number) => {
    const user = getAuthSession();
    if (!user) return;
    setLoading(true);
    try {
      await logHydration(user.id, amt, 'Water');
      toast({ title: 'Water Logged', description: `Added ${amt}ml of water.` });
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to log water', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordTransaction = async (type: 'EXPENSE' | 'INCOME') => {
    const user = getAuthSession();
    if (!user) return;
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid positive amount', variant: 'destructive' });
      return;
    }
    if (!accountId) {
      toast({ title: 'Validation Error', description: 'Please select an account', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await recordTransaction(user.id, {
        type,
        amount,
        category: category || (type === 'EXPENSE' ? 'Other' : 'Salary'),
        accountId,
        occurredAt: new Date(),
        note: note || undefined,
      });

      toast({
        title: `${type === 'EXPENSE' ? 'Expense' : 'Income'} Recorded`,
        description: `Successfully recorded ₹${amount} in ${category}.`
      });
      setAmount('');
      setNote('');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to record transaction', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async () => {
    const user = getAuthSession();
    if (!user) return;
    if (!reminderTime) {
      toast({ title: 'Validation Error', description: 'Please provide a reminder time', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await saveReminder(user.id, reminderTitle || reminderCategory, reminderTime, true);
      toast({ title: 'Reminder Saved', description: `Reminder set for ${reminderTime}.` });
      setReminderTitle('');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save reminder', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[440px] max-w-[95vw] rounded-2xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Quick Add
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-gray-100 rounded-xl mb-4">
            <TabsTrigger value="food" className="py-2 text-xs flex flex-col gap-1 items-center rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Utensils className="h-4 w-4" />
              <span>Food</span>
            </TabsTrigger>
            <TabsTrigger value="water" className="py-2 text-xs flex flex-col gap-1 items-center rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Droplets className="h-4 w-4 text-sky-500" />
              <span>Water</span>
            </TabsTrigger>
            <TabsTrigger value="expense" className="py-2 text-xs flex flex-col gap-1 items-center rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              <span>Expense</span>
            </TabsTrigger>
            <TabsTrigger value="income" className="py-2 text-xs flex flex-col gap-1 items-center rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <span>Income</span>
            </TabsTrigger>
            <TabsTrigger value="reminder" className="py-2 text-xs flex flex-col gap-1 items-center rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Bell className="h-4 w-4 text-amber-500" />
              <span>Remind</span>
            </TabsTrigger>
          </TabsList>

          {/* FOOD TAB */}
          <TabsContent value="food" className="space-y-4 pt-2">
            <p className="text-sm text-gray-500">
              Log a meal or analyze food items using our AI nutrition camera.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full h-12 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
                onClick={() => {
                  setOpen(false);
                  router.push('/dashboard');
                }}
              >
                <Utensils className="h-4 w-4" />
                Open Meal Logger / Camera
              </Button>
            </div>
          </TabsContent>

          {/* WATER TAB */}
          <TabsContent value="water" className="space-y-4 pt-2">
            <p className="text-sm text-gray-500">Quickly log water intake:</p>
            <div className="grid grid-cols-3 gap-2">
              {[250, 500, 750].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  disabled={loading}
                  className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 border-sky-200 hover:bg-sky-50"
                  onClick={() => handleLogWater(amt)}
                >
                  <Droplets className="h-4 w-4 text-sky-500" />
                  <span className="font-bold text-sky-700">{amt} ml</span>
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Input
                type="number"
                min="50"
                step="50"
                placeholder="Custom ml (e.g. 350)"
                value={waterAmount || ''}
                onChange={(e) => setWaterAmount(parseInt(e.target.value) || 0)}
                className="rounded-xl"
              />
              <Button
                disabled={loading || waterAmount <= 0}
                className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white shrink-0"
                onClick={() => handleLogWater(waterAmount)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log'}
              </Button>
            </div>
          </TabsContent>

          {/* EXPENSE TAB */}
          <TabsContent value="expense" className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-600">Amount (₹)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 450.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl text-lg font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-600">Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">Note (Optional)</Label>
              <Input
                placeholder="What was this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <Button
              disabled={loading || !amount}
              className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white mt-2"
              onClick={() => handleRecordTransaction('EXPENSE')}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record Expense'}
            </Button>
          </TabsContent>

          {/* INCOME TAB */}
          <TabsContent value="income" className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-600">Amount (₹)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 5000.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl text-lg font-bold text-emerald-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                    <SelectItem value="Investment">Investment</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-600">Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">Note (Optional)</Label>
              <Input
                placeholder="Source description"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <Button
              disabled={loading || !amount}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
              onClick={() => handleRecordTransaction('INCOME')}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record Income'}
            </Button>
          </TabsContent>

          {/* REMINDER TAB */}
          <TabsContent value="reminder" className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-600">Reminder Title</Label>
              <Input
                placeholder="e.g. Afternoon Snack / Vitamin"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Category</Label>
                <Select value={reminderCategory} onValueChange={setReminderCategory}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Breakfast">Breakfast</SelectItem>
                    <SelectItem value="Lunch">Lunch</SelectItem>
                    <SelectItem value="Snack">Snack</SelectItem>
                    <SelectItem value="Dinner">Dinner</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-600">Time (HH:mm)</Label>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <Button
              disabled={loading || !reminderTime}
              className="w-full rounded-xl bg-primary text-white mt-2"
              onClick={handleCreateReminder}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set Daily Reminder'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import {
  getAccounts,
  getTransactions,
  getMonthlyFinanceSummary,
  getObligations,
  createAccount,
  recordTransaction,
  deleteTransaction,
  createObligation,
  markObligationPaid,
} from './actions';
import {
  TRANSACTION_CATEGORIES,
  OBLIGATION_KINDS,
  ACCOUNT_TYPES,
  AccountType,
  TransactionType,
  ObligationKind,
} from '@/lib/finance/finance';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Building,
  CreditCard,
  Banknote,
  Repeat,
  Loader2,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';

export default function FinancePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    income: string;
    expense: string;
    totalBalance: string;
  }>({ income: '0', expense: '0', totalBalance: '0' });

  // Dialogs
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [obligationDialogOpen, setObligationDialogOpen] = useState(false);

  // Form states - Account
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('BANK');
  const [accInstitution, setAccInstitution] = useState('');
  const [accOpeningBalance, setAccOpeningBalance] = useState('0');
  const [accCreditLimit, setAccCreditLimit] = useState('');

  // Form states - Transaction
  const [txType, setTxType] = useState<TransactionType>('EXPENSE');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Food');
  const [txAccountId, setTxAccountId] = useState('');
  const [txTransferAccountId, setTxTransferAccountId] = useState('');
  const [txNote, setTxNote] = useState('');

  // Form states - Obligation
  const [obTitle, setObTitle] = useState('');
  const [obKind, setObKind] = useState<ObligationKind>('BILL');
  const [obAmount, setObAmount] = useState('');
  const [obDueAt, setObDueAt] = useState('');
  const [obRecurrence, setObRecurrence] = useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EVERY_N_DAYS'>('MONTHLY');
  const [obInterval, setObInterval] = useState('1');
  const [obAccountId, setObAccountId] = useState('');

  const loadData = useCallback(async (userId: string) => {
    try {
      const [accs, txs, obs, sum] = await Promise.all([
        getAccounts(userId),
        getTransactions(userId, { limit: 50 }),
        getObligations(userId),
        getMonthlyFinanceSummary(userId, new Date()),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      setObligations(obs);
      setSummary(sum);
      if (accs.length > 0 && !txAccountId) {
        setTxAccountId(accs[0].id);
      }
    } catch (err: any) {
      toast({
        title: 'Error loading finance data',
        description: err?.message || 'Could not fetch records',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, txAccountId]);

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

  // Handlers
  const handleCreateAccount = async () => {
    const session = getAuthSession();
    if (!session) return;
    if (!accName.trim()) {
      toast({ title: 'Validation', description: 'Account name is required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createAccount(session.id, {
        name: accName.trim(),
        type: accType,
        institution: accInstitution.trim() || null,
        openingBalance: accOpeningBalance || '0',
        creditLimit: accCreditLimit ? accCreditLimit : null,
      });
      toast({ title: 'Account Created', description: `Created account "${accName}".` });
      setAccountDialogOpen(false);
      setAccName('');
      setAccInstitution('');
      setAccOpeningBalance('0');
      setAccCreditLimit('');
      await loadData(session.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to create account', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordTransaction = async () => {
    const session = getAuthSession();
    if (!session) return;
    if (!txAmount || parseFloat(txAmount) <= 0) {
      toast({ title: 'Validation', description: 'Amount must be positive', variant: 'destructive' });
      return;
    }
    if (!txAccountId) {
      toast({ title: 'Validation', description: 'Source account is required', variant: 'destructive' });
      return;
    }
    if (txType === 'TRANSFER' && (!txTransferAccountId || txTransferAccountId === txAccountId)) {
      toast({ title: 'Validation', description: 'Select a different destination account for transfer', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await recordTransaction(session.id, {
        type: txType,
        amount: txAmount,
        category: txType === 'TRANSFER' ? 'Transfer' : txCategory,
        accountId: txAccountId,
        transferAccountId: txType === 'TRANSFER' ? txTransferAccountId : null,
        occurredAt: new Date(),
        note: txNote.trim() || null,
      });
      toast({ title: 'Transaction Recorded', description: `Recorded ${txType.toLowerCase()} of ₹${txAmount}.` });
      setTxDialogOpen(false);
      setTxAmount('');
      setTxNote('');
      await loadData(session.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to record transaction', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    const session = getAuthSession();
    if (!session) return;
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteTransaction(session.id, txId);
      toast({ title: 'Deleted', description: 'Transaction removed.' });
      await loadData(session.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to delete transaction', variant: 'destructive' });
    }
  };

  const handleCreateObligation = async () => {
    const session = getAuthSession();
    if (!session) return;
    if (!obTitle.trim() || !obDueAt) {
      toast({ title: 'Validation', description: 'Title and due date are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createObligation(session.id, {
        title: obTitle.trim(),
        kind: obKind,
        amount: obAmount ? obAmount : null,
        dueAt: new Date(obDueAt),
        recurrenceType: obRecurrence,
        recurrenceInterval: obRecurrence === 'EVERY_N_DAYS' ? parseInt(obInterval) || 28 : undefined,
        accountId: obAccountId || null,
      });
      toast({ title: 'Obligation Scheduled', description: `Scheduled "${obTitle}".` });
      setObligationDialogOpen(false);
      setObTitle('');
      setObAmount('');
      setObDueAt('');
      await loadData(session.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to schedule obligation', variant: 'destructive' });
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
      toast({ title: 'Paid', description: 'Obligation marked paid.' });
      await loadData(session.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to mark paid', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'BANK': return <Building className="h-4 w-4 text-blue-600" />;
      case 'CREDIT_CARD': return <CreditCard className="h-4 w-4 text-purple-600" />;
      case 'WALLET': return <Wallet className="h-4 w-4 text-amber-600" />;
      case 'CASH': return <Banknote className="h-4 w-4 text-emerald-600" />;
      default: return <Wallet className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/60 pb-24 md:pb-12">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Summary */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Wealth Management
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
              Money & Accounts
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Strict Decimal accounting with zero Float precision drift
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center sm:text-left">
            <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-100">
              <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Total Balance</p>
              <p className="text-lg sm:text-xl font-black text-emerald-950 mt-0.5">
                ₹{parseFloat(summary.totalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Income (Mo)</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-600 mt-0.5">
                +₹{parseFloat(summary.income).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Expense (Mo)</p>
              <p className="text-lg sm:text-xl font-bold text-rose-600 mt-0.5">
                -₹{parseFloat(summary.expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl gap-1.5 bg-gray-900 hover:bg-black text-white font-medium">
                  <Plus className="h-4 w-4" /> Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">Create Financial Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs font-semibold">Account Name</Label>
                    <Input
                      placeholder="e.g. HDFC Salary, ICICI Amazon Pay, Cash Wallet"
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Account Type</Label>
                      <Select value={accType} onValueChange={(v: AccountType) => setAccType(v)}>
                        <SelectTrigger className="rounded-xl mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Institution (Optional)</Label>
                      <Input
                        placeholder="e.g. HDFC Bank"
                        value={accInstitution}
                        onChange={(e) => setAccInstitution(e.target.value)}
                        className="rounded-xl mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Opening Balance (₹)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={accOpeningBalance}
                        onChange={(e) => setAccOpeningBalance(e.target.value)}
                        className="rounded-xl mt-1 font-semibold"
                      />
                    </div>
                    {accType === 'CREDIT_CARD' && (
                      <div>
                        <Label className="text-xs font-semibold">Credit Limit (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 100000"
                          value={accCreditLimit}
                          onChange={(e) => setAccCreditLimit(e.target.value)}
                          className="rounded-xl mt-1"
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    disabled={submitting || !accName.trim()}
                    onClick={handleCreateAccount}
                    className="w-full rounded-xl mt-2 bg-primary text-white"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                  <Plus className="h-4 w-4" /> Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">Record Transaction</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl">
                    <Button
                      type="button"
                      variant={txType === 'EXPENSE' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTxType('EXPENSE')}
                      className="rounded-lg text-xs font-semibold"
                    >
                      Expense
                    </Button>
                    <Button
                      type="button"
                      variant={txType === 'INCOME' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTxType('INCOME')}
                      className="rounded-lg text-xs font-semibold"
                    >
                      Income
                    </Button>
                    <Button
                      type="button"
                      variant={txType === 'TRANSFER' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTxType('TRANSFER')}
                      className="rounded-lg text-xs font-semibold"
                    >
                      Transfer
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Amount (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="rounded-xl mt-1 text-lg font-bold"
                    />
                  </div>

                  {txType !== 'TRANSFER' ? (
                    <div>
                      <Label className="text-xs font-semibold">Category</Label>
                      <Select value={txCategory} onValueChange={setTxCategory}>
                        <SelectTrigger className="rounded-xl mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSACTION_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div>
                    <Label className="text-xs font-semibold">
                      {txType === 'TRANSFER' ? 'From Account' : 'Account'}
                    </Label>
                    <Select value={txAccountId} onValueChange={setTxAccountId}>
                      <SelectTrigger className="rounded-xl mt-1">
                        <SelectValue placeholder="Select Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {txType === 'TRANSFER' && (
                    <div>
                      <Label className="text-xs font-semibold">To Destination Account</Label>
                      <Select value={txTransferAccountId} onValueChange={setTxTransferAccountId}>
                        <SelectTrigger className="rounded-xl mt-1">
                          <SelectValue placeholder="Select Destination" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.filter((a) => a.id !== txAccountId).map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-semibold">Note (Optional)</Label>
                    <Input
                      placeholder="Details"
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                      className="rounded-xl mt-1"
                    />
                  </div>

                  <Button
                    disabled={submitting || !txAmount}
                    onClick={handleRecordTransaction}
                    className="w-full rounded-xl mt-2 bg-primary text-white"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Transaction'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={obligationDialogOpen} onOpenChange={setObligationDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5 font-medium">
                  <Clock className="h-4 w-4" /> Schedule Bill / Recharge
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">Schedule Obligation</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs font-semibold">Title</Label>
                    <Input
                      placeholder="e.g. Airtel Fiber, Jio 84-day recharge, Rent"
                      value={obTitle}
                      onChange={(e) => setObTitle(e.target.value)}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Kind</Label>
                      <Select value={obKind} onValueChange={(v: ObligationKind) => setObKind(v)}>
                        <SelectTrigger className="rounded-xl mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OBLIGATION_KINDS.map((k) => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Amount (₹, optional)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 719"
                        value={obAmount}
                        onChange={(e) => setObAmount(e.target.value)}
                        className="rounded-xl mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Due Date</Label>
                      <Input
                        type="date"
                        value={obDueAt}
                        onChange={(e) => setObDueAt(e.target.value)}
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Recurrence</Label>
                      <Select value={obRecurrence} onValueChange={(v: any) => setObRecurrence(v)}>
                        <SelectTrigger className="rounded-xl mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ONCE">Once</SelectItem>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="EVERY_N_DAYS">Every N Days</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                          <SelectItem value="DAILY">Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {obRecurrence === 'EVERY_N_DAYS' && (
                    <div>
                      <Label className="text-xs font-semibold">Interval Days (e.g. 28, 56, 84)</Label>
                      <Input
                        type="number"
                        placeholder="84"
                        value={obInterval}
                        onChange={(e) => setObInterval(e.target.value)}
                        className="rounded-xl mt-1 font-bold"
                      />
                    </div>
                  )}
                  <Button
                    disabled={submitting || !obTitle.trim() || !obDueAt}
                    onClick={handleCreateObligation}
                    className="w-full rounded-xl mt-2 bg-primary text-white"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule Obligation'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="bg-gray-100 p-1 rounded-2xl">
            <TabsTrigger value="transactions" className="rounded-xl text-xs font-semibold data-[state=active]:bg-white">
              Transactions ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="accounts" className="rounded-xl text-xs font-semibold data-[state=active]:bg-white">
              Accounts ({accounts.length})
            </TabsTrigger>
            <TabsTrigger value="obligations" className="rounded-xl text-xs font-semibold data-[state=active]:bg-white">
              Scheduled Obligations ({obligations.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Transactions */}
          <TabsContent value="transactions" className="space-y-3">
            {transactions.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 p-8 text-center bg-transparent">
                <p className="text-sm font-semibold text-gray-700">No transactions recorded yet.</p>
                <p className="text-xs text-gray-400 mt-1">Record your first expense, income, or account transfer.</p>
              </Card>
            ) : (
              <Card className="rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold ${
                          tx.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' :
                          tx.type === 'EXPENSE' ? 'bg-rose-100 text-rose-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {tx.type === 'INCOME' ? <ArrowUpRight className="h-4 w-4" /> :
                           tx.type === 'EXPENSE' ? <ArrowDownRight className="h-4 w-4" /> :
                           <ArrowLeftRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{tx.category}</span>
                            <Badge variant="outline" className="text-[10px] py-0">
                              {tx.account?.name || 'Account'}
                            </Badge>
                            {tx.transferAccount && (
                              <span className="text-[10px] text-gray-500">
                                → {tx.transferAccount.name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            {format(new Date(tx.occurredAt), 'dd MMM yyyy, HH:mm')}
                            {tx.note ? ` • ${tx.note}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-base font-extrabold ${
                          tx.type === 'INCOME' ? 'text-emerald-600' :
                          tx.type === 'EXPENSE' ? 'text-rose-600' :
                          'text-blue-600'
                        }`}>
                          {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '-' : ''}
                          ₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Accounts */}
          <TabsContent value="accounts" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <Card key={acc.id} className="rounded-3xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                        {getAccountIcon(acc.type)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{acc.name}</p>
                        <p className="text-[11px] text-gray-400">{acc.institution || acc.type}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {acc.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Current Balance</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-0.5">
                      ₹{parseFloat(acc.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    {acc.creditLimit && (
                      <p className="text-[11px] text-purple-600 mt-0.5">
                        Credit Limit: ₹{parseFloat(acc.creditLimit).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab 3: Obligations */}
          <TabsContent value="obligations" className="space-y-3">
            {obligations.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 p-8 text-center bg-transparent">
                <p className="text-sm font-semibold text-gray-700">No scheduled obligations or bills.</p>
                <p className="text-xs text-gray-400 mt-1">Schedule recurring mobile recharges, utility bills, or subscriptions.</p>
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
                          {ob.recurrenceType === 'EVERY_N_DAYS' ? `Every ${ob.recurrenceInterval}d` : ob.recurrenceType}
                        </Badge>
                      </div>
                      <p className="font-bold text-gray-900 text-base">{ob.title}</p>
                      {ob.amount && (
                        <p className="text-lg font-black text-gray-900">
                          ₹{parseFloat(ob.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-amber-500" /> Next Due: {format(new Date(ob.nextDueAt), 'dd MMM yyyy')}
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

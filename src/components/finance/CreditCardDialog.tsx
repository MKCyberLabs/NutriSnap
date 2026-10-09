'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { StatusPill } from '@/components/design-system/StatusPill';
import { MoneyAmount, formatIndianRupees } from '@/components/design-system/MoneyAmount';
import {
  getCreditCardDetails,
  createCreditCardStatement,
  recordCreditCardPayment,
  revertCreditCardPayment,
} from '@/app/finance/actions';
import { getAuthSession } from '@/lib/auth-mock';
import { CreditCard, Plus, RotateCcw, Calendar, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface CreditCardDialogProps {
  account: {
    id: string;
    name: string;
    type: string;
    creditLimit?: string | number | null;
    currentBalance: string | number;
    defaultPaymentAccountId?: string | null;
  };
  accounts: { id: string; name: string; type: string }[];
  trigger?: React.ReactNode;
  onRefresh?: () => void;
}

export function generateRepaymentIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `cc-repay-${crypto.randomUUID()}`;
  }
  return `cc-repay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function isEligiblePayerAccount(
  candidate: { id: string; type?: string | null },
  targetAccountId: string
): boolean {
  return candidate.id !== targetAccountId && candidate.type !== 'CREDIT_CARD';
}

export function CreditCardDialog({
  account,
  accounts,
  trigger,
  onRefresh,
}: CreditCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // New Statement Form State
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [newPeriodKey, setNewPeriodKey] = useState(format(new Date(), 'yyyy-MM'));
  const [newStatementAmount, setNewStatementAmount] = useState('');
  const [newMinimumDue, setNewMinimumDue] = useState('');
  const [newStatementDate, setNewStatementDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newDueDate, setNewDueDate] = useState(
    format(new Date(Date.now() + 20 * 86400000), 'yyyy-MM-dd')
  );


  // Record Payment Form State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const isEligiblePayer = (a: any) => a.id !== account.id && a.type !== 'CREDIT_CARD';
  const payerAccounts = (accounts || []).filter(isEligiblePayer);

  const [selectedFromAccountId, setSelectedFromAccountId] = useState<string>(() => {
    const defaultId =
      cardData?.account?.defaultPaymentAccountId ||
      cardData?.defaultPaymentAccount?.id ||
      account.defaultPaymentAccountId;
    if (defaultId && payerAccounts.some((a) => a.id === defaultId)) {
      return defaultId;
    }
    return payerAccounts[0]?.id || '';
  });
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string>('');

  useEffect(() => {
    const defaultId =
      cardData?.account?.defaultPaymentAccountId ||
      cardData?.defaultPaymentAccount?.id ||
      account.defaultPaymentAccountId;
    if (defaultId && payerAccounts.some((a) => a.id === defaultId)) {
      setSelectedFromAccountId(defaultId);
    } else {
      setSelectedFromAccountId((current: string) =>
        payerAccounts.some((a) => a.id === current) ? current : (payerAccounts[0]?.id || '')
      );
    }
  }, [
    cardData?.account?.defaultPaymentAccountId,
    cardData?.defaultPaymentAccount?.id,
    account.defaultPaymentAccountId,
    payerAccounts,
  ]);

  const loadDetails = useCallback(async () => {
    const session = getAuthSession();
    if (!session) return;
    setLoading(true);
    try {
      const details = await getCreditCardDetails(session.id, account.id);
      setCardData(details);
      const defaultId =
        (details as any)?.account?.defaultPaymentAccountId ||
        details?.defaultPaymentAccount?.id ||
        account.defaultPaymentAccountId;
      if (defaultId && payerAccounts.some((a) => a.id === defaultId)) {
        setSelectedFromAccountId(defaultId);
      } else {
        setSelectedFromAccountId((current: string) =>
          payerAccounts.some((a) => a.id === current) ? current : (payerAccounts[0]?.id || '')
        );
      }
    } catch (err: any) {
      toast({
        title: 'Error loading credit card',
        description: err?.message || 'Could not fetch statement details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [account.id, account.defaultPaymentAccountId, payerAccounts, toast]);

  useEffect(() => {
    if (open) {
      loadDetails();
    }
  }, [open, loadDetails]);

  const handleCreateStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = getAuthSession();
    if (!session) return;
    if (!newStatementAmount || parseFloat(newStatementAmount) <= 0) {
      toast({ title: 'Validation', description: 'Statement amount must be greater than 0', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      await createCreditCardStatement(session.id, {
        accountId: account.id,
        periodKey: newPeriodKey,
        statementDate: newStatementDate,
        dueDate: newDueDate,
        statementAmount: parseFloat(newStatementAmount).toFixed(2),
        minimumDue: newMinimumDue ? parseFloat(newMinimumDue).toFixed(2) : undefined,
      });

      toast({
        title: 'Statement Created',
        description: `Statement for ${newPeriodKey} added with ₹${formatIndianRupees(newStatementAmount)}.`,
      });
      setStatementModalOpen(false);
      setNewStatementAmount('');
      setNewMinimumDue('');
      await loadDetails();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({
        title: 'Error creating statement',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = getAuthSession();
    if (!session || !cardData?.activeStatement) return;
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast({ title: 'Validation', description: 'Payment amount must be greater than 0', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = paymentIdempotencyKey || generateRepaymentIdempotencyKey();
      if (!paymentIdempotencyKey) {
        setPaymentIdempotencyKey(idempotencyKey);
      }

      await recordCreditCardPayment(session.id, {
        statementId: cardData.activeStatement.id,
        fromAccountId: selectedFromAccountId,
        amount: parseFloat(payAmount).toFixed(2),
        note: paymentNote.trim() || undefined,
        idempotencyKey,
      });

      toast({
        title: 'Payment Recorded',
        description: `Paid ₹${formatIndianRupees(payAmount)} towards card statement.`,
      });
      setPaymentModalOpen(false);
      setPayAmount('');
      setPaymentNote('');
      setPaymentIdempotencyKey('');
      await loadDetails();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({
        title: 'Payment Failed',
        description: err?.message,
        variant: 'destructive',
      });
      // SOL-R004-003: Keep paymentIdempotencyKey stable across errors/retries of the same submission
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevertPayment = async (paymentId: string) => {
    const session = getAuthSession();
    if (!session) return;
    setSubmitting(true);
    try {
      await revertCreditCardPayment(session.id, { paymentId });
      toast({
        title: 'Payment Reverted',
        description: 'Payment undone; balances and statement pending amount restored.',
      });
      await loadDetails();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({
        title: 'Revert Failed',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeStatement = cardData?.activeStatement;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 px-2.5 rounded-lg border-[#E5ECE8] hover:border-[#16A34A] text-[#344054]"
          >
            <CreditCard className="h-3.5 w-3.5 mr-1 text-[#16A34A]" />
            <span>Card Details</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-[#111827] flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#16A34A]" />
              <span>{account.name}</span>
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => setStatementModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Statement</span>
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-[#667085]">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading card statement...</span>
          </div>
        ) : (
          <div className="space-y-5 pt-3">
            {/* Card Limits Summary */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F8FAF9] border border-[#E5ECE8]/80 text-xs">
              <div>
                <div className="text-[#667085]">Current Balance</div>
                <div className="text-sm font-bold text-[#111827] mt-0.5">
                  ₹{formatIndianRupees(cardData?.ledgerBalance || account.currentBalance)}
                </div>
              </div>
              <div>
                <div className="text-[#667085]">Credit Limit</div>
                <div className="text-sm font-bold text-[#111827] mt-0.5">
                  {cardData?.creditLimit ? `₹${formatIndianRupees(cardData.creditLimit)}` : 'Not set'}
                </div>
              </div>
              <div>
                <div className="text-[#667085]">Available Credit</div>
                <div className="text-sm font-bold text-[#16A34A] mt-0.5">
                  {cardData?.availableCredit ? `₹${formatIndianRupees(cardData.availableCredit)}` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Active Statement Section */}
            {activeStatement ? (
              <div className="rounded-xl border border-[#E5ECE8] p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#111827]">
                      Statement: {activeStatement.periodKey}
                    </span>
                    <StatusPill
                      label={activeStatement.status}
                      tone={
                        activeStatement.status === 'PAID'
                          ? 'green'
                          : activeStatement.status === 'PARTIAL'
                          ? 'amber'
                          : 'blue'
                      }
                    />
                  </div>
                  <div className="text-xs text-[#667085] flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Due {format(parseISO(activeStatement.dueDate), 'dd MMM yyyy')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5ECE8]/60 text-xs">
                  <div>
                    <div className="text-[#667085]">Statement Total</div>
                    <div className="text-sm font-bold text-[#111827] mt-0.5">
                      ₹{formatIndianRupees(activeStatement.statementAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#667085]">Paid So Far</div>
                    <div className="text-sm font-bold text-[#16A34A] mt-0.5">
                      ₹{formatIndianRupees(activeStatement.totalPaid)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#667085]">Pending Balance</div>
                    <div className="text-sm font-bold text-[#EF4444] mt-0.5">
                      ₹{formatIndianRupees(activeStatement.pendingBalance)}
                    </div>
                  </div>
                </div>

                {activeStatement.status !== 'PAID' && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        setPayAmount(activeStatement.pendingBalance);
                        setPaymentIdempotencyKey(generateRepaymentIdempotencyKey());
                        const defaultId =
                          cardData?.account?.defaultPaymentAccountId ||
                          cardData?.defaultPaymentAccount?.id ||
                          account.defaultPaymentAccountId;
                        if (defaultId && payerAccounts.some((a) => a.id === defaultId)) {
                          setSelectedFromAccountId(defaultId);
                        } else if (!payerAccounts.some((a) => a.id === selectedFromAccountId)) {
                          setSelectedFromAccountId(payerAccounts[0]?.id || '');
                        }
                        setPaymentModalOpen(true);
                      }}
                      className="h-8 px-3 rounded-lg bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Record Payment</span>
                    </Button>
                  </div>
                )}

                {/* Statement Payment History */}
                {activeStatement.payments && activeStatement.payments.length > 0 && (
                  <div className="pt-3 border-t border-[#E5ECE8]/60 space-y-2">
                    <div className="text-xs font-semibold text-[#344054]">
                      Payments Made on This Statement
                    </div>
                    <div className="space-y-1.5">
                      {activeStatement.payments.map((p: any) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAF9] text-xs border border-[#E5ECE8]/60"
                        >
                          <div>
                            <span className="font-semibold text-[#111827]">
                              ₹{formatIndianRupees(p.amount)}
                            </span>
                            <span className="text-[#667085] ml-2">
                              via {p.fromAccount?.name || 'Bank'} on{' '}
                              {format(parseISO(p.paidAt), 'dd MMM')}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={submitting}
                            onClick={() => handleRevertPayment(p.id)}
                            className="h-6 px-2 text-[11px] text-[#667085] hover:text-[#EF4444] hover:bg-[#FDECEC]"
                            title="Undo payment"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            <span>Undo</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-[#E5ECE8] text-center text-xs text-[#667085]">
                No active statement found. Click &quot;New Statement&quot; to register your card bill.
              </div>
            )}
          </div>
        )}

        {/* Modal: New Statement */}
        <Dialog open={statementModalOpen} onOpenChange={setStatementModalOpen}>
          <DialogContent className="sm:max-w-[420px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
            <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
              <DialogTitle className="text-base font-semibold text-[#111827]">
                New Credit Card Statement
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateStatement} className="space-y-3.5 pt-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#344054]">Period (YYYY-MM)</Label>
                <Input
                  value={newPeriodKey}
                  onChange={(e) => setNewPeriodKey(e.target.value)}
                  placeholder="2026-10"
                  className="h-10 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#344054]">Statement Amount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newStatementAmount}
                  onChange={(e) => setNewStatementAmount(e.target.value)}
                  placeholder="25000.00"
                  className="h-10 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#344054]">Statement Date</Label>
                  <Input
                    type="date"
                    value={newStatementDate}
                    onChange={(e) => setNewStatementDate(e.target.value)}
                    className="h-10 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#344054]">Payment Due Date</Label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="h-10 text-xs"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
              >
                {submitting ? 'Creating...' : 'Create Statement'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Record Payment */}
        <Dialog
          open={paymentModalOpen}
          onOpenChange={(isOpen) => {
            setPaymentModalOpen(isOpen);
            if (isOpen) {
              setPaymentIdempotencyKey((prev) => prev || generateRepaymentIdempotencyKey());
            } else {
              setPaymentIdempotencyKey('');
            }
          }}
        >
          <DialogContent className="sm:max-w-[420px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
            <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
              <DialogTitle className="text-base font-semibold text-[#111827]">
                Pay Credit Card Bill
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRecordPayment} className="space-y-3.5 pt-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#344054]">Pay From Account</Label>
                <Select
                  value={selectedFromAccountId}
                  onValueChange={setSelectedFromAccountId}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue
                      placeholder={
                        payerAccounts.length === 0
                          ? 'No eligible bank, cash or wallet account available'
                          : 'Select Bank/Cash Account'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {payerAccounts.length === 0 ? (
                      <SelectItem value="none" disabled className="text-sm text-[#667085]">
                        No eligible bank, cash or wallet account available
                      </SelectItem>
                    ) : (
                      payerAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-sm">
                          {a.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#344054]">
                  Amount (₹) [Max pending: ₹{cardData?.activeStatement?.pendingBalance}]
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Amount to pay"
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#344054]">Note (Optional)</Label>
                <Input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Paid via Netbanking"
                  className="h-10 text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || !selectedFromAccountId || payerAccounts.length === 0}
                className="w-full h-10 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
              >
                {submitting ? 'Recording...' : 'Confirm Bill Payment'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

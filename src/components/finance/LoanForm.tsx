'use client';

import React, { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus, Info, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoanFormProps {
  accounts: { id: string; name: string }[];
  onLoanCreated?: () => void;
  onSubmitAction: (data: any) => Promise<any>;
  trigger?: React.ReactNode;
  loan?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

const LOAN_TYPES = [
  { value: 'PERSONAL', label: 'Personal Loan' },
  { value: 'HOME', label: 'Home Loan' },
  { value: 'VEHICLE', label: 'Vehicle / Auto Loan' },
  { value: 'EDUCATION', label: 'Education Loan' },
  { value: 'GOLD', label: 'Gold Loan' },
  { value: 'PRODUCT_EMI', label: 'Product / Consumer Durable EMI' },
  { value: 'CREDIT_CARD_EMI', label: 'Credit Card EMI' },
  { value: 'OTHER', label: 'Other Loan' },
];

export function LoanForm({
  accounts,
  onLoanCreated,
  onSubmitAction,
  trigger,
  loan,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: LoanFormProps) {
  const isEdit = Boolean(loan);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    if (!isControlled) setInternalOpen(val);
  };
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [loanType, setLoanType] = useState('PERSONAL');
  const [openingOutstanding, setOpeningOutstanding] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [nextEmiDate, setNextEmiDate] = useState('');
  const [interestRatePercent, setInterestRatePercent] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('none');
  const [productName, setProductName] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [createLinkedObligation, setCreateLinkedObligation] = useState(true);

  // Credit Card EMI rule state
  const [ccAlreadyRecognized, setCcAlreadyRecognized] = useState(false);

  useEffect(() => {
    if (loan) {
      setName(loan.name || '');
      setLender(loan.lender || '');
      setLoanType(loan.loanType || 'PERSONAL');
      setOpeningOutstanding(loan.outstandingPrincipal ? String(loan.outstandingPrincipal) : '');
      setOriginalPrincipal(loan.originalPrincipal ? String(loan.originalPrincipal) : '');
      setEmiAmount(loan.emiAmount ? String(loan.emiAmount) : '');
      setDueDay(loan.dueDay ? String(loan.dueDay) : (loan.emiDueDay ? String(loan.emiDueDay) : ''));
      setInterestRatePercent(
        loan.interestRatePercent
          ? String(loan.interestRatePercent)
          : loan.interestRate
          ? String(loan.interestRate)
          : ''
      );
      setTenureMonths(loan.tenureMonths ? String(loan.tenureMonths) : '');
      setPaymentAccountId(loan.paymentAccountId || loan.paymentAccount?.id || 'none');
      setProductName(loan.productName || '');
      setMerchant(loan.merchant || '');
      setNotes(loan.notes || '');
      if (loan.nextEmiDate) {
        try {
          const d = typeof loan.nextEmiDate === 'string' ? new Date(loan.nextEmiDate) : loan.nextEmiDate;
          setNextEmiDate(d.toISOString().substring(0, 10));
        } catch {
          setNextEmiDate('');
        }
      } else {
        setNextEmiDate('');
      }
    }
  }, [loan]);

  const resetForm = () => {
    setName('');
    setLender('');
    setLoanType('PERSONAL');
    setOpeningOutstanding('');
    setOriginalPrincipal('');
    setEmiAmount('');
    setDueDay('');
    setNextEmiDate('');
    setInterestRatePercent('');
    setTenureMonths('');
    setPaymentAccountId('none');
    setProductName('');
    setMerchant('');
    setNotes('');
    setCreateLinkedObligation(true);
    setCcAlreadyRecognized(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: 'Loan name required', description: 'Enter a name for the loan or EMI.', variant: 'destructive' });
      return;
    }
    if (!lender.trim()) {
      toast({ title: 'Lender required', description: 'Enter the bank or financial institution.', variant: 'destructive' });
      return;
    }

    if (!isEdit) {
      const cleanOpening = openingOutstanding.trim();
      const numOpening = Number(cleanOpening);
      if (!cleanOpening || isNaN(numOpening) || numOpening <= 0) {
        toast({ title: 'Invalid balance', description: 'Enter current outstanding principal greater than 0.', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        // Safe mutable metadata only - disallow editing outstandingPrincipal
        const payload: any = {
          name: name.trim(),
          lender: lender.trim(),
          loanType,
          paymentAccountId: paymentAccountId !== 'none' ? paymentAccountId : null,
          productName: productName.trim() || null,
          merchant: merchant.trim() || null,
          notes: notes.trim() || null,
        };

        const cleanEmi = emiAmount.trim();
        if (cleanEmi && !isNaN(Number(cleanEmi)) && Number(cleanEmi) > 0) {
          payload.emiAmount = cleanEmi;
        } else {
          payload.emiAmount = null;
        }

        const initialDueDay = loan?.dueDay ?? (loan as any)?.emiDueDay ?? null;
        let newDueDayVal: number | null = null;
        if (dueDay && parseInt(dueDay, 10) >= 1 && parseInt(dueDay, 10) <= 31) {
          newDueDayVal = parseInt(dueDay, 10);
        }
        payload.dueDay = newDueDayVal;

        const initialNextEmiDateStr = loan?.nextEmiDate
          ? (typeof loan.nextEmiDate === 'string' ? loan.nextEmiDate.substring(0, 10) : new Date(loan.nextEmiDate).toISOString().substring(0, 10))
          : '';
        const currentNextEmiDateStr = nextEmiDate ? nextEmiDate.trim() : '';

        const isDueDayEdited = newDueDayVal !== initialDueDay;
        const isNextEmiDateEdited = currentNextEmiDateStr !== initialNextEmiDateStr;

        // Ticket R001-P1-02: If loan?.nextEmiDate is null and nextEmiDate input is empty,
        // preserve cleared schedule (do not submit or force generation of new date).
        if (!loan?.nextEmiDate && !currentNextEmiDateStr) {
          payload.nextEmiDate = null;
        } else if (isDueDayEdited) {
          if (isNextEmiDateEdited) {
            payload.nextEmiDate = currentNextEmiDateStr ? new Date(currentNextEmiDateStr).toISOString() : null;
          }
        } else {
          if (isNextEmiDateEdited) {
            payload.nextEmiDate = currentNextEmiDateStr ? new Date(currentNextEmiDateStr).toISOString() : null;
          } else if (loan?.nextEmiDate) {
            payload.nextEmiDate = typeof loan.nextEmiDate === 'string' ? loan.nextEmiDate : new Date(loan.nextEmiDate).toISOString();
          }
        }

        const cleanRate = interestRatePercent.trim();
        if (cleanRate && !isNaN(Number(cleanRate)) && Number(cleanRate) >= 0) {
          payload.interestRatePercent = cleanRate;
        } else {
          payload.interestRatePercent = null;
        }

        if (tenureMonths && parseInt(tenureMonths, 10) > 0) {
          payload.tenureMonths = parseInt(tenureMonths, 10);
        } else {
          payload.tenureMonths = null;
        }

        const res = await onSubmitAction(payload);
        if (res && res.error) {
          throw new Error(res.error);
        }

        toast({
          title: 'Loan updated',
          description: `Successfully updated ${name}.`,
        });

        setOpen(false);
        if (onSuccess) onSuccess();
        if (onLoanCreated) onLoanCreated();
      } else {
        const payload: any = {
          name: name.trim(),
          lender: lender.trim(),
          loanType,
          openingOutstanding: openingOutstanding.trim(),
          createLinkedObligation,
        };

        const cleanOrig = originalPrincipal.trim();
        if (cleanOrig && !isNaN(Number(cleanOrig)) && Number(cleanOrig) > 0) {
          payload.originalPrincipal = cleanOrig;
        }
        const cleanEmi = emiAmount.trim();
        if (cleanEmi && !isNaN(Number(cleanEmi)) && Number(cleanEmi) > 0) {
          payload.emiAmount = cleanEmi;
        }
        if (dueDay && parseInt(dueDay, 10) >= 1 && parseInt(dueDay, 10) <= 31) {
          payload.dueDay = parseInt(dueDay, 10);
        }
        if (nextEmiDate) {
          payload.nextEmiDate = new Date(nextEmiDate).toISOString();
        }
        const cleanRate = interestRatePercent.trim();
        if (cleanRate && !isNaN(Number(cleanRate)) && Number(cleanRate) >= 0) {
          payload.interestRatePercent = cleanRate;
        }
        if (tenureMonths && parseInt(tenureMonths, 10) > 0) {
          payload.tenureMonths = parseInt(tenureMonths, 10);
        }
        if (paymentAccountId && paymentAccountId !== 'none') {
          payload.paymentAccountId = paymentAccountId;
        }
        if (productName.trim()) {
          payload.productName = productName.trim();
        }
        if (merchant.trim()) {
          payload.merchant = merchant.trim();
        }
        if (notes.trim()) {
          payload.notes = notes.trim();
        }

        // CC EMI accounting rules
        if (loanType === 'CREDIT_CARD_EMI') {
          if (ccAlreadyRecognized) {
            payload.principalAlreadyRecognized = true;
            payload.emiGeneratesExpense = false;
          } else {
            payload.principalAlreadyRecognized = false;
            payload.emiGeneratesExpense = true;
          }
        } else {
          payload.emiGeneratesExpense = true;
          payload.principalAlreadyRecognized = false;
        }

        const res = await onSubmitAction(payload);
        if (res && res.error) {
          throw new Error(res.error);
        }

        toast({
          title: 'Loan liability tracked',
          description: `Successfully added ${name}.`,
        });

        resetForm();
        setOpen(false);
        if (onSuccess) onSuccess();
        if (onLoanCreated) onLoanCreated();
      }
    } catch (err: any) {
      toast({
        title: isEdit ? 'Error updating loan' : 'Error adding loan',
        description: err?.message || 'Could not save loan liability.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger asChild>
          {trigger || (
            <Button
              size="sm"
              className="h-10 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add Loan / EMI</span>
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#111827] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#16A34A]" />
            {isEdit ? `Edit Loan: ${loan?.name}` : 'Track Loan or EMI Liability'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[#344054]">Loan / Plan Name *</Label>
              <Input
                placeholder="e.g. HDFC Home Loan, MacBook EMI"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-9 text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#344054]">Lender / Bank *</Label>
              <Input
                placeholder="e.g. HDFC Bank, Bajaj Finserv, ICICI"
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                className="mt-1 h-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[#344054]">Loan Type *</Label>
              <Select value={loanType} onValueChange={setLoanType}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_TYPES.map((lt) => (
                    <SelectItem key={lt.value} value={lt.value}>
                      {lt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">
                {isEdit ? 'Outstanding Principal (₹)' : 'Current Outstanding (₹) *'}
              </Label>
              {isEdit ? (
                <>
                  <Input
                    disabled
                    value={loan?.outstandingPrincipal || openingOutstanding}
                    className="mt-1 h-9 text-sm font-medium bg-[#F8FAFC] text-[#64748B] cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[#667085] mt-0.5">
                    Principal locked. Use Reconcile to adjust.
                  </p>
                </>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={openingOutstanding}
                  onChange={(e) => setOpeningOutstanding(e.target.value)}
                  className="mt-1 h-9 text-sm font-medium"
                  required
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[#344054]">
                Original Principal (₹)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Optional"
                value={originalPrincipal}
                onChange={(e) => setOriginalPrincipal(e.target.value)}
                className="mt-1 h-9 text-sm"
                disabled={isEdit}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">EMI Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Monthly EMI"
                value={emiAmount}
                onChange={(e) => setEmiAmount(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">Due Day</Label>
              <Input
                type="number"
                min="1"
                max="31"
                placeholder="1 - 31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">Next EMI Date</Label>
              <Input
                type="date"
                value={nextEmiDate}
                onChange={(e) => setNextEmiDate(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[#344054]">Interest Rate (% p.a.)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 8.5"
                value={interestRatePercent}
                onChange={(e) => setInterestRatePercent(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">Tenure (Months)</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 24, 60"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#344054]">Payment Account</Label>
            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="Select bank/card account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / Not linked</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(loanType === 'PRODUCT_EMI' || loanType === 'CREDIT_CARD_EMI') && (
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
              <div className="text-xs font-semibold text-[#1E293B] flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-[#3B82F6]" />
                {loanType === 'CREDIT_CARD_EMI' ? 'Credit Card EMI Details' : 'Product Details'}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#475467]">Product / Item Name</Label>
                  <Input
                    placeholder="e.g. iPhone 15 Pro, Smart TV"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="mt-1 h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#475467]">Merchant / Retailer</Label>
                  <Input
                    placeholder="e.g. Amazon, Reliance Digital"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="mt-1 h-8 text-xs bg-white"
                  />
                </div>
              </div>

              {loanType === 'CREDIT_CARD_EMI' && !isEdit && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <Label className="text-xs font-semibold text-[#1E293B] block mb-1">
                    Expense Accounting Rule
                  </Label>
                  <div className="flex items-start gap-2 mt-1">
                    <input
                      type="checkbox"
                      id="ccAlreadyRecognized"
                      checked={ccAlreadyRecognized}
                      onChange={(e) => setCcAlreadyRecognized(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#16A34A] focus:ring-[#16A34A]"
                    />
                    <label htmlFor="ccAlreadyRecognized" className="text-xs text-[#475467] leading-relaxed cursor-pointer">
                      <strong>Full purchase expense was already recorded:</strong> Check this if you already entered the transaction for this purchase earlier. EMI repayments will decrement the liability balance without creating a duplicate expense transaction.
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isEdit && (
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="createLinkedObligation"
                checked={createLinkedObligation}
                onChange={(e) => setCreateLinkedObligation(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#16A34A] focus:ring-[#16A34A]"
              />
              <label htmlFor="createLinkedObligation" className="text-xs text-[#475467] leading-relaxed cursor-pointer">
                <strong>Create recurring EMI reminder:</strong> Automatically adds an active obligation to track upcoming monthly payments.
              </label>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold text-[#344054]">Notes (Optional)</Label>
            <Input
              placeholder="Loan account number, reference, or terms"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5ECE8]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="h-9 px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Save Loan Liability'}</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

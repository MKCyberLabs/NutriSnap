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
import {
  ACCOUNT_TYPES,
  AccountType,
} from '@/lib/finance/finance';
import { formatIndianRupees } from '@/components/design-system/MoneyAmount';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface AccountFormInitialData {
  id?: string;
  name?: string;
  type?: string;
  institution?: string | null;
  openingBalance?: string | number;
  currentBalance?: string | number;
  creditLimit?: string | number | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
  defaultPaymentAccountId?: string | null;
}

interface AccountFormProps {
  mode?: 'create' | 'edit';
  initialData?: AccountFormInitialData;
  accounts?: { id: string; name: string; type: string }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAccountCreated?: () => void;
  onAccountUpdated?: () => void;
  onSubmitAction: (data: any) => Promise<any>;
  trigger?: React.ReactNode;
}

export function AccountForm({
  mode = 'create',
  initialData,
  accounts = [],
  open: externalOpen,
  onOpenChange,
  onAccountCreated,
  onAccountUpdated,
  onSubmitAction,
  trigger,
}: AccountFormProps) {
  const isControlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? externalOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    if (!isControlled) setInternalOpen(val);
  };

  const isEdit = mode === 'edit';
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<AccountType>(
    (initialData?.type as AccountType) || 'BANK'
  );
  const [institution, setInstitution] = useState(initialData?.institution || '');
  const [openingBalance, setOpeningBalance] = useState(
    initialData?.openingBalance !== undefined ? String(initialData.openingBalance) : '0'
  );
  const [creditLimit, setCreditLimit] = useState(
    initialData?.creditLimit !== undefined && initialData?.creditLimit !== null
      ? String(initialData.creditLimit)
      : ''
  );
  const [statementDay, setStatementDay] = useState(
    initialData?.statementDay !== undefined && initialData?.statementDay !== null
      ? String(initialData.statementDay)
      : ''
  );
  const [paymentDueDay, setPaymentDueDay] = useState(
    initialData?.paymentDueDay !== undefined && initialData?.paymentDueDay !== null
      ? String(initialData.paymentDueDay)
      : ''
  );
  const [defaultPaymentAccountId, setDefaultPaymentAccountId] = useState(
    initialData?.defaultPaymentAccountId || ''
  );

  useEffect(() => {
    if (open) {
      if (isEdit && initialData) {
        setName(initialData.name || '');
        setType((initialData.type as AccountType) || 'BANK');
        setInstitution(initialData.institution || '');
        setCreditLimit(
          initialData.creditLimit !== undefined && initialData.creditLimit !== null
            ? String(initialData.creditLimit)
            : ''
        );
        setStatementDay(
          initialData.statementDay !== undefined && initialData.statementDay !== null
            ? String(initialData.statementDay)
            : ''
        );
        setPaymentDueDay(
          initialData.paymentDueDay !== undefined && initialData.paymentDueDay !== null
            ? String(initialData.paymentDueDay)
            : ''
        );
        setDefaultPaymentAccountId(initialData.defaultPaymentAccountId || '');
      } else if (!isEdit) {
        setName('');
        setType('BANK');
        setInstitution('');
        setOpeningBalance('0');
        setCreditLimit('');
        setStatementDay('');
        setPaymentDueDay('');
        setDefaultPaymentAccountId('');
      }
    }
  }, [open, isEdit, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Account name required', variant: 'destructive' });
      return;
    }

    if (!isEdit && openingBalance.trim()) {
      const num = Number(openingBalance.trim());
      if (isNaN(num) || num < 0) {
        toast({ title: 'Invalid opening balance', description: 'Opening balance cannot be negative or invalid.', variant: 'destructive' });
        return;
      }
    }

    if (type === 'CREDIT_CARD') {
      if (creditLimit.trim()) {
        const num = Number(creditLimit.trim());
        if (isNaN(num) || num < 0) {
          toast({ title: 'Invalid credit limit', description: 'Credit limit cannot be negative or invalid.', variant: 'destructive' });
          return;
        }
      }
      if (statementDay) {
        const sDay = parseInt(statementDay, 10);
        if (isNaN(sDay) || sDay < 1 || sDay > 31) {
          toast({ title: 'Statement day must be between 1 and 31', variant: 'destructive' });
          return;
        }
      }
      if (paymentDueDay) {
        const dDay = parseInt(paymentDueDay, 10);
        if (isNaN(dDay) || dDay < 1 || dDay > 31) {
          toast({ title: 'Payment due day must be between 1 and 31', variant: 'destructive' });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      let payload: any;
      if (isEdit) {
        payload = {
          name: name.trim(),
          institution: institution.trim() || null,
        };

        if (type === 'CREDIT_CARD') {
          payload.creditLimit = creditLimit.trim() ? creditLimit.trim() : null;
          payload.statementDay = statementDay ? parseInt(statementDay, 10) : null;
          payload.paymentDueDay = paymentDueDay ? parseInt(paymentDueDay, 10) : null;
          payload.defaultPaymentAccountId = defaultPaymentAccountId || null;
        }
      } else {
        payload = {
          name: name.trim(),
          type,
          institution: institution.trim() || undefined,
          openingBalance: openingBalance.trim() ? openingBalance.trim() : '0',
        };

        if (type === 'CREDIT_CARD') {
          if (creditLimit.trim()) payload.creditLimit = creditLimit.trim();
          if (statementDay) payload.statementDay = parseInt(statementDay, 10);
          if (paymentDueDay) payload.paymentDueDay = parseInt(paymentDueDay, 10);
          if (defaultPaymentAccountId) payload.defaultPaymentAccountId = defaultPaymentAccountId;
        }
      }

      const res = await onSubmitAction(payload);
      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: isEdit ? 'Account updated' : 'Account created',
        description: isEdit
          ? `Successfully updated "${name}".`
          : `Successfully added "${name}".`,
      });

      if (!isEdit) {
        setName('');
        setInstitution('');
        setOpeningBalance('0');
        setCreditLimit('');
        setStatementDay('');
        setPaymentDueDay('');
        setDefaultPaymentAccountId('');
      }
      setOpen(false);

      if (isEdit) {
        if (onAccountUpdated) onAccountUpdated();
        else if (onAccountCreated) onAccountCreated();
      } else {
        if (onAccountCreated) onAccountCreated();
      }
    } catch (err: any) {
      toast({
        title: isEdit ? 'Error updating account' : 'Error creating account',
        description: err?.message || 'Could not save account.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Payment source accounts for credit card (exclude this credit card itself)
  const paymentAccountOptions = accounts.filter(
    (a) => a.id !== initialData?.id && a.type !== 'CREDIT_CARD'
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isControlled && !isEdit && (
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="h-10 px-4 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Account</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[440px] rounded-2xl bg-white p-6 border border-[#E2E8F0]">
        <DialogHeader className="pb-3 border-b border-[#E2E8F0]">
          <DialogTitle className="text-lg font-semibold text-[#1E293B]">
            {isEdit ? 'Edit Account' : 'Add Account'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Account Name */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name" className="text-xs font-semibold text-[#1E293B]">
              Account Name
            </Label>
            <Input
              id="acc-name"
              type="text"
              placeholder="e.g. HDFC Salary, Main Cash Wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#6D28D9] focus:ring-[#6D28D9] text-sm"
              required
            />
          </div>

          {/* Account Type (Select for Create, Readonly pill for Edit) */}
          {!isEdit ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1E293B]">Account Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0] text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white border border-[#E2E8F0]">
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-sm">
                      {t.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-xs">
              <span className="font-medium text-[#64748B]">Account Type</span>
              <span className="font-semibold uppercase px-2 py-0.5 rounded-md bg-white border border-[#DDD6FE] text-[#6D28D9]">
                {type.replace('_', ' ')}
              </span>
            </div>
          )}

          {/* Financial Institution */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-inst" className="text-xs font-semibold text-[#1E293B]">
              Financial Institution (Optional)
            </Label>
            <Input
              id="acc-inst"
              type="text"
              placeholder="e.g. HDFC Bank, SBI, Paytm"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#6D28D9] focus:ring-[#6D28D9] text-sm"
            />
          </div>

          {/* Opening Balance (Create mode only; Non-editable in Edit mode) */}
          {!isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="acc-balance" className="text-xs font-semibold text-[#1E293B]">
                Opening Balance (₹)
              </Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#6D28D9] focus:ring-[#6D28D9] text-sm tabular-nums"
                required
              />
            </div>
          ) : (
            <div className="space-y-1 rounded-xl bg-[#F8FAFC] p-3 border border-[#E2E8F0] text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#64748B]">Current Ledger Balance</span>
                <span className="font-semibold text-[#1E293B]">
                  ₹{formatIndianRupees(initialData?.currentBalance ?? initialData?.openingBalance ?? 0)}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Account balances are derived from posted transactions and cannot be altered directly.
              </p>
            </div>
          )}

          {/* Credit Card Specific Fields */}
          {type === 'CREDIT_CARD' && (
            <div className="space-y-3 pt-1 border-t border-[#E2E8F0]">
              <div className="space-y-1.5">
                <Label htmlFor="acc-limit" className="text-xs font-semibold text-[#1E293B]">
                  Credit Limit (₹)
                </Label>
                <Input
                  id="acc-limit"
                  type="number"
                  step="0.01"
                  placeholder="50000.00"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#6D28D9] focus:ring-[#6D28D9] text-sm tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-statement-day" className="text-xs font-semibold text-[#1E293B]">
                    Statement Day (1-31)
                  </Label>
                  <Input
                    id="acc-statement-day"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="e.g. 15"
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#6D28D9] focus:ring-[#6D28D9] text-sm tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="acc-due-day" className="text-xs font-semibold text-[#1E293B]">
                    Payment Due Day (1-31)
                  </Label>
                  <Input
                    id="acc-due-day"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="e.g. 5"
                    value={paymentDueDay}
                    onChange={(e) => setPaymentDueDay(e.target.value)}
                    className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#6D28D9] focus:ring-[#6D28D9] text-sm tabular-nums"
                  />
                </div>
              </div>

              {paymentAccountOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E293B]">
                    Default Payment Account
                  </Label>
                  <Select
                    value={defaultPaymentAccountId || 'none'}
                    onValueChange={(val) => setDefaultPaymentAccountId(val === 'none' ? '' : val)}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0] text-sm">
                      <SelectValue placeholder="Select payment bank/wallet" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-white border border-[#E2E8F0]">
                      <SelectItem value="none" className="text-sm text-[#64748B]">
                        None / Manual selection
                      </SelectItem>
                      {paymentAccountOptions.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-sm">
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] font-semibold text-sm transition-colors mt-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEdit ? 'Update Account' : 'Save Account'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

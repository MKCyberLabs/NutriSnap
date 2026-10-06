'use client';

import React, { useState } from 'react';
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
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AccountFormProps {
  onAccountCreated: () => void;
  onSubmitAction: (data: any) => Promise<any>;
  trigger?: React.ReactNode;
}

export function AccountForm({
  onAccountCreated,
  onSubmitAction,
  trigger,
}: AccountFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [institution, setInstitution] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Account name required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        type,
        institution: institution.trim() || undefined,
        openingBalance: (parseFloat(openingBalance) || 0).toFixed(2),
      };

      if (type === 'CREDIT_CARD' && creditLimit) {
        payload.creditLimit = parseFloat(creditLimit).toFixed(2);
      }

      const res = await onSubmitAction(payload);
      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: 'Account created',
        description: `Successfully added "${name}".`,
      });

      setName('');
      setInstitution('');
      setOpeningBalance('0');
      setCreditLimit('');
      setOpen(false);
      onAccountCreated();
    } catch (err: any) {
      toast({
        title: 'Error creating account',
        description: err?.message || 'Could not save account.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            variant="outline"
            className="h-10 px-4 rounded-[10px] border-[#E5ECE8] bg-white text-[#344054] hover:bg-[#F7FAF8] font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] rounded-[18px] bg-white p-6 border border-[#E5ECE8]">
        <DialogHeader className="pb-3 border-b border-[#E5ECE8]">
          <DialogTitle className="text-lg font-semibold text-[#111827]">
            Add Account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name" className="text-xs font-semibold text-[#344054]">
              Account Name
            </Label>
            <Input
              id="acc-name"
              type="text"
              placeholder="e.g. HDFC Salary, Main Cash Wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#344054]">Account Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger className="h-11 rounded-[10px] border-[#E5ECE8] text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white border border-[#E5ECE8]">
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-sm">
                    {t.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acc-inst" className="text-xs font-semibold text-[#344054]">
              Financial Institution (Optional)
            </Label>
            <Input
              id="acc-inst"
              type="text"
              placeholder="e.g. HDFC Bank, SBI, Paytm"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acc-balance" className="text-xs font-semibold text-[#344054]">
              Opening Balance (₹)
            </Label>
            <Input
              id="acc-balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="h-11 rounded-[10px] border-[#E5ECE8] text-sm tabular-nums"
              required
            />
          </div>

          {type === 'CREDIT_CARD' && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-limit" className="text-xs font-semibold text-[#344054]">
                Credit Limit (₹, Optional)
              </Label>
              <Input
                id="acc-limit"
                type="number"
                step="0.01"
                placeholder="50000.00"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="h-11 rounded-[10px] border-[#E5ECE8] text-sm tabular-nums"
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] font-semibold text-sm transition-colors mt-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Save Account'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

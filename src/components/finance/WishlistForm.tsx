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
import { Loader2, Plus, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WishlistFormProps {
  accounts: { id: string; name: string }[];
  initialItem?: any | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmitAction: (data: any) => Promise<any>;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

const CATEGORIES = [
  'Electronics',
  'Gadgets',
  'Home & Kitchen',
  'Appliances',
  'Travel & Vacation',
  'Personal',
  'Clothing & Fashion',
  'Fitness & Health',
  'Books & Learning',
  'Vehicle & Transport',
  'Other',
];

const PRIORITIES = [
  { value: 'HIGH', label: 'High Priority' },
  { value: 'MEDIUM', label: 'Medium Priority' },
  { value: 'LOW', label: 'Low Priority' },
];

const STATUSES = [
  { value: 'WISHLIST', label: 'Wishlist (Someday)' },
  { value: 'PLANNED', label: 'Planned (Target set)' },
  { value: 'READY', label: 'Ready to Buy' },
];

export function WishlistForm({
  accounts,
  initialItem,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onSubmitAction,
  onSuccess,
  trigger,
}: WishlistFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (externalOnOpenChange || (() => {})) : setInternalOpen;

  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [targetPrice, setTargetPrice] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [targetDate, setTargetDate] = useState('');
  const [plannedAccountId, setPlannedAccountId] = useState('none');
  const [status, setStatus] = useState('WISHLIST');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name || '');
      setCategory(initialItem.category || 'Electronics');
      setTargetPrice(String(initialItem.targetPrice || ''));
      setMaxBudget(initialItem.maxBudget ? String(initialItem.maxBudget) : '');
      setPriority(initialItem.priority || 'MEDIUM');
      setTargetDate(
        initialItem.targetDate
          ? new Date(initialItem.targetDate).toISOString().substring(0, 10)
          : ''
      );
      setPlannedAccountId(initialItem.plannedAccountId || 'none');
      setStatus(initialItem.status || 'WISHLIST');
      setNotes(initialItem.notes || '');
    } else {
      setName('');
      setCategory('Electronics');
      setTargetPrice('');
      setMaxBudget('');
      setPriority('MEDIUM');
      setTargetDate('');
      setPlannedAccountId('none');
      setStatus('WISHLIST');
      setNotes('');
    }
  }, [initialItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Enter what you want to buy.', variant: 'destructive' });
      return;
    }

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      toast({ title: 'Invalid price', description: 'Enter a valid target price greater than 0.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        category,
        targetPrice: price.toFixed(2),
        priority,
        status,
      };

      if (maxBudget && parseFloat(maxBudget) > 0) {
        payload.maxBudget = parseFloat(maxBudget).toFixed(2);
      } else {
        payload.maxBudget = null;
      }

      if (targetDate) {
        payload.targetDate = new Date(targetDate).toISOString();
      } else {
        payload.targetDate = null;
      }

      if (plannedAccountId && plannedAccountId !== 'none') {
        payload.plannedAccountId = plannedAccountId;
      } else {
        payload.plannedAccountId = null;
      }

      if (notes.trim()) {
        payload.notes = notes.trim();
      } else {
        payload.notes = null;
      }

      const res = await onSubmitAction(payload);
      if (res && res.error) {
        throw new Error(res.error);
      }

      toast({
        title: initialItem ? 'Wishlist item updated' : 'Wishlist item added',
        description: `Saved "${name}".`,
      });

      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Error saving item',
        description: err?.message || 'Could not save wishlist item.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button
              size="sm"
              className="h-10 px-4 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add Wishlist Item</span>
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1E293B] flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#6D28D9]" />
            {initialItem ? 'Edit Wishlist Item' : 'Add Wishlist Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-[#344054]">Item Name *</Label>
              <Input
                placeholder="e.g. Sony Headphones, Goa Trip, Air Fryer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-9 text-sm"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">Priority *</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[#344054]">Target Price (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Expected cost"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="mt-1 h-9 text-sm font-medium"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">Max Budget (₹)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Upper budget limit"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[#344054]">Target Date</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#344054]">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#344054]">Planned Account</Label>
            <Select value={plannedAccountId} onValueChange={setPlannedAccountId}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / Any account</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#344054]">Notes (Optional)</Label>
            <Input
              placeholder="Sale details, links, or wishlist thoughts"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="h-9 px-3 text-xs border-[#E2E8F0]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{initialItem ? 'Update Item' : 'Save to Wishlist'}</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

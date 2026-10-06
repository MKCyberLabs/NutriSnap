import React from 'react';

export type MoneyType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'NEUTRAL';

interface MoneyAmountProps {
  amount: number | string | null | undefined;
  type?: MoneyType;
  showSign?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  hideDecimalsIfZero?: boolean;
}

export function formatIndianRupees(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const sizeStyles = {
  xs: 'text-xs',
  sm: 'text-sm font-medium',
  md: 'text-base font-semibold',
  lg: 'text-xl font-bold',
  xl: 'text-2xl sm:text-[28px] font-bold',
};

const typeStyles: Record<MoneyType, string> = {
  INCOME: 'text-[#0F7A38]',
  EXPENSE: 'text-[#B42318]',
  TRANSFER: 'text-[#2F80ED]',
  NEUTRAL: 'text-[#111827]',
};

export function MoneyAmount({
  amount,
  type = 'NEUTRAL',
  showSign = false,
  size = 'md',
  className = '',
}: MoneyAmountProps) {
  const formatted = formatIndianRupees(amount);

  let prefix = '';
  if (showSign) {
    if (type === 'INCOME') prefix = '+';
    else if (type === 'EXPENSE') prefix = '-';
  }

  return (
    <span className={`tabular-nums tracking-tight ${sizeStyles[size]} ${typeStyles[type]} ${className}`}>
      {prefix}₹{formatted}
    </span>
  );
}

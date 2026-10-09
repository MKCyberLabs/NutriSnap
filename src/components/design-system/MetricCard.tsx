import React from 'react';
import Link from 'next/link';

export type MetricTone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'purple';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: MetricTone;
  helperText?: string;
  href?: string;
  className?: string;
}

const toneStyles: Record<MetricTone, { card: string; value: string; iconBg: string; iconColor: string }> = {
  neutral: {
    card: 'bg-white border-[#E2E8F0]',
    value: 'text-[#1E293B]',
    iconBg: 'bg-[#F1F5F9]',
    iconColor: 'text-[#64748B]',
  },
  purple: {
    card: 'bg-[#F5F3FF]/70 border-[#DDD6FE]',
    value: 'text-[#6D28D9]',
    iconBg: 'bg-[#F5F3FF]',
    iconColor: 'text-[#6D28D9]',
  },
  green: {
    card: 'bg-[#ECFDF5]/60 border-[#A7F3D0]',
    value: 'text-[#059669]',
    iconBg: 'bg-[#ECFDF5]',
    iconColor: 'text-[#059669]',
  },
  blue: {
    card: 'bg-[#EFF6FF]/60 border-[#BFDBFE]',
    value: 'text-[#2563EB]',
    iconBg: 'bg-[#EFF6FF]',
    iconColor: 'text-[#2563EB]',
  },
  amber: {
    card: 'bg-[#FFFBEB]/60 border-[#FDE68A]',
    value: 'text-[#D97706]',
    iconBg: 'bg-[#FFFBEB]',
    iconColor: 'text-[#D97706]',
  },
  red: {
    card: 'bg-[#FEF2F2]/60 border-[#FECACA]',
    value: 'text-[#DC2626]',
    iconBg: 'bg-[#FEF2F2]',
    iconColor: 'text-[#DC2626]',
  },
};

export function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
  helperText,
  href,
  className = '',
}: MetricCardProps) {
  const styles = toneStyles[tone];

  const content = (
    <div
      className={`rounded-2xl border p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] transition-all ${
        href ? 'hover:shadow-[0_4px_6px_-1px_rgba(15,23,42,0.07),0_2px_4px_-2px_rgba(15,23,42,0.04)] hover:border-[#8B5CF6] cursor-pointer' : ''
      } ${styles.card} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#64748B] tracking-tight">{label}</span>
        {icon && (
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBg} ${styles.iconColor}`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
      <div className={`mt-2 text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums ${styles.value}`}>
        {value}
      </div>
      {helperText && (
        <div className="mt-1 text-xs text-[#64748B] truncate">
          {helperText}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}

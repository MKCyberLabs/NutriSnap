import React from 'react';
import Link from 'next/link';

export type MetricTone = 'neutral' | 'green' | 'blue' | 'amber' | 'red';

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
    card: 'bg-white border-[#E5ECE8]',
    value: 'text-[#111827]',
    iconBg: 'bg-[#F7FAF8]',
    iconColor: 'text-[#667085]',
  },
  green: {
    card: 'bg-[#EAF8EF]/50 border-[#E5ECE8]',
    value: 'text-[#0F7A38]',
    iconBg: 'bg-[#EAF8EF]',
    iconColor: 'text-[#16A34A]',
  },
  blue: {
    card: 'bg-[#EAF3FF]/50 border-[#E5ECE8]',
    value: 'text-[#111827]',
    iconBg: 'bg-[#EAF3FF]',
    iconColor: 'text-[#2F80ED]',
  },
  amber: {
    card: 'bg-[#FFF4DF]/50 border-[#E5ECE8]',
    value: 'text-[#111827]',
    iconBg: 'bg-[#FFF4DF]',
    iconColor: 'text-[#F59E0B]',
  },
  red: {
    card: 'bg-[#FDECEC]/50 border-[#E5ECE8]',
    value: 'text-[#B42318]',
    iconBg: 'bg-[#FDECEC]',
    iconColor: 'text-[#EF4444]',
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
      className={`rounded-[14px] border p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition-all ${
        href ? 'hover:shadow-[0_6px_18px_rgba(16,24,40,0.08)] cursor-pointer' : ''
      } ${styles.card} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#667085] tracking-tight">{label}</span>
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
        <div className="mt-1 text-xs text-[#667085] truncate">
          {helperText}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded-[14px]">
        {content}
      </Link>
    );
  }

  return content;
}

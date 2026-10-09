import React from 'react';

export type StatusTone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'purple';

interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

const toneStyles: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  neutral: {
    bg: 'bg-[#F1F5F9] border-[#E2E8F0]',
    text: 'text-[#475569]',
    dot: 'bg-[#64748B]',
  },
  purple: {
    bg: 'bg-[#F5F3FF] border-[#DDD6FE]',
    text: 'text-[#6D28D9]',
    dot: 'bg-[#6D28D9]',
  },
  green: {
    bg: 'bg-[#ECFDF5] border-[#A7F3D0]',
    text: 'text-[#047857]',
    dot: 'bg-[#059669]',
  },
  blue: {
    bg: 'bg-[#EFF6FF] border-[#BFDBFE]',
    text: 'text-[#1D4ED8]',
    dot: 'bg-[#2563EB]',
  },
  amber: {
    bg: 'bg-[#FFFBEB] border-[#FDE68A]',
    text: 'text-[#B45309]',
    dot: 'bg-[#D97706]',
  },
  red: {
    bg: 'bg-[#FEF2F2] border-[#FECACA]',
    text: 'text-[#DC2626]',
    dot: 'bg-[#DC2626]',
  },
};

export function StatusPill({
  label,
  tone = 'neutral',
  dot = false,
  icon,
  className = '',
  size = 'sm',
}: StatusPillProps) {
  const styles = toneStyles[tone];
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClass} ${styles.bg} ${styles.text} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`} aria-hidden="true" />}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  );
}

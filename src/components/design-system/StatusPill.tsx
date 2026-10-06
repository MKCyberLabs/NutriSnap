import React from 'react';

export type StatusTone = 'neutral' | 'green' | 'blue' | 'amber' | 'red';

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
    bg: 'bg-[#F7FAF8] border-[#E5ECE8]',
    text: 'text-[#667085]',
    dot: 'bg-[#667085]',
  },
  green: {
    bg: 'bg-[#EAF8EF] border-[#C3EAD0]',
    text: 'text-[#0F7A38]',
    dot: 'bg-[#16A34A]',
  },
  blue: {
    bg: 'bg-[#EAF3FF] border-[#C2DBFE]',
    text: 'text-[#1D4ED8]',
    dot: 'bg-[#2F80ED]',
  },
  amber: {
    bg: 'bg-[#FFF4DF] border-[#FCE1B3]',
    text: 'text-[#B45309]',
    dot: 'bg-[#F59E0B]',
  },
  red: {
    bg: 'bg-[#FDECEC] border-[#F9C6C6]',
    text: 'text-[#B42318]',
    dot: 'bg-[#EF4444]',
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

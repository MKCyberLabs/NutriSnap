import React from 'react';

interface ProgressMetricProps {
  label: string;
  current: number;
  goal: number;
  unit?: string;
  tone?: 'purple' | 'green' | 'blue' | 'amber';
  subtitle?: string;
  className?: string;
}

const toneStyles = {
  purple: {
    bg: 'bg-[#F1F5F9]',
    bar: 'bg-[#6D28D9]',
    text: 'text-[#6D28D9]',
  },
  green: {
    bg: 'bg-[#ECFDF5]',
    bar: 'bg-[#059669]',
    text: 'text-[#059669]',
  },
  blue: {
    bg: 'bg-[#EFF6FF]',
    bar: 'bg-[#2563EB]',
    text: 'text-[#2563EB]',
  },
  amber: {
    bg: 'bg-[#FFFBEB]',
    bar: 'bg-[#D97706]',
    text: 'text-[#D97706]',
  },
};

export function ProgressMetric({
  label,
  current,
  goal,
  unit = '',
  tone = 'purple',
  subtitle,
  className = '',
}: ProgressMetricProps) {
  const styles = toneStyles[tone];
  const percent = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-[#344054]">{label}</span>
        <span className="text-[#667085] tabular-nums">
          <span className={`font-semibold ${styles.text}`}>{current.toLocaleString()}</span>
          {goal > 0 && <span> / {goal.toLocaleString()} {unit}</span>}
        </span>
      </div>
      <div className={`h-2.5 w-full rounded-full ${styles.bg} overflow-hidden`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full ${styles.bar} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {subtitle && (
        <div className="text-[11px] text-[#667085]">{subtitle}</div>
      )}
    </div>
  );
}

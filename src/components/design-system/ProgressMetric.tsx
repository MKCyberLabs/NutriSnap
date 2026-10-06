import React from 'react';

interface ProgressMetricProps {
  label: string;
  current: number;
  goal: number;
  unit?: string;
  tone?: 'green' | 'blue' | 'amber';
  subtitle?: string;
  className?: string;
}

const toneStyles = {
  green: {
    bg: 'bg-[#EAF8EF]',
    bar: 'bg-[#16A34A]',
    text: 'text-[#0F7A38]',
  },
  blue: {
    bg: 'bg-[#EAF3FF]',
    bar: 'bg-[#2F80ED]',
    text: 'text-[#2F80ED]',
  },
  amber: {
    bg: 'bg-[#FFF4DF]',
    bar: 'bg-[#F59E0B]',
    text: 'text-[#B45309]',
  },
};

export function ProgressMetric({
  label,
  current,
  goal,
  unit = '',
  tone = 'green',
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

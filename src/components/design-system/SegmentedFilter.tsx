import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface SegmentedFilterProps {
  options: FilterOption[];
  selected: string;
  onChange: (val: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedFilter({
  options,
  selected,
  onChange,
  className = '',
  size = 'sm',
}: SegmentedFilterProps) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  return (
    <div
      className={`inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#FAFAFC] border border-[#E2E8F0] overflow-x-auto max-w-full ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] ${pad} ${
              active
                ? 'bg-white text-[#6D28D9] shadow-xs font-semibold'
                : 'text-[#64748B] hover:text-[#1E293B] hover:bg-white/60'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`ml-1.5 text-[11px] px-1.5 py-0.2 rounded-full ${
                  active ? 'bg-[#F5F3FF] text-[#6D28D9]' : 'bg-[#E2E8F0] text-[#64748B]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

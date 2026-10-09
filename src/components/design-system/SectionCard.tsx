import React from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = '',
  headerClassName = '',
}: SectionCardProps) {
  return (
    <div
      className={`rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] p-5 sm:p-6 ${className}`}
    >
      <div className={`flex items-start justify-between gap-4 mb-4 ${headerClassName}`}>
        <div>
          <h2 className="text-base font-semibold text-[#1E293B] tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-[#64748B] mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

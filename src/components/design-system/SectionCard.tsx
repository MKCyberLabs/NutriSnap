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
      className={`rounded-[14px] border border-[#E5ECE8] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-5 sm:p-6 ${className}`}
    >
      <div className={`flex items-start justify-between gap-4 mb-4 ${headerClassName}`}>
        <div>
          <h2 className="text-base font-semibold text-[#111827] tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-[#667085] mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

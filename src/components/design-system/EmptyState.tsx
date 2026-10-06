import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-[14px] border border-dashed border-[#E5ECE8] bg-[#F7FAF8]/50 ${className}`}
    >
      {icon && (
        <div
          className="h-12 w-12 rounded-full bg-white border border-[#E5ECE8] flex items-center justify-center text-[#667085] shadow-xs mb-3"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      <p className="text-xs text-[#667085] max-w-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

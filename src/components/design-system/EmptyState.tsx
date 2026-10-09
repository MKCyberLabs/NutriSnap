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
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-[#E2E8F0] bg-[#FAFAFC] ${className}`}
    >
      {icon && (
        <div
          className="h-12 w-12 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] shadow-xs mb-3"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#1E293B]">{title}</h3>
      <p className="text-xs text-[#64748B] max-w-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 ${className}`}>
      <div>
        <h1 className="text-2xl sm:text-[30px] font-bold text-[#111827] tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <div className="text-xs sm:text-sm text-[#667085] mt-1 font-normal">
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2.5 mt-1 sm:mt-0">{action}</div>}
    </div>
  );
}

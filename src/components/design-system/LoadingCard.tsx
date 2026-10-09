import React from 'react';

interface LoadingCardProps {
  lines?: number;
  className?: string;
  height?: string;
}

export function LoadingCard({
  lines = 3,
  className = '',
  height,
}: LoadingCardProps) {
  return (
    <div
      className={`rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] animate-pulse ${className}`}
      style={height ? { minHeight: height } : undefined}
      aria-label="Loading..."
    >
      <div className="h-4 w-1/3 bg-[#E2E8F0] rounded-md mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-[#F1F5F9] rounded-md mb-2.5 last:mb-0"
          style={{ width: `${85 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

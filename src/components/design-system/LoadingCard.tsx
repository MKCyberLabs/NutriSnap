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
      className={`rounded-[14px] border border-[#E5ECE8] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] animate-pulse ${className}`}
      style={height ? { minHeight: height } : undefined}
      aria-label="Loading..."
    >
      <div className="h-4 w-1/3 bg-[#E5ECE8] rounded-md mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-[#F0F4F2] rounded-md mb-2.5 last:mb-0"
          style={{ width: `${85 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

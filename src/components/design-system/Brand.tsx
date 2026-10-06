import React from 'react';
import Link from 'next/link';
import { Leaf } from 'lucide-react';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  href?: string;
  className?: string;
}

export function Brand({
  size = 'md',
  showTagline = false,
  href = '/today',
  className = '',
}: BrandProps) {
  const iconSizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const leafSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${iconSizes[size]} rounded-xl bg-[#16A34A] text-white flex items-center justify-center shadow-sm shrink-0`}
        aria-hidden="true"
      >
        <Leaf className={`${leafSizes[size]} fill-white/20`} />
      </div>
      <div className="flex flex-col">
        <span className={`${textSizes[size]} font-bold tracking-tight text-[#111827] leading-none`}>
          NutriSnap
        </span>
        {showTagline && (
          <span className="text-[11px] font-medium text-[#667085] mt-1 leading-tight">
            Eat Well · Drink More · Manage Smart · Live Better
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded-xl"
        aria-label="NutriSnap Home"
      >
        {content}
      </Link>
    );
  }

  return content;
}

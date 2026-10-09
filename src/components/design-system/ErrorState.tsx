import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2]/50 ${className}`}
      role="alert"
    >
      <div className="h-10 w-10 rounded-full bg-[#FEF2F2] flex items-center justify-center text-[#DC2626] mb-2" aria-hidden="true">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#DC2626]">{title}</h3>
      <p className="text-xs text-[#64748B] mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-3 text-xs rounded-xl border-[#E2E8F0] bg-white hover:bg-slate-50"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

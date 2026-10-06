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
      className={`flex flex-col items-center justify-center text-center p-6 rounded-[14px] border border-[#F9C6C6] bg-[#FDECEC]/40 ${className}`}
      role="alert"
    >
      <div className="h-10 w-10 rounded-full bg-[#FDECEC] flex items-center justify-center text-[#EF4444] mb-2" aria-hidden="true">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#B42318]">{title}</h3>
      <p className="text-xs text-[#667085] mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-3 text-xs rounded-lg border-[#E5ECE8] bg-white hover:bg-slate-50"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

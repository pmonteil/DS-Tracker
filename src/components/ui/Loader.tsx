'use client';

import { Loader2 } from 'lucide-react';

interface LoaderProps {
  message?: string;
  className?: string;
}

export function Loader({ message, className = '' }: LoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-muted" strokeWidth={1.5} />
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-3 py-2 text-sm
            bg-surface border border-gray-200 rounded-xl
            text-foreground placeholder:text-subtle
            focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400
            transition-colors
            ${error ? 'border-red-300' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-danger-text">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

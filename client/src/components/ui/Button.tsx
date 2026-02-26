'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'up' | 'down' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
          {
            'bg-brand-600 hover:bg-brand-700 text-white': variant === 'primary',
            'bg-surface-700 hover:bg-surface-700/80 text-surface-50 border border-surface-700': variant === 'secondary',
            'bg-trade-up hover:bg-trade-up/90 text-white': variant === 'up',
            'bg-trade-down hover:bg-trade-down/90 text-white': variant === 'down',
            'bg-transparent hover:bg-surface-700/50 text-surface-200': variant === 'ghost',
          },
          {
            'py-2 px-4 text-sm': size === 'sm',
            'py-3 px-6 text-base': size === 'md',
            'py-4 px-8 text-lg': size === 'lg',
          },
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

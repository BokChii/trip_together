import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai-planner';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md motion-safe:active:scale-[0.98] motion-safe:active:translate-y-0';

  const variants = {
    primary: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500/40',
    secondary:
      'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 focus:ring-stone-300/40',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500/40',
    ghost: 'bg-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-800',
    'ai-planner':
      'bg-white text-orange-600 border border-stone-200 hover:border-orange-300 hover:bg-orange-50 focus:ring-orange-300/40',
  };

  const sizes = {
    sm: 'px-4 py-2 min-h-[44px] text-xs sm:text-sm',
    md: 'px-5 py-2.5 min-h-[44px] text-sm',
    lg: 'px-6 py-3 min-h-[48px] text-sm sm:text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          처리 중...
        </span>
      ) : (
        children
      )}
    </button>
  );
};

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
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
  // rounded-full로 변경하여 더 귀여운 느낌
  const baseStyles = "inline-flex items-center justify-center rounded-full font-bold transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none shadow-sm";
  
  const variants = {
    // 오렌지/코랄 테마
    primary: "bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-400 shadow-orange-200",
    secondary: "bg-white text-gray-700 border-2 border-orange-100 hover:border-orange-200 hover:bg-orange-50 focus:ring-orange-300",
    danger: "bg-rose-400 text-white hover:bg-rose-500 focus:ring-rose-400",
    ghost: "bg-transparent text-gray-600 hover:bg-orange-50 hover:text-orange-600",
  };

  const sizes = {
    sm: "px-4 py-1.5 text-xs sm:text-sm",
    md: "px-6 py-2.5 text-sm sm:text-base",
    lg: "px-8 py-3.5 text-base sm:text-lg",
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          고민중...
        </span>
      ) : children}
    </button>
  );
};
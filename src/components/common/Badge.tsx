import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'loot' | 'discount' | 'store' | 'verified' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full tracking-tight transition-colors';
  
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    default: 'bg-stone-100 text-stone-800 border border-[#EAE6DF]',
    loot: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs font-bold',
    discount: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-bold',
    store: 'bg-amber-50 text-amber-900 border border-amber-200/80',
    verified: 'bg-stone-100 text-stone-600 border border-stone-200',
    neutral: 'bg-[#F2EFE9] text-stone-700 border border-[#EAE6DF]',
  };

  return (
    <span
      className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
      {...props}
    >
      {children}
    </span>
  );
};

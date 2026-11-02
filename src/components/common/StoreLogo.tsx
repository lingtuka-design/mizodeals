import React from 'react';
import { Store as StoreIcon } from 'lucide-react';
import type { StoreType } from '../../types';

interface StoreLogoProps {
  store?: StoreType | 'all' | string;
  className?: string;
}

export const StoreLogo: React.FC<StoreLogoProps> = ({ store = 'all', className = 'w-4 h-4' }) => {
  const cleanStore = (store || 'all').toLowerCase().trim();

  switch (cleanStore) {
    case 'amazon':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Amazon">
          <rect width="24" height="24" rx="5" fill="#232F3E" />
          <path
            d="M17.5 15.6C15.1 17.4 11.6 18 8 16.7C6.1 16 4.6 14.8 3.6 13.6C3.5 13.5 3.6 13.3 3.8 13.4C6.2 14.4 9.1 14.9 12 14.6C14.2 14.3 16.3 13.5 17.8 12.3C18 12.1 18.3 12.4 18.1 12.6C17.1 13.5 15.7 14.3 14.2 14.8M18.1 14.9C17.9 14.7 17 14 16.9 13.3C16.8 12.9 17 12.7 17.4 12.7C18 12.7 19.1 13.7 19.4 14.1C19.5 14.3 19.4 14.5 19.2 14.6C18.9 14.8 18.4 15.3 18.1 14.9Z"
            fill="#FF9900"
          />
          <path
            d="M13.2 8.4C12.9 7.9 12.2 7.6 11.4 7.6C9.6 7.6 8.5 8.9 8.5 10.6C8.5 12.3 9.6 13.6 11.4 13.6C12.2 13.6 12.9 13.3 13.2 12.8V13.4H14.5V7.8H13.2V8.4ZM11.5 12.4C10.4 12.4 9.8 11.6 9.8 10.6C9.8 9.6 10.4 8.8 11.5 8.8C12.6 8.8 13.2 9.6 13.2 10.6C13.2 11.6 12.6 12.4 11.5 12.4Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'flipkart':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Flipkart">
          <rect width="24" height="24" rx="5" fill="#2874F0" />
          <path
            d="M16.5 7.5H14.2V6.2C14.2 5.2 13.4 4.5 12.4 4.5H11.6C10.6 4.5 9.8 5.2 9.8 6.2V7.5H7.5C6.7 7.5 6 8.2 6 9L7.2 18.5C7.3 19.3 8 20 8.8 20H15.2C16 20 16.7 19.3 16.8 18.5L18 9C18 8.2 17.3 7.5 16.5 7.5ZM11 6.2C11 5.9 11.3 5.7 11.6 5.7H12.4C12.7 5.7 13 5.9 13 6.2V7.5H11V6.2Z"
            fill="#FFE11B"
          />
          <path
            d="M13.2 10.5H10.5V17H11.7V14.2H12.9V13.1H11.7V11.6H13.2V10.5Z"
            fill="#2874F0"
          />
        </svg>
      );

    case 'meesho':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Meesho">
          <rect width="24" height="24" rx="5" fill="#9B2060" />
          <path
            d="M6.5 16.8V10.2C6.5 8.7 7.6 7.5 9.1 7.5C10.1 7.5 11 8.1 11.5 8.9C12 8.1 12.9 7.5 13.9 7.5C15.4 7.5 16.5 8.7 16.5 10.2V16.8H14.5V10.5C14.5 9.8 14 9.3 13.3 9.3C12.6 9.3 12.1 9.8 12.1 10.5V16.8H10.1V10.5C10.1 9.8 9.6 9.3 8.9 9.3C8.2 9.3 7.7 9.8 7.7 10.5V16.8H6.5Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'myntra':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Myntra">
          <rect width="24" height="24" rx="5" fill="#FFFFFF" stroke="#EAE6DF" strokeWidth="0.8" />
          <path
            d="M5.5 17L8.8 8C9.2 6.8 10.8 6.8 11.2 8L12 10.5L9.5 17H5.5Z"
            fill="#F26A36"
          />
          <path
            d="M8.5 17L11.5 9C11.8 8 13.2 8 13.5 9L15.5 15L13.8 17H8.5Z"
            fill="#FF3F6C"
          />
          <path
            d="M12.5 17L15.2 8C15.6 6.8 17.2 6.8 17.6 8L19.5 17H15.5L14.2 13.5L12.5 17Z"
            fill="#E71F63"
          />
        </svg>
      );

    case 'nykaa':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Nykaa">
          <rect width="24" height="24" rx="5" fill="#FC2779" />
          <path
            d="M6.5 17.5V6.5H8.8L14.8 14.8V6.5H17.2V17.5H14.9L8.9 9.2V17.5H6.5Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'ajio':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Ajio">
          <rect width="24" height="24" rx="5" fill="#1F2430" />
          <path
            d="M12 5.8L6.5 18H8.8L10.2 14.6H13.8L15.2 18H17.5L12 5.8ZM10.8 13.1L12 10L13.2 13.1H10.8Z"
            fill="#FFFFFF"
          />
          <circle cx="17.2" cy="7.2" r="1.4" fill="#FFE11B" />
        </svg>
      );

    case 'all':
    default:
      return (
        <div className={`inline-flex items-center justify-center rounded bg-stone-200/80 text-stone-700 shrink-0 ${className}`}>
          <StoreIcon className="w-2.5 h-2.5" />
        </div>
      );
  }
};

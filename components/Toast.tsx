import React from 'react';
import { Check } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 bg-stone-900/90 text-white text-sm font-medium rounded-xl shadow-lg backdrop-blur-sm pointer-events-none toast-enter"
    >
      <Check className="w-4 h-4 text-green-400 flex-shrink-0" strokeWidth={2.5} />
      <span>{message}</span>
    </div>
  );
};

import React from 'react';
import { Check, X } from 'lucide-react';
import { VoteType } from '../types';

interface ModeToggleProps {
  mode: VoteType;
  setMode: (mode: VoteType) => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, setMode }) => {
  return (
    <div className="flex bg-stone-100 border border-stone-200/80 p-1 rounded-lg">
      <button
        onClick={() => setMode('available')}
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-md text-xs sm:text-sm font-medium transition-colors ${
          mode === 'available'
            ? 'bg-orange-600 text-white'
            : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
        }`}
      >
        <Check className="w-4 h-4" strokeWidth={2.5} />
        <span className="hidden xs:inline">가능해요</span>
        <span className="xs:hidden">가능</span>
      </button>
      <button
        onClick={() => setMode('unavailable')}
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-md text-xs sm:text-sm font-medium transition-colors ${
          mode === 'unavailable'
            ? 'bg-stone-600 text-white'
            : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
        }`}
      >
        <X className="w-4 h-4" strokeWidth={2.5} />
        <span className="hidden xs:inline">안돼요</span>
        <span className="xs:hidden">불가</span>
      </button>
    </div>
  );
};

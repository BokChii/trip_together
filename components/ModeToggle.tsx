import React from 'react';
import { Check, X } from 'lucide-react';
import { VoteType } from '../types';

interface ModeToggleProps {
  mode: VoteType;
  setMode: (mode: VoteType) => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, setMode }) => {
  return (
    <div className="flex bg-white border border-gray-100 p-1.5 rounded-full shadow-sm">
      <button
        onClick={() => setMode('available')}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
          mode === 'available'
            ? 'bg-orange-400 text-white shadow-md transform scale-105'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Check className="w-4 h-4" strokeWidth={3} />
        가능해요
      </button>
      <button
        onClick={() => setMode('unavailable')}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
          mode === 'unavailable'
            ? 'bg-gray-400 text-white shadow-md transform scale-105'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
      >
        <X className="w-4 h-4" strokeWidth={3} />
        안돼요
      </button>
    </div>
  );
};
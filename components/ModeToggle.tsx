import React from 'react';
import { Check, X } from 'lucide-react';
import { VoteType } from '../types';

interface ModeToggleProps {
  mode: VoteType;
  setMode: (mode: VoteType) => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, setMode }) => {
  return (
    <div className="flex bg-gray-100 p-1 rounded-lg">
      <button
        onClick={() => setMode('available')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === 'available'
            ? 'bg-white text-green-700 shadow-sm ring-1 ring-black/5'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Check className="w-4 h-4" />
        가능
      </button>
      <button
        onClick={() => setMode('unavailable')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === 'unavailable'
            ? 'bg-white text-rose-700 shadow-sm ring-1 ring-black/5'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <X className="w-4 h-4" />
        불가능
      </button>
    </div>
  );
};
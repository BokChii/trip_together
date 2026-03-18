import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchAirports, AirportOption } from '../services/airportSearchService';

interface AirportAutocompleteInputProps {
  value: AirportOption | null;
  onChange: (option: AirportOption | null) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

const DEBOUNCE_MS = 350;

export const AirportAutocompleteInput: React.FC<AirportAutocompleteInputProps> = ({
  value,
  onChange,
  placeholder = '공항 코드 또는 도시명 검색',
  className = '',
  'aria-label': ariaLabel,
}) => {
  const [inputText, setInputText] = useState(value ? `${value.name} (${value.code})` : '');
  const [options, setOptions] = useState<AirportOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // value가 외부에서 변경되면 inputText 동기화
  useEffect(() => {
    if (value) {
      setInputText(`${value.name} (${value.code})`);
    } else {
      setInputText('');
    }
  }, [value?.code]);

  const fetchOptions = useCallback(async (keyword: string) => {
    if (keyword.trim().length < 2) {
      setOptions([]);
      return;
    }
    setIsLoading(true);
    try {
      const results = await searchAirports(keyword);
      setOptions(results);
      setHighlightIndex(-1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = inputText.trim();
    if (trimmed.length < 2) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchOptions(trimmed), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputText, fetchOptions]);

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 150);
  };

  const handleFocus = () => {
    if (options.length > 0) setIsOpen(true);
  };

  const handleSelect = (opt: AirportOption) => {
    onChange(opt);
    setInputText(`${opt.name} (${opt.code})`);
    setIsOpen(false);
    setOptions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputText(v);
    if (v.trim().length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      onChange(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || options.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < options.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : options.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && options[highlightIndex]) {
        handleSelect(options[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const baseInputClass =
    'w-full px-4 py-2.5 rounded-lg bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-sm text-gray-900';

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="airport-listbox"
        aria-activedescendant={highlightIndex >= 0 ? `airport-opt-${highlightIndex}` : undefined}
        className={baseInputClass}
        autoComplete="off"
      />
      {isLoading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </span>
      )}
      {isOpen && (options.length > 0 || isLoading) && (
        <ul
          id="airport-listbox"
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 custom-scrollbar"
        >
          {options.map((opt, i) => (
            <li
              key={`${opt.code}-${i}`}
              id={`airport-opt-${i}`}
              role="option"
              aria-selected={i === highlightIndex}
              className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                i === highlightIndex ? 'bg-orange-50 text-orange-700' : 'text-gray-800 hover:bg-gray-50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
            >
              <span className="font-medium">{opt.name}</span>
              <span className="text-gray-500 ml-2">({opt.code})</span>
              {(opt.city || opt.country) && (
                <span className="text-gray-400 text-xs ml-2">
                  {[opt.city, opt.country].filter(Boolean).join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

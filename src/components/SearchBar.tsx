import { useState, useCallback, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { listen } from '@tauri-apps/api/event';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  compact?: boolean;
}

export function SearchBar({ value, onChange, placeholder = 'Search my mind...', isLoading, compact }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<number>();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = window.setTimeout(() => {
      onChange(newValue);
    }, 300);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for focus-search event from menu bar (⌘F)
  useEffect(() => {
    const unlisten = listen('focus-search', () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-stone-700 placeholder-stone-300 outline-none border-none ring-0 focus:outline-none focus:border-none focus:ring-0 font-light tracking-tight transition-all duration-300"
          style={{ 
            fontSize: compact ? 'clamp(1.5rem, 3.5vw, 2.5rem)' : 'clamp(2rem, 5vw, 3.5rem)',
            fontFamily: "'Newsreader', 'Georgia', serif",
            fontStyle: 'italic',
          }}
        />

        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
          {isLoading && (
            <div className={`border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin transition-all duration-300 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
          )}

          {localValue && !isLoading && (
            <button
              onClick={handleClear}
              className="p-2 text-stone-300 hover:text-stone-500 transition-colors"
            >
              <XMarkIcon className={`transition-all duration-300 ${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


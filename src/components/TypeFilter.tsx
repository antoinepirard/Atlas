import type { ItemType } from '../types';

interface TypeFilterProps {
  value: ItemType | null;
  onChange: (type: ItemType | null) => void;
}

const filters: { type: ItemType | null; label: string }[] = [
  { type: null, label: 'Everything' },
  { type: 'url', label: 'Links' },
  { type: 'image', label: 'Images' },
  { type: 'note', label: 'Notes' },
];

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <div className="flex items-center gap-1">
      {filters.map(({ type, label }) => {
        const isActive = value === type;
        return (
          <button
            key={label}
            onClick={() => onChange(type)}
            className={`px-3 py-1.5 bg-white text-sm transition-all rounded-full ${
              isActive
                ? 'text-orange-600 border-b-2 border-orange-500 font-medium'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}


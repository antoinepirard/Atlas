import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { Space } from "../types";

interface SpaceSelectorProps {
  spaces: Space[];
  selectedSpaceIds: string[];
  onToggleSpace: (spaceId: string) => void;
  onCreateSpace?: () => void;
  compact?: boolean;
}

export function SpaceSelector({
  spaces,
  selectedSpaceIds,
  onToggleSpace,
  onCreateSpace,
  compact = false,
}: SpaceSelectorProps) {
  if (spaces.length === 0 && !onCreateSpace) {
    return (
      <p className="text-sm text-stone-400 italic">No spaces created yet</p>
    );
  }

  return (
    <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
      {spaces.map((space) => {
        const isSelected = selectedSpaceIds.includes(space.id);
        return (
          <button
            key={space.id}
            onClick={() => onToggleSpace(space.id)}
            className={`flex items-center gap-1.5 rounded-full transition-colors ${
              compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
            } ${
              isSelected
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent"
            }`}
          >
            <span
              className={`rounded-full flex-shrink-0 ${
                compact ? "w-1.5 h-1.5" : "w-2 h-2"
              }`}
              style={{ backgroundColor: space.color }}
            />
            <span className="font-medium">{space.name}</span>
            {isSelected && (
              <CheckIcon className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
            )}
          </button>
        );
      })}
      {onCreateSpace && (
        <button
          onClick={onCreateSpace}
          className={`flex items-center gap-1 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-600 transition-colors border border-transparent ${
            compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
          }`}
        >
          <PlusIcon className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
          <span className="font-medium">New</span>
        </button>
      )}
    </div>
  );
}

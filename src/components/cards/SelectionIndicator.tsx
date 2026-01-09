import { CheckIcon } from "@heroicons/react/24/outline";
import type { SelectionIndicatorProps } from "./types";

export function SelectionIndicator({
  isMultiSelectMode,
  isSelected,
}: SelectionIndicatorProps) {
  if (!isMultiSelectMode) return null;

  return (
    <div
      className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
        isSelected
          ? "bg-amber-500 border-amber-500 scale-100"
          : "bg-white/80 border-stone-300 scale-90 opacity-70 group-hover:opacity-100 group-hover:scale-100"
      }`}
    >
      {isSelected && <CheckIcon className="w-4 h-4 text-white stroke-[3]" />}
    </div>
  );
}

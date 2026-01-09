import { motion } from "motion/react";
import {
  Cog6ToothIcon,
  LockClosedIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { SearchBar } from "../SearchBar";
import { TypeFilter } from "../TypeFilter";
import type { ItemType, ParsedQuery } from "../../types";

interface AtlasHeaderProps {
  isScrolled: boolean;
  filterType: ItemType | null;
  onFilterType: (value: ItemType | null) => void;
  searchQuery: string;
  onSearch: (value: string, parsed?: ParsedQuery) => void;
  isSearching: boolean;
  allTags: string[];
  onOpenSettings: () => void;
  onOpenAdd: () => void;
  onLock: () => void;
  autoLockMinutes: number;
  onToggleMaximize: () => void;
}

export function AtlasHeader({
  isScrolled,
  filterType,
  onFilterType,
  searchQuery,
  onSearch,
  isSearching,
  allTags,
  onOpenSettings,
  onOpenAdd,
  onLock,
  autoLockMinutes,
  onToggleMaximize,
}: AtlasHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-stone-100/95 backdrop-blur-sm border-b border-stone-200/50">
      <div
        data-tauri-drag-region
        onDoubleClick={onToggleMaximize}
        className="h-7 w-full cursor-default select-none"
      />

      <div className="flex items-center justify-between px-4 py-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-lg transition-colors"
          title="Settings"
        >
          <Cog6ToothIcon className="w-5 h-5" />
        </motion.button>

        <div className="flex items-center gap-3">
          <TypeFilter value={filterType} onChange={onFilterType} />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenAdd}
            title="Add content (⌘N)"
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLock}
            className="group relative p-2 text-stone-400 hover:text-stone-600 transition-colors"
            title={`Lock vault (auto-locks in ${autoLockMinutes} min)`}
          >
            <LockClosedIcon className="w-5 h-5" />
            <span className="absolute -bottom-8 right-0 px-2 py-1 text-xs text-stone-500 bg-white rounded shadow-sm border border-stone-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Auto-lock: {autoLockMinutes}min
            </span>
          </motion.button>
        </div>
      </div>

      <div
        className={`px-6 max-w-[1800px] mx-auto transition-all duration-300 ${
          isScrolled ? "pb-3 pt-1" : "pb-6 pt-2"
        }`}
      >
        <SearchBar
          value={searchQuery}
          onChange={onSearch}
          isLoading={isSearching}
          placeholder="Search..."
          compact={isScrolled}
          existingTags={allTags}
        />
      </div>
    </header>
  );
}

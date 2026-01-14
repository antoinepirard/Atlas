import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDownIcon,
  Cog6ToothIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { Space } from "../types";

interface SpaceSwitcherProps {
  spaces: Space[];
  currentSpaceId: string | null;
  onSelectSpace: (spaceId: string | null) => void;
  onManageSpaces: () => void;
}

export function SpaceSwitcher({
  spaces,
  currentSpaceId,
  onSelectSpace,
  onManageSpaces,
}: SpaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const currentSpace = currentSpaceId
    ? spaces.find((s) => s.id === currentSpaceId)
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-stone-200/50 transition-colors"
      >
        {currentSpace ? (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentSpace.color }}
            />
            <span className="text-sm font-medium text-stone-700 max-w-[120px] truncate">
              {currentSpace.name}
            </span>
          </>
        ) : (
          <>
            <Squares2X2Icon className="w-4 h-4 text-stone-500" />
            <span className="text-sm font-medium text-stone-600">
              All Spaces
            </span>
          </>
        )}
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-stone-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-50"
          >
            {/* All Spaces option */}
            <button
              onClick={() => {
                onSelectSpace(null);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors ${
                currentSpaceId === null ? "bg-amber-50" : ""
              }`}
            >
              <Squares2X2Icon className="w-4 h-4 text-stone-400" />
              <span className="text-sm text-stone-700 font-medium">
                All Spaces
              </span>
              {currentSpaceId === null && (
                <span className="ml-auto text-xs text-amber-600">Active</span>
              )}
            </button>

            {spaces.length > 0 && (
              <div className="border-t border-stone-100 my-1" />
            )}

            {/* Space list */}
            {spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => {
                  onSelectSpace(space.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors ${
                  currentSpaceId === space.id ? "bg-amber-50" : ""
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: space.color }}
                />
                <span className="text-sm text-stone-700 truncate flex-1">
                  {space.name}
                </span>
                {currentSpaceId === space.id && (
                  <span className="text-xs text-amber-600">Active</span>
                )}
              </button>
            ))}

            <div className="border-t border-stone-100 my-1" />

            {/* Manage spaces button */}
            <button
              onClick={() => {
                onManageSpaces();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors text-stone-500"
            >
              <Cog6ToothIcon className="w-4 h-4" />
              <span className="text-sm">Manage Spaces</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

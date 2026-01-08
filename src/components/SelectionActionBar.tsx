import { motion, AnimatePresence } from "motion/react";
import {
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface SelectionActionBarProps {
  selectedCount: number;
  onEnrich: () => void;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
  isEnriching?: boolean;
}

export function SelectionActionBar({
  selectedCount,
  onEnrich,
  onDelete,
  onClear,
  isDeleting,
  isEnriching,
}: SelectionActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-stone-900 rounded-2xl shadow-2xl shadow-black/30">
              {/* Selection count */}
              <div className="flex items-center gap-2 pr-3 border-r border-stone-700">
                <span className="text-sm font-medium text-white">
                  {selectedCount} selected
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onEnrich}
                  disabled={isEnriching}
                  className="flex items-center gap-2 px-3 py-1.5 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isEnriching ? (
                    <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <SparklesIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {isEnriching ? "Enriching" : "Enrich"}
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <TrashIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">Delete</span>
                </motion.button>
              </div>

              {/* Clear selection */}
              <div className="pl-2 border-l border-stone-700">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClear}
                  className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                  title="Clear selection (Esc)"
                >
                  <XMarkIcon className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

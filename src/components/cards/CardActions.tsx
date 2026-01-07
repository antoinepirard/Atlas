import { motion } from "motion/react";
import {
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import type { CardActionsProps } from "./types";

export function CardActions({
  showMenu,
  isMultiSelectMode,
  isDeleting,
  onDelete,
  externalUrl,
  isDark = false,
}: CardActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: showMenu && !isMultiSelectMode ? 1 : 0 }}
      className="absolute top-2 right-2 flex items-center gap-1 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-600 hover:text-stone-800 rounded-lg shadow-sm transition-colors"
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </a>
      )}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className={`p-1.5 backdrop-blur-sm rounded-lg shadow-sm transition-colors disabled:opacity-50 ${
          isDark
            ? "bg-stone-800/90 text-stone-400 hover:text-red-400"
            : "bg-white/90 text-stone-400 hover:text-red-500"
        }`}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
}


import { useMemo } from "react";
import { motion } from "motion/react";
import {
  DocumentTextIcon,
  CodeBracketIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import type { BaseCardProps } from "./types";
import { useCardState } from "./useCardState";
import { SelectionIndicator } from "./SelectionIndicator";
import { CardActions } from "./CardActions";
import { formatDate, getDomain } from "./utils";
import { NoteContent } from "../CodeBlock";
import { detectCode } from "../../utils/codeDetection";

export function NoteCard({
  item,
  onDelete,
  onClick,
  isSelected,
  isMultiSelectMode,
  onSelect,
}: BaseCardProps) {
  const {
    showMenu,
    isDeleting,
    handleClick,
    handleContextMenu,
    handleDelete,
    handleHoverStart,
    handleHoverEnd,
  } = useCardState({
    item,
    onDelete,
    onClick,
    isMultiSelectMode,
    onSelect,
  });

  // Detect if content is code
  const isCode = useMemo(() => {
    return detectCode(item.content).isCode;
  }, [item.content]);

  return (
    <motion.div
      layout
      className={`group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
        isCode
          ? "bg-[#1e1e2e] border border-stone-700/50"
          : "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50"
      } ${isSelected ? "ring-2 ring-amber-500" : ""}`}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <SelectionIndicator
        isMultiSelectMode={isMultiSelectMode}
        isSelected={isSelected}
      />

      <div className="p-4">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${
            isCode ? "bg-violet-500/20" : "bg-amber-100"
          }`}
        >
          {isCode ? (
            <CodeBracketIcon className="w-4 h-4 text-violet-400" />
          ) : (
            <DocumentTextIcon className="w-4 h-4 text-amber-600" />
          )}
        </div>

        <div className="mb-3">
          <NoteContent content={item.content} compact maxLines={6} />
        </div>

        <div
          className={`flex items-center gap-2 text-[10px] ${
            isCode ? "text-stone-500" : "text-stone-400"
          }`}
        >
          <span>{formatDate(item.created_at)}</span>
          {item.source_url && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 truncate">
                <LinkIcon className="w-3 h-3" />
                {getDomain(item.source_url)}
              </span>
            </>
          )}
        </div>
      </div>

      <CardActions
        showMenu={showMenu}
        isMultiSelectMode={isMultiSelectMode}
        isDeleting={isDeleting}
        onDelete={handleDelete}
        isDark={isCode}
      />
    </motion.div>
  );
}


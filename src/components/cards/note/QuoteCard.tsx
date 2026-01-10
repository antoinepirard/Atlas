import { useMemo } from "react";
import { motion } from "motion/react";
import { LinkIcon } from "@heroicons/react/24/outline";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

export function QuoteCard({
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

  // Parse quote content
  const quoteContent = useMemo(() => {
    let text = item.content.trim();

    // Remove leading quote characters and blockquote markers
    text = text.replace(/^[">'"']+\s*/gm, "");
    text = text.trim();

    // Remove trailing quote characters
    text = text.replace(/['"'"]+$/g, "");

    return text;
  }, [item.content]);

  // Extract potential attribution if last line starts with common attribution patterns
  const { quote, attribution } = useMemo(() => {
    const lines = quoteContent.split("\n");
    const lastLine = lines[lines.length - 1]?.trim() || "";

    // Check if last line looks like an attribution
    const isAttribution =
      lastLine.startsWith("—") ||
      lastLine.startsWith("-") ||
      lastLine.startsWith("~") ||
      lastLine.toLowerCase().startsWith("by ") ||
      lastLine.startsWith("– ");

    if (isAttribution && lines.length > 1) {
      return {
        quote: lines.slice(0, -1).join("\n").trim(),
        attribution: lastLine.replace(/^[—\-~–]\s*/, "").replace(/^by\s*/i, ""),
      };
    }

    return { quote: quoteContent, attribution: null };
  }, [quoteContent]);

  return (
    <motion.div
      layout
      className={`group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100/50 ${
        isSelected ? "ring-2 ring-amber-500" : ""
      }`}
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
        {/* Large quote mark */}
        <div className="text-5xl text-purple-200 font-serif leading-none mb-2 select-none">
          "
        </div>

        {/* Quote text */}
        <blockquote className="text-sm text-stone-700 leading-relaxed line-clamp-4 mb-3 italic">
          {quote}
        </blockquote>

        {/* Attribution */}
        {attribution && (
          <div className="text-xs text-purple-600 font-medium mb-3">
            — {attribution}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 text-[10px] text-stone-400">
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
      />
    </motion.div>
  );
}

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { LinkIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { BaseCardProps } from "./types";
import { useCardState } from "./useCardState";
import { SelectionIndicator } from "./SelectionIndicator";
import { CardActions } from "./CardActions";
import { formatDate, getDomain } from "./utils";

export function UrlCard({
  item,
  onDelete,
  onClick,
  isSelected,
  isMultiSelectMode,
  onSelect,
}: BaseCardProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when image URL changes
  useEffect(() => {
    setImageError(false);
  }, [item.image_url]);

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

  return (
    <motion.div
      layout
      className={`group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 cursor-pointer ${
        isSelected ? "ring-2 ring-amber-500" : "ring-stone-200/50"
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

      {item.image_url && !imageError && (
        <div className="block overflow-hidden bg-stone-100">
          <img
            src={item.image_url}
            alt={item.title || "Link preview"}
            className="w-full max-h-64 object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      <div className="p-4">
        <div className="block">
          {item.title && (
            <h3 className="text-sm font-medium text-stone-800 mb-1 line-clamp-2 group-hover:text-amber-600 transition-colors">
              {item.title}
            </h3>
          )}
          {item.description && (
            <p className="text-xs text-stone-500 line-clamp-2 mb-2">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-400">
          {item.is_article ? (
            <DocumentTextIcon
              className="w-3.5 h-3.5 text-amber-500"
              title="Article - Reader Mode available"
            />
          ) : (
            <LinkIcon className="w-3.5 h-3.5" />
          )}
          <span className="truncate">{getDomain(item.content)}</span>
          <span>·</span>
          <span>{formatDate(item.created_at)}</span>
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

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { DocumentTextIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

export function ArticleCard({
  item,
  onDelete,
  onClick,
  isSelected,
  isMultiSelectMode,
  onSelect,
}: BaseCardProps) {
  const [imageError, setImageError] = useState(false);

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

  // Get publication name from domain
  const publicationName = useMemo(() => {
    const domain = getDomain(item.content);
    if (domain.includes("medium")) return "Medium";
    if (domain.includes("substack")) return "Substack";
    if (domain.includes("nytimes")) return "NY Times";
    if (domain.includes("washingtonpost")) return "Washington Post";
    if (domain.includes("theguardian")) return "The Guardian";
    if (domain.includes("bbc")) return "BBC";
    if (domain.includes("techcrunch")) return "TechCrunch";
    if (domain.includes("theverge")) return "The Verge";
    if (domain.includes("arstechnica")) return "Ars Technica";
    if (domain.includes("wired")) return "Wired";
    if (domain.includes("dev.to")) return "DEV Community";
    if (domain.includes("hackernoon")) return "HackerNoon";
    return domain;
  }, [item.content]);

  // Check if reader mode is available
  const hasReaderMode = item.is_article && item.article_content;

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
            alt={item.title || "Article preview"}
            className="w-full max-h-48 object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      <div className="p-4">
        {item.title && (
          <h3 className="text-sm font-medium text-stone-800 mb-2 line-clamp-2 group-hover:text-amber-600 transition-colors leading-snug">
            {item.title}
          </h3>
        )}

        {item.summary && (
          <p className="text-xs text-stone-500 line-clamp-2 mb-3 leading-relaxed">
            {item.summary}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <DocumentTextIcon className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium">{publicationName}</span>
            <span>·</span>
            <span>{formatDate(item.created_at)}</span>
          </div>

          {hasReaderMode && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <BookOpenIcon className="w-3.5 h-3.5" />
              <span>Reader</span>
            </div>
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

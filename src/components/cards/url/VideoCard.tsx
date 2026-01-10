import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { PlayIcon } from "@heroicons/react/24/solid";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

export function VideoCard({
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

  // Get platform name from domain
  const platformName = useMemo(() => {
    const domain = getDomain(item.content);
    if (domain.includes("youtube") || domain.includes("youtu.be"))
      return "YouTube";
    if (domain.includes("vimeo")) return "Vimeo";
    if (domain.includes("twitch")) return "Twitch";
    if (domain.includes("tiktok")) return "TikTok";
    if (domain.includes("dailymotion")) return "Dailymotion";
    return "Video";
  }, [item.content]);

  return (
    <motion.div
      layout
      className={`group relative bg-stone-900 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 cursor-pointer ${
        isSelected ? "ring-2 ring-amber-500" : "ring-stone-700/50"
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

      {/* Video thumbnail with play overlay */}
      <div className="relative aspect-video bg-stone-800 overflow-hidden">
        {item.image_url && !imageError ? (
          <img
            src={item.image_url}
            alt={item.title || "Video thumbnail"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-800 to-stone-900">
            <PlayIcon className="w-16 h-16 text-stone-600" />
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <PlayIcon className="w-7 h-7 text-stone-800 ml-1" />
          </div>
        </div>
      </div>

      <div className="p-3">
        {item.title && (
          <h3 className="text-sm font-medium text-white mb-1 line-clamp-2 group-hover:text-amber-400 transition-colors">
            {item.title}
          </h3>
        )}

        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span className="text-amber-500 font-medium">{platformName}</span>
          <span>·</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
      </div>

      <CardActions
        showMenu={showMenu}
        isMultiSelectMode={isMultiSelectMode}
        isDeleting={isDeleting}
        onDelete={handleDelete}
        isDark
      />
    </motion.div>
  );
}

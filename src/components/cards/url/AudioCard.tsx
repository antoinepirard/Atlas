import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { PlayCircleIcon, MusicalNoteIcon } from "@heroicons/react/24/solid";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

export function AudioCard({
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

  // Get platform info from domain
  const platformInfo = useMemo(() => {
    const domain = getDomain(item.content);
    if (domain.includes("spotify"))
      return { name: "Spotify", color: "text-green-500" };
    if (domain.includes("apple") || domain.includes("podcasts.apple"))
      return { name: "Apple Podcasts", color: "text-purple-500" };
    if (domain.includes("soundcloud"))
      return { name: "SoundCloud", color: "text-orange-500" };
    if (domain.includes("overcast"))
      return { name: "Overcast", color: "text-orange-400" };
    if (domain.includes("pocketcasts"))
      return { name: "Pocket Casts", color: "text-red-500" };
    if (domain.includes("anchor"))
      return { name: "Anchor", color: "text-purple-400" };
    if (domain.includes("audible"))
      return { name: "Audible", color: "text-amber-500" };
    if (domain.includes("deezer"))
      return { name: "Deezer", color: "text-pink-500" };
    return { name: "Podcast", color: "text-amber-500" };
  }, [item.content]);

  return (
    <motion.div
      layout
      className={`group relative bg-gradient-to-br from-stone-900 to-stone-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 cursor-pointer ${
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

      <div className="flex p-4 gap-4">
        {/* Album/Podcast art */}
        <div className="relative flex-shrink-0">
          {item.image_url && !imageError ? (
            <img
              src={item.image_url}
              alt={item.title || "Podcast cover"}
              className="w-20 h-20 rounded-lg object-cover shadow-lg"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-stone-700 flex items-center justify-center">
              <MusicalNoteIcon className="w-8 h-8 text-stone-500" />
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircleIcon className="w-10 h-10 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {item.title && (
            <h3 className="text-sm font-medium text-white mb-1 line-clamp-2 group-hover:text-amber-400 transition-colors">
              {item.title}
            </h3>
          )}

          {item.description && (
            <p className="text-xs text-stone-400 line-clamp-1 mb-2">
              {item.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs">
            <span className={`font-medium ${platformInfo.color}`}>
              {platformInfo.name}
            </span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-500">
              {formatDate(item.created_at)}
            </span>
          </div>
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

import { motion } from "motion/react";
import type { XPostCardProps } from "./types";
import { useCardState } from "./useCardState";
import { SelectionIndicator } from "./SelectionIndicator";
import { CardActions } from "./CardActions";

export function XPostCard({
  item,
  onDelete,
  onClick,
  isSelected,
  isMultiSelectMode,
  onSelect,
  xPostInfo,
}: XPostCardProps) {
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

  const embedUrl = `https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${xPostInfo.postId}&theme=light`;

  return (
    <motion.div
      layout
      className={`group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 ${
        isSelected ? "ring-2 ring-amber-500" : "ring-stone-200/50"
      }`}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      onContextMenu={handleContextMenu}
    >
      <SelectionIndicator
        isMultiSelectMode={isMultiSelectMode}
        isSelected={isSelected}
      />

      {/* Embedded Tweet */}
      <div className="relative w-full" style={{ minHeight: "250px" }}>
        <iframe
          src={embedUrl}
          className="w-full border-0 pointer-events-none"
          style={{ minHeight: "250px", height: "350px" }}
          scrolling="no"
          loading="lazy"
        />

        {/* Click overlay to trigger preview modal */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={handleClick}
        />
      </div>

      <CardActions
        showMenu={showMenu}
        isMultiSelectMode={isMultiSelectMode}
        isDeleting={isDeleting}
        onDelete={handleDelete}
        externalUrl={item.content}
      />
    </motion.div>
  );
}


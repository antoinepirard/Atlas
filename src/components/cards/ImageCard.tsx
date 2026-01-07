import { motion } from "motion/react";
import type { BaseCardProps } from "./types";
import { useCardState } from "./useCardState";
import { SelectionIndicator } from "./SelectionIndicator";
import { CardActions } from "./CardActions";
import { formatDate } from "./utils";

export function ImageCard({
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

  const hasColors = item.colors && item.colors.length > 0;

  return (
    <motion.div
      layout
      className={`group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
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

      <div className="relative">
        <img
          src={item.image_url || item.content}
          alt={item.title || "Saved image"}
          className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showMenu ? 1 : 0 }}
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
        />

        <CardActions
          showMenu={showMenu}
          isMultiSelectMode={isMultiSelectMode}
          isDeleting={isDeleting}
          onDelete={handleDelete}
          externalUrl={item.content}
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showMenu ? 1 : 0, y: showMenu ? 0 : 10 }}
          className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between"
        >
          {/* Color palette */}
          {hasColors && (
            <div className="flex gap-0.5">
              {item.colors!.map((color, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full ring-1 ring-white/30 shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
          <span className="text-[10px] text-white/80 font-medium">
            {formatDate(item.created_at)}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}


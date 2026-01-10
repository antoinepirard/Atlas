import { useMemo } from "react";
import { motion } from "motion/react";
import {
  CheckCircleIcon,
  ListBulletIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

interface ChecklistItem {
  text: string;
  checked: boolean;
}

export function ChecklistCard({
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

  // Parse checklist items from content
  const checklistItems = useMemo((): ChecklistItem[] => {
    const lines = item.content.split("\n");
    const items: ChecklistItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for [ ] or [x] pattern
      const bracketMatch = trimmed.match(/^\[([xX ])\]\s*(.*)$/);
      if (bracketMatch) {
        items.push({
          text: bracketMatch[2],
          checked: bracketMatch[1].toLowerCase() === "x",
        });
        continue;
      }

      // Check for - [ ] or - [x] pattern
      const dashBracketMatch = trimmed.match(/^[-*]\s*\[([xX ])\]\s*(.*)$/);
      if (dashBracketMatch) {
        items.push({
          text: dashBracketMatch[2],
          checked: dashBracketMatch[1].toLowerCase() === "x",
        });
        continue;
      }

      // Check for - item or * item pattern
      const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (listMatch) {
        items.push({
          text: listMatch[1],
          checked: false,
        });
        continue;
      }

      // Check for numbered list: 1. item or 1) item
      const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (numberedMatch) {
        items.push({
          text: numberedMatch[1],
          checked: false,
        });
        continue;
      }
    }

    return items;
  }, [item.content]);

  // Calculate progress
  const completedCount = checklistItems.filter((i) => i.checked).length;
  const totalCount = checklistItems.length;
  const progressPercent =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <motion.div
      layout
      className={`group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 ${
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
        {/* Header with icon and progress */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-100">
            <ListBulletIcon className="w-4 h-4 text-emerald-600" />
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <span className="font-medium">
                {completedCount}/{totalCount}
              </span>
              <div className="w-12 h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Checklist items preview */}
        <div className="space-y-1.5 mb-3">
          {checklistItems.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              {item.checked ? (
                <CheckCircleIconSolid className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircleIcon className="w-4 h-4 text-stone-300 flex-shrink-0 mt-0.5" />
              )}
              <span
                className={`text-xs leading-tight line-clamp-1 ${
                  item.checked
                    ? "text-stone-400 line-through"
                    : "text-stone-700"
                }`}
              >
                {item.text}
              </span>
            </div>
          ))}
          {checklistItems.length > 5 && (
            <div className="text-xs text-stone-400 pl-6">
              +{checklistItems.length - 5} more items
            </div>
          )}
        </div>

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

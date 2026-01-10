import { useMemo } from "react";
import { motion } from "motion/react";
import { CodeBracketIcon, StarIcon } from "@heroicons/react/24/outline";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

export function CodeRepoCard({
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

  // Get platform name from domain
  const platformName = useMemo(() => {
    const domain = getDomain(item.content);
    if (domain.includes("github")) return "GitHub";
    if (domain.includes("gitlab")) return "GitLab";
    if (domain.includes("bitbucket")) return "Bitbucket";
    if (domain.includes("codepen")) return "CodePen";
    if (domain.includes("codesandbox")) return "CodeSandbox";
    if (domain.includes("replit")) return "Replit";
    if (domain.includes("stackblitz")) return "StackBlitz";
    return "Code";
  }, [item.content]);

  // Extract repo info from URL if GitHub
  const repoInfo = useMemo(() => {
    try {
      const url = new URL(item.content);
      if (url.hostname.includes("github.com")) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          return {
            owner: parts[0],
            repo: parts[1],
          };
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
    return null;
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

      {/* Code platform header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <CodeBracketIcon className="w-4 h-4 text-violet-400" />
        <span className="text-xs text-stone-400">{platformName}</span>
      </div>

      <div className="p-4 pt-0">
        {/* Repo name */}
        {repoInfo ? (
          <div className="mb-2">
            <span className="text-xs text-stone-500">{repoInfo.owner}/</span>
            <h3 className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors">
              {repoInfo.repo}
            </h3>
          </div>
        ) : item.title ? (
          <h3 className="text-sm font-medium text-white mb-2 line-clamp-2 group-hover:text-violet-400 transition-colors">
            {item.title}
          </h3>
        ) : null}

        {/* Description */}
        {item.description && (
          <p className="text-xs text-stone-400 line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-1">
            <StarIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-stone-400">Repository</span>
          </div>
          <span className="text-stone-600">·</span>
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

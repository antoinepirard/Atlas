import { useState, useCallback } from "react";
import { showItemContextMenu } from "../../lib/tauri";
import type { MymindItem } from "../../types";

interface UseCardStateOptions {
  item: MymindItem;
  onDelete: () => void;
  onClick?: () => void;
  isMultiSelectMode?: boolean;
  onSelect?: (id: string) => void;
}

interface UseCardStateReturn {
  showMenu: boolean;
  isDeleting: boolean;
  handleClick: (e: React.MouseEvent) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  handleDelete: () => Promise<void>;
  handleHoverStart: () => void;
  handleHoverEnd: () => void;
}

export function useCardState({
  item,
  onDelete,
  onClick,
  isMultiSelectMode,
  onSelect,
}: UseCardStateOptions): UseCardStateReturn {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isMultiSelectMode && onSelect) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(item.id);
      } else {
        onClick?.();
      }
    },
    [isMultiSelectMode, onSelect, onClick, item.id]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showItemContextMenu({
        itemId: item.id,
        showOpenExternal: item.type === "url" || item.type === "image",
        itemType: item.type,
      });
    },
    [item.id, item.type]
  );

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    await onDelete();
  }, [onDelete]);

  const handleHoverStart = useCallback(() => {
    setShowMenu(true);
  }, []);

  const handleHoverEnd = useCallback(() => {
    setShowMenu(false);
  }, []);

  return {
    showMenu,
    isDeleting,
    handleClick,
    handleContextMenu,
    handleDelete,
    handleHoverStart,
    handleHoverEnd,
  };
}


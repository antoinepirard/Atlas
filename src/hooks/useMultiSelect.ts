import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "../types";

interface UseMultiSelectOptions {
  items: Item[];
  deleteItems: (itemIds: string[]) => Promise<boolean>;
  enrichItems: (items: Item[]) => Promise<{ updated: number; failed: number }>;
}

interface UseMultiSelectResult {
  selectedIds: Set<string>;
  isMultiSelectMode: boolean;
  isDeleting: boolean;
  isEnriching: boolean;
  handleSelect: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  handleBulkDelete: () => Promise<void>;
  handleBulkEnrich: () => Promise<void>;
}

export function useMultiSelect({
  items,
  deleteItems,
  enrichItems,
}: UseMultiSelectOptions): UseMultiSelectResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const multiSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const multiSelectBlockedRef = useRef(false);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    if (items.length === 0) return;
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    await deleteItems(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsDeleting(false);
  }, [selectedIds, deleteItems]);

  const handleBulkEnrich = useCallback(async () => {
    if (selectedIds.size === 0 || isEnriching) return;

    if (selectedIds.size > 200) {
      const confirmed = window.confirm(
        `Enriching ${selectedIds.size} items may use a lot of AI credits. Continue?`
      );
      if (!confirmed) return;
    }

    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;

    setIsEnriching(true);
    try {
      await enrichItems(selectedItems);
    } finally {
      setIsEnriching(false);
    }
  }, [selectedIds, isEnriching, items, enrichItems]);

  useEffect(() => {
    const multiSelectDelayMs = 200;

    const clearMultiSelectTimer = () => {
      if (multiSelectTimerRef.current) {
        clearTimeout(multiSelectTimerRef.current);
        multiSelectTimerRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIds.size > 0) {
        clearSelection();
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isTypingTarget) {
        return;
      }

      if (e.key === "Meta" || e.key === "Control") {
        if (isMultiSelectMode || multiSelectTimerRef.current) {
          return;
        }

        multiSelectBlockedRef.current = false;
        multiSelectTimerRef.current = setTimeout(() => {
          multiSelectTimerRef.current = null;
          if (!multiSelectBlockedRef.current) {
            setIsMultiSelectMode(true);
          }
        }, multiSelectDelayMs);
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        multiSelectBlockedRef.current = true;
        clearMultiSelectTimer();
        setIsMultiSelectMode(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        multiSelectBlockedRef.current = false;
        clearMultiSelectTimer();
        setIsMultiSelectMode(false);
      }
    };

    const handleBlur = () => {
      multiSelectBlockedRef.current = false;
      clearMultiSelectTimer();
      setIsMultiSelectMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      clearMultiSelectTimer();
    };
  }, [selectedIds.size, clearSelection, isMultiSelectMode]);

  return {
    selectedIds,
    isMultiSelectMode,
    isDeleting,
    isEnriching,
    handleSelect,
    clearSelection,
    selectAll,
    handleBulkDelete,
    handleBulkEnrich,
  };
}

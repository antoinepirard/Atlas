import { useState, useCallback, useEffect, useRef } from "react";
import * as tauri from "../lib/tauri";
import type { Item } from "../types";

const PAGE_SIZE = 50;

export interface UseItemPaginationReturn {
  items: Item[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
}

export function useItemPagination(
  spaceId?: string | null
): UseItemPaginationReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadingRef = useRef(false);

  // Load initial page on mount or when spaceId changes
  useEffect(() => {
    const loadInitialItems = async () => {
      setIsLoading(true);
      try {
        const page = await tauri.getItemsPage(
          0,
          PAGE_SIZE,
          spaceId ?? undefined
        );
        setItems(page.items);
        setTotalCount(page.total);
        setHasMore(page.has_more);
        setCurrentPage(0);
      } catch (err) {
        console.error("Failed to load items:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialItems();
  }, [spaceId]);

  // Load more items (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setIsLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const page = await tauri.getItemsPage(
        nextPage,
        PAGE_SIZE,
        spaceId ?? undefined
      );

      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.has_more);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error("Failed to load more items:", err);
    } finally {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [currentPage, hasMore, spaceId]);

  // Refresh items (reset to first page)
  const refresh = useCallback(async () => {
    try {
      const page = await tauri.getItemsPage(0, PAGE_SIZE, spaceId ?? undefined);
      setItems(page.items);
      setTotalCount(page.total);
      setHasMore(page.has_more);
      setCurrentPage(0);
    } catch (err) {
      console.error("Failed to refresh items:", err);
    }
  }, [spaceId]);

  return {
    items,
    totalCount,
    hasMore,
    currentPage,
    isLoading,
    isLoadingMore,
    loadMore,
    refresh,
    setItems,
    setTotalCount,
  };
}

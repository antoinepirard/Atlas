import { useCallback, useMemo } from "react";
import type { Item } from "../types";
import { useItemPagination } from "./useItemPagination";
import { useItemSearch } from "./useItemSearch";
import { useItemOperations } from "./useItemOperations";

export function useAtlas() {
  const pagination = useItemPagination();
  const search = useItemSearch(pagination.items);

  // Create stable callbacks for operations
  const operationsCallbacks = useMemo(
    () => ({
      onItemAdded: (item: Item) => {
        pagination.setItems((prev) => [item, ...prev]);
      },
      onItemUpdated: (item: Item) => {
        pagination.setItems((prev) =>
          prev.map((i) => (i.id === item.id ? item : i))
        );
      },
      onItemDeleted: (id: string) => {
        pagination.setItems((prev) => prev.filter((i) => i.id !== id));
      },
      onItemsDeleted: (ids: string[]) => {
        pagination.setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      },
      onCountChange: (delta: number) => {
        pagination.setTotalCount((prev) => prev + delta);
      },
    }),
    [pagination.setItems, pagination.setTotalCount]
  );

  const operations = useItemOperations(operationsCallbacks);

  // Create a wrapped loadMore that respects search state
  const loadMore = useCallback(async () => {
    if (search.isSearching || search.searchQuery) return;
    await pagination.loadMore();
  }, [pagination.loadMore, search.isSearching, search.searchQuery]);

  return {
    // Items (filtered by search)
    items: search.filteredItems,
    totalCount: pagination.totalCount,
    hasMore: pagination.hasMore && !search.searchQuery, // Disable infinite scroll during search

    // Loading states
    isLoading: pagination.isLoading || operations.isLoading,
    isLoadingMore: pagination.isLoadingMore,
    isSearching: search.isSearching,

    // Error
    error: operations.error,

    // Search state
    searchQuery: search.searchQuery,
    filterType: search.filterType,
    allTags: search.allTags,

    // Operations
    addContent: operations.addContent,
    uploadImage: operations.uploadImage,
    deleteItem: operations.deleteItem,
    deleteItems: operations.deleteItems,
    updateItem: operations.updateItem,
    enrichItems: operations.enrichItems,

    // Search handlers
    handleSearch: search.handleSearch,
    handleFilterType: search.handleFilterType,

    // Pagination
    loadMore,
    refresh: pagination.refresh,
  };
}

import { useCallback, useMemo } from "react";
import type { Item } from "../types";
import { useItemPagination } from "./useItemPagination";
import { useItemSearch } from "./useItemSearch";
import { useItemOperations } from "./useItemOperations";
import { useSpaces } from "./useSpaces";

export function useAtlas() {
  const spacesState = useSpaces();
  const { currentSpaceId } = spacesState;

  const pagination = useItemPagination(currentSpaceId);
  const search = useItemSearch(pagination.items, currentSpaceId);
  const { setItems, setTotalCount, loadMore: loadMorePage } = pagination;

  // Create stable callbacks for operations
  const operationsCallbacks = useMemo(
    () => ({
      onItemAdded: (item: Item) => {
        setItems((prev) => [item, ...prev]);
      },
      onItemUpdated: (item: Item) => {
        setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      },
      onItemDeleted: (id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      },
      onItemsDeleted: (ids: string[]) => {
        setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      },
      onCountChange: (delta: number) => {
        setTotalCount((prev) => prev + delta);
      },
    }),
    [setItems, setTotalCount]
  );

  const operations = useItemOperations(operationsCallbacks);

  // Create a wrapped loadMore that respects search state
  const loadMore = useCallback(async () => {
    if (search.isSearching || search.searchQuery) return;
    await loadMorePage();
  }, [loadMorePage, search.isSearching, search.searchQuery]);

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

    // Spaces
    spaces: spacesState.spaces,
    currentSpaceId: spacesState.currentSpaceId,
    selectSpace: spacesState.selectSpace,
    createSpace: spacesState.createSpace,
    updateSpace: spacesState.updateSpace,
    deleteSpace: spacesState.deleteSpace,
    addItemToSpace: spacesState.addItemToSpace,
    removeItemFromSpace: spacesState.removeItemFromSpace,
    getItemSpaces: spacesState.getItemSpaces,
    setItemSpaces: spacesState.setItemSpaces,
    refreshSpaces: spacesState.refresh,
  };
}

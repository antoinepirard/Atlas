import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import * as tauri from "../lib/tauri";
import type { Item, SearchResult, ItemType, ParsedQuery } from "../types";
import { itemMatchesFilters } from "../lib/queryParser";

const SEARCH_DEBOUNCE_MS = 500;

export interface UseItemSearchReturn {
  searchQuery: string;
  filterType: ItemType | null;
  isSearching: boolean;
  allTags: string[];
  filteredItems: SearchResult[];
  handleSearch: (query: string, parsed?: ParsedQuery) => void;
  handleFilterType: (type: ItemType | null) => void;
}

export function useItemSearch(
  items: Item[],
  spaceId?: string | null
): UseItemSearchReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [semanticResults, setSemanticResults] = useState<SearchResult[] | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);

  const searchTimeoutRef = useRef<number | null>(null);
  const parsedRemainingText = parsedQuery?.remainingText ?? "";
  const hasParsedQuery = parsedQuery !== null;

  // Extract all unique tags from items for smart search autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach((item) => {
      item.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [items]);

  // Server-side semantic search with debounce
  // Now uses remainingText from parsed query for semantic search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Use remainingText for semantic search (excludes filter tokens)
    // Only use raw searchQuery if no parsed query exists yet
    const textToSearch = hasParsedQuery ? parsedRemainingText : searchQuery;

    if (!textToSearch.trim()) {
      // No text to search - clear semantic results but keep filters working
      setSemanticResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        // Get embedding for search query (using remaining text, not filters)
        const queryEmbedding = await tauri.getSearchEmbedding(textToSearch);

        if (queryEmbedding.length === 0) {
          // Fall back to server-side text search
          const textResults = await tauri.textSearch(textToSearch, 100);
          setSemanticResults(textResults);
          setIsSearching(false);
          return;
        }

        // Perform server-side semantic search (filtered by space if specified)
        const searchResponse = await tauri.semanticSearch(
          queryEmbedding,
          100,
          spaceId ?? undefined
        );

        // Convert search results to SearchResult format
        const semanticItems: SearchResult[] = searchResponse.results.map(
          (r) => ({
            ...r.item,
            similarity: r.similarity,
          })
        );

        // Also do text search to catch items without embeddings
        const textResults = await tauri.textSearch(textToSearch, 50);

        // Merge results, avoiding duplicates
        const semanticIds = new Set(semanticItems.map((i) => i.id));
        const additionalTextResults = textResults.filter(
          (i) => !semanticIds.has(i.id)
        );

        setSemanticResults([...semanticItems, ...additionalTextResults]);
      } catch (error) {
        console.error("Search failed:", error);
        // Try falling back to text search
        try {
          const textResults = await tauri.textSearch(textToSearch, 100);
          setSemanticResults(textResults);
        } catch {
          setSemanticResults(null);
        }
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, parsedRemainingText, hasParsedQuery, spaceId]);

  // Filter items - now applies structured filters from ParsedQuery
  const filteredItems = useMemo((): SearchResult[] => {
    let result: SearchResult[] = semanticResults || [...items];

    // Apply text search fallback if no semantic results
    // Only use raw searchQuery if no parsed query exists yet
    const textToSearch = parsedQuery ? parsedQuery.remainingText : searchQuery;
    if (!semanticResults && textToSearch && textToSearch.trim()) {
      const query = textToSearch.toLowerCase();
      result = items.filter((item) => {
        const searchableText = [
          item.content,
          item.title,
          item.description,
          item.summary,
          ...item.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    // Apply structured filters from ParsedQuery
    // Only apply if we have a parsed query with actual filters set
    if (parsedQuery?.filters) {
      const hasActiveFilters =
        parsedQuery.filters.dateRange ||
        (parsedQuery.filters.types && parsedQuery.filters.types.length > 0) ||
        (parsedQuery.filters.colors && parsedQuery.filters.colors.length > 0) ||
        (parsedQuery.filters.tags && parsedQuery.filters.tags.length > 0);

      if (hasActiveFilters) {
        result = result.filter((item) =>
          itemMatchesFilters(item, parsedQuery.filters)
        );
      }
    }

    // Apply type filter from TypeFilter buttons (if not already set by parsed query)
    if (
      filterType &&
      (!parsedQuery?.filters?.types || parsedQuery.filters.types.length === 0)
    ) {
      result = result.filter((item) => item.type === filterType);
    }

    // Sort by date if not semantic search
    if (!semanticResults) {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [items, searchQuery, filterType, semanticResults, parsedQuery]);

  // Handle search with parsed query
  const handleSearch = useCallback((query: string, parsed?: ParsedQuery) => {
    setSearchQuery(query);
    if (parsed) {
      setParsedQuery(parsed);
    }
  }, []);

  const handleFilterType = useCallback((type: ItemType | null) => {
    setFilterType(type);
  }, []);

  return {
    searchQuery,
    filterType,
    isSearching,
    allTags,
    filteredItems,
    handleSearch,
    handleFilterType,
  };
}

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as tauri from '../lib/tauri';
import type { MymindItem, SearchResult, ItemType } from '../types';

const SEARCH_DEBOUNCE_MS = 500;

// Cosine similarity for vector search
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dot = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

// Detect content type
function detectType(content: string): ItemType {
  try {
    const url = new URL(content);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return 'url';
    }
  } catch {
    // Not a URL
  }
  return 'note';
}

export function useMymind() {
  const [items, setItems] = useState<MymindItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [semanticResults, setSemanticResults] = useState<SearchResult[] | null>(null);
  
  const searchTimeoutRef = useRef<number | null>(null);

  // Load items on mount
  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      try {
        const loadedItems = await tauri.getAllItems();
        setItems(loadedItems);
      } catch (err) {
        console.error('Failed to load items:', err);
        setError('Failed to load items');
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, []);

  // Semantic search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!searchQuery.trim()) {
      setSemanticResults(null);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    
    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const queryEmbedding = await tauri.getSearchEmbedding(searchQuery);
        
        if (queryEmbedding.length === 0) {
          setSemanticResults(null);
          setIsSearching(false);
          return;
        }
        
        const itemsWithSimilarity: SearchResult[] = items
          .filter(item => item.embedding && item.embedding.length > 0)
          .map(item => ({
            ...item,
            similarity: cosineSimilarity(queryEmbedding, item.embedding!),
          }))
          .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        
        const itemsWithoutEmbedding = items.filter(item => !item.embedding || item.embedding.length === 0);
        const textMatchedItems = itemsWithoutEmbedding.filter(item => {
          const searchableText = [
            item.content,
            item.title,
            item.description,
            item.summary,
            ...item.tags,
          ].filter(Boolean).join(' ').toLowerCase();
          return searchableText.includes(searchQuery.toLowerCase());
        });
        
        setSemanticResults([...itemsWithSimilarity, ...textMatchedItems]);
      } catch (error) {
        console.error('Semantic search failed:', error);
        setSemanticResults(null);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, items]);

  // Filter items
  const filteredItems = useMemo((): SearchResult[] => {
    let result: SearchResult[] = semanticResults || [...items];
    
    if (!semanticResults && searchQuery) {
      const query = searchQuery.toLowerCase();
      result = items.filter(item => {
        const searchableText = [
          item.content,
          item.title,
          item.description,
          item.summary,
          ...item.tags,
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchableText.includes(query);
      });
    }
    
    if (filterType) {
      result = result.filter(item => item.type === filterType);
    }
    
    if (!semanticResults) {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return result;
  }, [items, searchQuery, filterType, semanticResults]);

  // Add content
  const addContent = useCallback(async (content: string, sourceUrl?: string): Promise<MymindItem | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const itemType = detectType(content);
      let title: string | undefined;
      let description: string | undefined;
      let imageUrl: string | undefined;

      if (itemType === 'url') {
        try {
          const metadata = await tauri.fetchUrlMetadata(content);
          title = metadata.title || undefined;
          description = metadata.description || undefined;
          imageUrl = metadata.image || undefined;
        } catch {
          // Fallback
        }
      }

      // Process with AI
      let tags: string[] = [itemType];
      let summary = '';
      let embedding: number[] = [];
      try {
        const aiResult = await tauri.processWithAI(content, itemType, title, description);
        tags = aiResult.tags;
        summary = aiResult.summary;
        embedding = aiResult.embedding;
      } catch (err) {
        console.warn('AI processing failed, using defaults:', err);
      }

      const newItem = await tauri.addItem({
        content,
        type: itemType,
        title,
        description,
        summary: summary || undefined,
        image_url: imageUrl,
        source_url: sourceUrl,
        tags,
        embedding: embedding.length > 0 ? embedding : undefined,
      });

      setItems(prev => [newItem, ...prev]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Upload image
  const uploadImage = useCallback(async (file: File): Promise<MymindItem | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let imageTags: string[] = ['image'];
      let imageSummary = '';
      let imageEmbedding: number[] = [];
      try {
        const aiResult = await tauri.processWithAI(dataUrl, 'image', file.name);
        imageTags = aiResult.tags;
        imageSummary = aiResult.summary;
        imageEmbedding = aiResult.embedding;
      } catch (err) {
        console.warn('AI processing failed, using defaults:', err);
      }

      const newItem = await tauri.addItem({
        content: dataUrl,
        type: 'image',
        title: file.name,
        summary: imageSummary || undefined,
        image_url: dataUrl,
        tags: imageTags,
        embedding: imageEmbedding.length > 0 ? imageEmbedding : undefined,
      });

      setItems(prev => [newItem, ...prev]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete item
  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      await tauri.deleteItem(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterType = useCallback((type: ItemType | null) => {
    setFilterType(type);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const loadedItems = await tauri.getAllItems();
      setItems(loadedItems);
    } catch (err) {
      console.error('Failed to refresh items:', err);
    }
  }, []);

  return {
    items: filteredItems,
    isLoading,
    isSearching,
    error,
    searchQuery,
    filterType,
    addContent,
    uploadImage,
    deleteItem,
    handleSearch,
    handleFilterType,
    refresh,
  };
}


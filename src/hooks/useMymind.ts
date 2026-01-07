import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as tauri from '../lib/tauri';
import type { MymindItem, SearchResult, ItemType } from '../types';

const SEARCH_DEBOUNCE_MS = 500;
const PAGE_SIZE = 50;

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

// Detect X/Twitter URL
function isXPostUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    if (hostname !== 'x.com' && hostname !== 'twitter.com') {
      return false;
    }
    return /^\/[^/]+\/status\/\d+/.test(urlObj.pathname);
  } catch {
    return false;
  }
}

// Check if a title is generic (missing, empty, or looks like a filename)
function isGenericTitle(title: string | undefined): boolean {
  if (!title || title.trim() === '') return true;
  const filenamePatterns = [
    /^IMG[_-]?\d+/i,           // IMG_1234, IMG-1234
    /^DSC[_-]?\d+/i,           // DSC_1234
    /^photo[_-]?\d*/i,         // photo, photo_1
    /^image[_-]?\d*/i,         // image, image_1
    /^screenshot[_-]?\d*/i,    // screenshot_2024
    /^screen\s*shot/i,         // Screen Shot 2024
    /^capture[_-]?\d*/i,       // capture_1
    /\.(jpg|jpeg|png|gif|webp|heic|bmp|tiff?)$/i,  // ends with image extension
  ];
  return filenamePatterns.some(pattern => pattern.test(title));
}

// Fetch tweet content via oEmbed API
async function fetchTweetContent(url: string): Promise<{ author: string; text: string } | null> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Extract text from the HTML (it's in a blockquote)
    // The HTML looks like: <blockquote>tweet text<br>— Author (@handle)</blockquote>
    const html = data.html || '';
    
    // Use a simple regex to extract the text content before the author line
    const textMatch = html.match(/<blockquote[^>]*><p[^>]*>([\s\S]*?)<\/p>/i);
    let text = '';
    if (textMatch) {
      text = textMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }
    
    return {
      author: data.author_name || '',
      text: text || data.author_name ? `Tweet by ${data.author_name}` : '',
    };
  } catch (error) {
    console.warn('Failed to fetch tweet content:', error);
    return null;
  }
}

export function useMymind() {
  const [items, setItems] = useState<MymindItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [semanticResults, setSemanticResults] = useState<SearchResult[] | null>(null);
  
  const searchTimeoutRef = useRef<number | null>(null);
  const loadingRef = useRef(false);

  // Load initial page on mount
  useEffect(() => {
    const loadInitialItems = async () => {
      setIsLoading(true);
      try {
        const page = await tauri.getItemsPage(0, PAGE_SIZE);
        setItems(page.items);
        setTotalCount(page.total);
        setHasMore(page.has_more);
        setCurrentPage(0);
      } catch (err) {
        console.error('Failed to load items:', err);
        setError('Failed to load items');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialItems();
  }, []);

  // Load more items (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || isSearching || searchQuery) return;
    
    loadingRef.current = true;
    setIsLoadingMore(true);
    
    try {
      const nextPage = currentPage + 1;
      const page = await tauri.getItemsPage(nextPage, PAGE_SIZE);
      
      setItems(prev => [...prev, ...page.items]);
      setHasMore(page.has_more);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Failed to load more items:', err);
    } finally {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [currentPage, hasMore, isSearching, searchQuery]);

  // Server-side semantic search with debounce
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
        // Get embedding for search query
        const queryEmbedding = await tauri.getSearchEmbedding(searchQuery);
        
        if (queryEmbedding.length === 0) {
          // Fall back to server-side text search
          const textResults = await tauri.textSearch(searchQuery, 100);
          setSemanticResults(textResults);
          setIsSearching(false);
          return;
        }
        
        // Perform server-side semantic search
        const searchResponse = await tauri.semanticSearch(queryEmbedding, 100);
        
        // Convert search results to SearchResult format
        const semanticItems: SearchResult[] = searchResponse.results.map(r => ({
          ...r.item,
          similarity: r.similarity,
        }));
        
        // Also do text search to catch items without embeddings
        const textResults = await tauri.textSearch(searchQuery, 50);
        
        // Merge results, avoiding duplicates
        const semanticIds = new Set(semanticItems.map(i => i.id));
        const additionalTextResults = textResults.filter(i => !semanticIds.has(i.id));
        
        setSemanticResults([...semanticItems, ...additionalTextResults]);
      } catch (error) {
        console.error('Search failed:', error);
        // Try falling back to text search
        try {
          const textResults = await tauri.textSearch(searchQuery, 100);
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
  }, [searchQuery]);

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
      let tweetContent: string | undefined;

      if (itemType === 'url') {
        // Check if it's an X/Twitter post
        if (isXPostUrl(content)) {
          // Fetch tweet content via oEmbed for better AI summarization
          const tweetData = await fetchTweetContent(content);
          if (tweetData) {
            title = `Tweet by ${tweetData.author}`;
            description = tweetData.text;
            tweetContent = tweetData.text;
          }
        }
        
        // Also fetch standard metadata (for image, etc.)
        try {
          const metadata = await tauri.fetchUrlMetadata(content);
          if (!title) title = metadata.title || undefined;
          if (!description) description = metadata.description || undefined;
          imageUrl = metadata.image || undefined;
        } catch {
          // Fallback
        }
      }

      // Process with AI - for X posts, pass the actual tweet text
      let tags: string[] = [itemType];
      let summary = '';
      let embedding: number[] = [];
      try {
        // For X posts, use the tweet content for AI processing
        const contentForAI = tweetContent || content;
        const aiResult = await tauri.processWithAI(contentForAI, itemType, title, description);
        tags = aiResult.tags;
        summary = aiResult.summary;
        embedding = aiResult.embedding;
        // Use AI-generated title if current title is missing or generic
        if (aiResult.title && isGenericTitle(title)) {
          title = aiResult.title;
        }
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
      setTotalCount(prev => prev + 1);
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
      let imageTitle: string = file.name;
      try {
        const aiResult = await tauri.processWithAI(dataUrl, 'image', file.name);
        imageTags = aiResult.tags;
        imageSummary = aiResult.summary;
        imageEmbedding = aiResult.embedding;
        // Use AI-generated title if filename is generic
        if (aiResult.title && isGenericTitle(file.name)) {
          imageTitle = aiResult.title;
        }
      } catch (err) {
        console.warn('AI processing failed, using defaults:', err);
      }

      const newItem = await tauri.addItem({
        content: dataUrl,
        type: 'image',
        title: imageTitle,
        summary: imageSummary || undefined,
        image_url: dataUrl,
        tags: imageTags,
        embedding: imageEmbedding.length > 0 ? imageEmbedding : undefined,
      });

      setItems(prev => [newItem, ...prev]);
      setTotalCount(prev => prev + 1);
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
      setTotalCount(prev => prev - 1);
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
      const page = await tauri.getItemsPage(0, PAGE_SIZE);
      setItems(page.items);
      setTotalCount(page.total);
      setHasMore(page.has_more);
      setCurrentPage(0);
    } catch (err) {
      console.error('Failed to refresh items:', err);
    }
  }, []);

  return {
    items: filteredItems,
    totalCount,
    hasMore: hasMore && !searchQuery, // Disable infinite scroll during search
    isLoading,
    isLoadingMore,
    isSearching,
    error,
    searchQuery,
    filterType,
    addContent,
    uploadImage,
    deleteItem,
    handleSearch,
    handleFilterType,
    loadMore,
    refresh,
  };
}

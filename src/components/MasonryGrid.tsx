import { useMemo, ReactNode, useRef, useEffect, useCallback } from 'react';

interface MasonryGridProps {
  children: ReactNode[];
  columns?: number;
  gap?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function MasonryGrid({ 
  children, 
  columns = 4, 
  gap = 16,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: MasonryGridProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const columnContent = useMemo(() => {
    const cols: ReactNode[][] = Array.from({ length: columns }, () => []);
    
    children.forEach((child, index) => {
      cols[index % columns].push(child);
    });
    
    return cols;
  }, [children, columns]);

  // Infinite scroll with Intersection Observer
  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (!onLoadMore) return;

    observerRef.current = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: '200px', // Start loading before user reaches bottom
      threshold: 0,
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersect, onLoadMore]);

  return (
    <div className="w-full">
      <div 
        className="grid w-full"
        style={{ 
          gap: `${gap}px`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
        }}
      >
        {columnContent.map((col, colIndex) => (
          <div 
            key={colIndex}
            className="flex flex-col min-w-0"
            style={{ gap: `${gap}px` }}
          >
            {col}
          </div>
        ))}
      </div>
      
      {/* Infinite scroll trigger */}
      {onLoadMore && (
        <div ref={loadMoreRef} className="w-full py-8 flex justify-center">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-stone-400">
              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          )}
          {!hasMore && children.length > 0 && (
            <span className="text-sm text-stone-400">You've reached the end</span>
          )}
        </div>
      )}
    </div>
  );
}

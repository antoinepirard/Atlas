import {
  useMemo,
  ReactNode,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";

interface MasonryGridProps {
  children: ReactNode[];
  gap?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

function getColumnCount(width: number): number {
  if (width < 500) return 1;
  if (width < 700) return 2;
  if (width < 1000) return 3;
  if (width < 1300) return 4;
  if (width < 1600) return 5;
  return 6;
}

export function MasonryGrid({
  children,
  gap = 16,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(4);

  // Responsive column count based on container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        setColumns(getColumnCount(width));
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const columnContent = useMemo(() => {
    const cols: ReactNode[][] = Array.from({ length: columns }, () => []);

    children.forEach((child, index) => {
      cols[index % columns].push(child);
    });

    return cols;
  }, [children, columns]);

  // Infinite scroll with Intersection Observer
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, isLoadingMore, onLoadMore]
  );

  useEffect(() => {
    if (!onLoadMore) return;

    observerRef.current = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: "200px", // Start loading before user reaches bottom
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
    <div ref={containerRef} className="w-full">
      <div
        className="grid w-full"
        style={{
          gap: `${gap}px`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
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
            <span className="text-sm text-stone-400">
              You've reached the end
            </span>
          )}
        </div>
      )}
    </div>
  );
}

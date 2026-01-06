import { useMemo, ReactNode } from 'react';

interface MasonryGridProps {
  children: ReactNode[];
  columns?: number;
  gap?: number;
}

export function MasonryGrid({ children, columns = 4, gap = 16 }: MasonryGridProps) {
  const columnContent = useMemo(() => {
    const cols: ReactNode[][] = Array.from({ length: columns }, () => []);
    
    children.forEach((child, index) => {
      cols[index % columns].push(child);
    });
    
    return cols;
  }, [children, columns]);

  return (
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
  );
}


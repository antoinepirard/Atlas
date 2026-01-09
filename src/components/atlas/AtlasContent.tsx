import { AnimatePresence, motion } from "motion/react";
import { MasonryGrid } from "../MasonryGrid";
import { ItemCard } from "../cards";
import type { Item } from "../../types";

interface AtlasContentProps {
  items: Item[];
  isLoading: boolean;
  isSearching: boolean;
  searchQuery: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (item: Item) => void;
  selectedIds: Set<string>;
  isMultiSelectMode: boolean;
  onToggleSelect: (id: string) => void;
  onOpenAddModal: () => void;
}

export function AtlasContent({
  items,
  isLoading,
  isSearching,
  searchQuery,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onDeleteItem,
  onSelectItem,
  selectedIds,
  isMultiSelectMode,
  onToggleSelect,
  onOpenAddModal,
}: AtlasContentProps) {
  const hasSelection = selectedIds.size > 0;

  return (
    <main className="max-w-[1800px] mx-auto px-6 py-8">
      <AnimatePresence mode="popLayout">
        {items.length === 0 && !isLoading && !isSearching && !searchQuery ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-8">
              <span className="text-5xl">🧠</span>
            </div>
            <h2
              className="text-2xl text-stone-600 mb-3"
              style={{
                fontFamily: "'Newsreader', 'Georgia', serif",
                fontStyle: "italic",
              }}
            >
              Your mind is empty
            </h2>
            <p className="text-stone-400 max-w-md mb-8 text-sm">
              Paste anything to add it. URLs, images, notes—just press ⌘V
              anywhere, or ⌘N to add content.
            </p>
            <button
              onClick={onOpenAddModal}
              className="px-6 py-3 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors text-sm"
            >
              Add your first item
            </button>
          </motion.div>
        ) : items.length === 0 && !isSearching && searchQuery ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <p className="text-stone-400 text-sm">
              No results found for "{searchQuery}"
            </p>
          </motion.div>
        ) : (
          <MasonryGrid
            gap={20}
            onLoadMore={onLoadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
          >
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <ItemCard
                  item={item}
                  onDelete={() => onDeleteItem(item.id)}
                  onClick={() => onSelectItem(item)}
                  isSelected={selectedIds.has(item.id)}
                  isMultiSelectMode={isMultiSelectMode || hasSelection}
                  onSelect={onToggleSelect}
                />
              </motion.div>
            ))}
          </MasonryGrid>
        )}
      </AnimatePresence>

      {isLoading && items.length === 0 && (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin" />
        </div>
      )}
    </main>
  );
}

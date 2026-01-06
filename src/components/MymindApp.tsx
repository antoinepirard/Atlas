import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlusIcon, LockClosedIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { SearchBar } from './SearchBar';
import { MasonryGrid } from './MasonryGrid';
import { ItemCard } from './ItemCard';
import { AddContentModal } from './AddContentModal';
import { PreviewModal } from './PreviewModal';
import { SettingsModal } from './SettingsModal';
import { TypeFilter } from './TypeFilter';
import { PasteIndicator } from './PasteIndicator';
import { useVault } from './VaultProvider';
import { useMymind } from '../hooks/useMymind';
import type { MymindItem } from '../types';

export function MymindApp() {
  const { lock, status } = useVault();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MymindItem | null>(null);
  const {
    items,
    isLoading,
    isSearching,
    searchQuery,
    filterType,
    addContent,
    uploadImage,
    deleteItem,
    handleSearch,
    handleFilterType,
  } = useMymind();

  const handleAddContent = useCallback(async (content: string) => {
    await addContent(content);
    setIsAddModalOpen(false);
  }, [addContent]);

  const handleUploadImage = useCallback(async (file: File) => {
    await uploadImage(file);
    setIsAddModalOpen(false);
  }, [uploadImage]);

  // Global paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setIsPasting(true);
            await uploadImage(file);
            setIsPasting(false);
          }
          return;
        }
      }

      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trim()) {
        e.preventDefault();
        setIsPasting(true);
        await addContent(text.trim());
        setIsPasting(false);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addContent, uploadImage]);

  const getColumns = () => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 768) return 2;
    if (window.innerWidth < 1024) return 3;
    return 4;
  };

  return (
    <div className="min-h-screen bg-stone-100">
      <PasteIndicator isVisible={isPasting} />

      <header 
        data-tauri-drag-region 
        className="sticky top-0 z-40 bg-stone-100/95 backdrop-blur-sm border-b border-stone-200/50"
      >
        <div className="flex items-center justify-between pl-[76px] pr-6 py-4 pt-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </motion.button>

          <div className="flex items-center gap-4">
            <TypeFilter
              value={filterType}
              onChange={handleFilterType}
            />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={lock}
              className="group relative p-2 text-stone-400 hover:text-stone-600 transition-colors"
              title={`Lock vault (auto-locks in ${status.auto_lock_minutes} min)`}
            >
              <LockClosedIcon className="w-5 h-5" />
              <span className="absolute -bottom-8 right-0 px-2 py-1 text-xs text-stone-500 bg-white rounded shadow-sm border border-stone-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Auto-lock: {status.auto_lock_minutes}min
              </span>
            </motion.button>
          </div>
        </div>

        <div className="px-6 pb-8 pt-4 max-w-[1800px] mx-auto">
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            isLoading={isSearching}
            placeholder="Search my mind..."
          />
        </div>
      </header>

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
                style={{ fontFamily: "'Newsreader', 'Georgia', serif", fontStyle: 'italic' }}
              >
                Your mind is empty
              </h2>
              <p className="text-stone-400 max-w-md mb-8 text-sm">
                Paste anything to add it. URLs, images, notes—just press ⌘V anywhere.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
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
            <MasonryGrid columns={getColumns()} gap={20}>
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.02, duration: 0.25 }}
                >
                  <ItemCard
                    item={item}
                    onDelete={() => deleteItem(item.id)}
                    onClick={() => setSelectedItem(item)}
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

      <AddContentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddContent={handleAddContent}
        onUploadImage={handleUploadImage}
      />

      <PreviewModal
        item={selectedItem}
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}


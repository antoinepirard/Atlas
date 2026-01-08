import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  PlusIcon,
  LockClosedIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { listen } from "@tauri-apps/api/event";
import { SearchBar } from "./SearchBar";
import { MasonryGrid } from "./MasonryGrid";
import { ItemCard } from "./cards";
import { AddContentModal } from "./AddContentModal";
import { PreviewModal } from "./PreviewModal";
import { SettingsModal } from "./SettingsModal";
import { TypeFilter } from "./TypeFilter";
import { PasteIndicator } from "./PasteIndicator";
import { UpdateToast } from "./UpdateToast";
import { SelectionActionBar } from "./SelectionActionBar";
import type { QuickCaptureData } from "./QuickCaptureModal";
import { useVault } from "./VaultProvider";
import { useAtlas } from "../hooks/useAtlas";
import { toggleMaximize } from "../lib/tauri";
import type { Item } from "../types";
import { convertClipboardHtml } from "../utils/htmlToText";

export function AtlasApp() {
  const { lock, status } = useVault();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    items,
    hasMore,
    isLoading,
    isLoadingMore,
    isSearching,
    searchQuery,
    filterType,
    allTags,
    addContent,
    uploadImage,
    deleteItem,
    deleteItems,
    updateItem,
    handleSearch,
    handleFilterType,
    loadMore,
    refresh,
  } = useAtlas();

  const pendingRefreshRef = useRef(false);

  useEffect(() => {
    const unlisten = listen("items-updated", () => {
      if (document.hidden) {
        pendingRefreshRef.current = true;
        return;
      }
      refresh();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  // Multi-select handlers
  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    await deleteItems(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsDeleting(false);
  }, [selectedIds, deleteItems]);

  // Track CMD key for multi-select mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setIsMultiSelectMode(true);
      }
      // Escape to clear selection
      if (e.key === "Escape" && selectedIds.size > 0) {
        clearSelection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setIsMultiSelectMode(false);
      }
    };

    // Also handle when window loses focus (cmd+tab etc)
    const handleBlur = () => {
      setIsMultiSelectMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [selectedIds.size, clearSelection]);

  const handleAddContent = useCallback(
    async (content: string) => {
      await addContent(content);
      setIsAddModalOpen(false);
    },
    [addContent]
  );

  // Navigate to previous/next item in preview modal
  const handleNavigateItem = useCallback(
    (direction: "prev" | "next") => {
      if (!selectedItem) return;
      const currentIndex = items.findIndex(
        (item) => item.id === selectedItem.id
      );
      if (currentIndex === -1) return;

      const newIndex =
        direction === "prev"
          ? (currentIndex - 1 + items.length) % items.length
          : (currentIndex + 1) % items.length;

      setSelectedItem(items[newIndex]);
    },
    [selectedItem, items]
  );

  const handleUploadImage = useCallback(
    async (file: File) => {
      await uploadImage(file);
      setIsAddModalOpen(false);
    },
    [uploadImage]
  );

  // Listen for context menu actions from native menu
  useEffect(() => {
    const unlisten = listen<{ action: string; item_id: string }>(
      "context-menu-action",
      async (event) => {
        const { action, item_id } = event.payload;
        const item = items.find((i) => i.id === item_id);
        if (!item) return;

        switch (action) {
          case "open_external":
            window.open(item.content, "_blank", "noopener,noreferrer");
            break;
          case "copy":
            navigator.clipboard.writeText(item.content);
            break;
          case "delete":
            await deleteItem(item_id);
            break;
        }
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [items, deleteItem]);

  // Listen for quick-capture events from Tauri - save automatically in the background
  useEffect(() => {
    const unlisten = listen<QuickCaptureData>(
      "quick-capture",
      async (event) => {
        const data = event.payload;
        const hasUrl = data.url && data.url.length > 0;
        const hasText =
          data.selected_text && data.selected_text.trim().length > 0;
        const hasHtml =
          data.html_content && data.html_content.trim().length > 0;
        const sourceUrl = data.url || undefined;

        if (!hasUrl && !hasText && !hasHtml) return;

        try {
          // Save URL as a link if present
          if (hasUrl && data.url) {
            await addContent(data.url);
          }

          // Save selected text as a note with source_url property
          // Prefer HTML content for better formatting preservation
          if (hasHtml && data.html_content) {
            const text = convertClipboardHtml(data.html_content);
            if (text.trim()) {
              await addContent(text, sourceUrl);
            }
          } else if (hasText && data.selected_text) {
            const text = data.selected_text.trim();
            await addContent(text, sourceUrl);
          }
        } catch (error) {
          console.error("Quick capture failed:", error);
        }
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addContent]);

  // Listen for open-settings event from menu bar (⌘,)
  useEffect(() => {
    const unlisten = listen("open-settings", () => {
      setIsSettingsOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for zoom events from menu bar
  useEffect(() => {
    const unlisten = listen<string>("zoom", (event) => {
      const root = document.documentElement;
      const currentZoom = parseFloat(
        root.style.getPropertyValue("--app-zoom") || "1"
      );

      switch (event.payload) {
        case "in":
          root.style.setProperty(
            "--app-zoom",
            String(Math.min(currentZoom + 0.1, 2))
          );
          document.body.style.zoom = String(Math.min(currentZoom + 0.1, 2));
          break;
        case "out":
          root.style.setProperty(
            "--app-zoom",
            String(Math.max(currentZoom - 0.1, 0.5))
          );
          document.body.style.zoom = String(Math.max(currentZoom - 0.1, 0.5));
          break;
        case "reset":
          root.style.setProperty("--app-zoom", "1");
          document.body.style.zoom = "1";
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Track scroll position for compact header
  const [isScrolled, setIsScrolled] = useState(false);

  // Auto-hiding scrollbar effect + scroll detection for compact header
  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      document.documentElement.classList.add("is-scrolling");
      setIsScrolled(window.scrollY > 50);

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        document.documentElement.classList.remove("is-scrolling");
      }, 1000); // Hide after 1 second of no scrolling
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // ⌘+N to open add content modal
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setIsAddModalOpen(true);
        return;
      }

      // ⌘+1/2/3/4 to filter by type
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") {
          e.preventDefault();
          handleFilterType(null);
        } else if (e.key === "2") {
          e.preventDefault();
          handleFilterType("url");
        } else if (e.key === "3") {
          e.preventDefault();
          handleFilterType("image");
        } else if (e.key === "4") {
          e.preventDefault();
          handleFilterType("note");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFilterType]);

  // Global paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
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

      // Try to get HTML first for better formatting preservation
      const html = e.clipboardData?.getData("text/html");
      const plainText = e.clipboardData?.getData("text/plain");

      let text = "";
      if (html && html.trim()) {
        // Convert HTML to clean text while preserving structure
        text = convertClipboardHtml(html);
      } else if (plainText) {
        text = plainText.trim();
      }

      if (text) {
        e.preventDefault();
        setIsPasting(true);
        await addContent(text);
        setIsPasting(false);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addContent, uploadImage]);

  return (
    <div className="min-h-screen bg-stone-100">
      <PasteIndicator isVisible={isPasting} />

      <header className="sticky top-0 z-40 bg-stone-100/95 backdrop-blur-sm border-b border-stone-200/50">
        {/* Draggable title bar region - uses data-tauri-drag-region for native behavior */}
        <div
          data-tauri-drag-region
          onDoubleClick={() => toggleMaximize()}
          className="h-7 w-full cursor-default select-none"
        />

        {/* Toolbar row - settings on left after traffic lights, controls on right */}
        <div className="flex items-center justify-between px-4 py-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-lg transition-colors"
            title="Settings"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </motion.button>

          <div className="flex items-center gap-3">
            <TypeFilter value={filterType} onChange={handleFilterType} />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAddModalOpen(true)}
              title="Add content (⌘N)"
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => lock()}
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

        {/* Search bar */}
        <div
          className={`px-6 max-w-[1800px] mx-auto transition-all duration-300 ${
            isScrolled ? "pb-3 pt-1" : "pb-6 pt-2"
          }`}
        >
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            isLoading={isSearching}
            placeholder="Search..."
            compact={isScrolled}
            existingTags={allTags}
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
            <MasonryGrid
              gap={20}
              onLoadMore={loadMore}
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
                    onDelete={() => deleteItem(item.id)}
                    onClick={() => setSelectedItem(item)}
                    isSelected={selectedIds.has(item.id)}
                    isMultiSelectMode={
                      isMultiSelectMode || selectedIds.size > 0
                    }
                    onSelect={handleSelect}
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
        onNavigate={handleNavigateItem}
        totalItems={items.length}
        currentIndex={
          selectedItem ? items.findIndex((i) => i.id === selectedItem.id) : -1
        }
        onUpdateItem={async (item) => {
          const result = await updateItem(item);
          if (result) {
            setSelectedItem(result);
          }
          return result;
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <UpdateToast onOpenSettings={() => setIsSettingsOpen(true)} />

      <SelectionActionBar
        selectedCount={selectedIds.size}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
        isDeleting={isDeleting}
      />
    </div>
  );
}

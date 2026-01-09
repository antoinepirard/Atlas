import { useState, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { AddContentModal } from "./AddContentModal";
import { PreviewModal } from "./PreviewModal";
import { SettingsModal } from "./SettingsModal";
import { PasteIndicator } from "./PasteIndicator";
import { UpdateToast } from "./UpdateToast";
import { SelectionActionBar } from "./SelectionActionBar";
import { AtlasHeader } from "./atlas/AtlasHeader";
import { AtlasContent } from "./atlas/AtlasContent";
import type { QuickCaptureData } from "./QuickCaptureModal";
import { useVault } from "./VaultProvider";
import { useAtlas } from "../hooks/useAtlas";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { toggleMaximize } from "../lib/tauri";
import type { Item } from "../types";
import { convertClipboardHtml } from "../utils/htmlToText";
import { getSafeExternalUrl } from "../utils/urlUtils";

export function AtlasApp() {
  const { lock, status } = useVault();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

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
    enrichItems,
    handleSearch,
    handleFilterType,
    loadMore,
    refresh,
  } = useAtlas();

  const {
    selectedIds,
    isMultiSelectMode,
    isDeleting,
    isEnriching,
    handleSelect,
    clearSelection,
    selectAll,
    handleBulkDelete,
    handleBulkEnrich,
  } = useMultiSelect({ items, deleteItems, enrichItems });

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
            {
              const safeUrl = getSafeExternalUrl(item.content);
              if (safeUrl) {
                window.open(safeUrl, "_blank", "noopener,noreferrer");
              }
            }
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

      // ⌘+A to select all items
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
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
  }, [handleFilterType, selectAll]);

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

      <AtlasHeader
        isScrolled={isScrolled}
        filterType={filterType}
        onFilterType={handleFilterType}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        isSearching={isSearching}
        allTags={allTags}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdd={() => setIsAddModalOpen(true)}
        onLock={() => lock()}
        autoLockMinutes={status.auto_lock_minutes}
        onToggleMaximize={() => toggleMaximize()}
      />

      <AtlasContent
        items={items}
        isLoading={isLoading}
        isSearching={isSearching}
        searchQuery={searchQuery}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        onDeleteItem={(id) => deleteItem(id)}
        onSelectItem={setSelectedItem}
        selectedIds={selectedIds}
        isMultiSelectMode={isMultiSelectMode}
        onToggleSelect={handleSelect}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

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
        onEnrich={handleBulkEnrich}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
        isDeleting={isDeleting}
        isEnriching={isEnriching}
      />
    </div>
  );
}

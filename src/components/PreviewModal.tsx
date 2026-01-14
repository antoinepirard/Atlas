import { useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Item, Space } from "../types";
import * as tauri from "../lib/tauri";
import {
  getYouTubeVideoId,
  getXPostInfo,
  getSafeExternalUrl,
  getSafeImageUrl,
} from "../utils/urlUtils";
import { PreviewContent } from "./preview/PreviewContent";
import { PreviewDetails } from "./preview/PreviewDetails";

interface PreviewModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  totalItems?: number;
  currentIndex?: number;
  onUpdateItem?: (item: Item) => Promise<Item | null>;
  spaces: Space[];
  itemSpaceIds: string[];
  onToggleItemSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
}

export function PreviewModal({
  item,
  isOpen,
  onClose,
  onNavigate,
  totalItems = 0,
  currentIndex = -1,
  onUpdateItem,
  spaces,
  itemSpaceIds,
  onToggleItemSpace,
  onCreateSpace,
}: PreviewModalProps) {
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [isLoadingFullImage, setIsLoadingFullImage] = useState(false);

  const itemId = item?.id;
  const itemType = item?.type;
  const itemContent = item?.content;
  const itemImageUrl = item?.image_url;
  const itemImageExternal = item?.image_external;
  const itemSourceUrl = item?.source_url;

  const youtubeVideoId = useMemo(() => {
    if (!itemContent || itemType !== "url") return null;
    return getYouTubeVideoId(itemContent);
  }, [itemContent, itemType]);

  const youtubeEmbedUrl = useMemo(() => {
    if (!youtubeVideoId) return null;
    // enablejsapi=0 disables YouTube's postMessage API that requires valid origin matching
    return `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=0&rel=0&enablejsapi=0`;
  }, [youtubeVideoId]);

  const xPostInfo = useMemo(() => {
    if (!itemContent || itemType !== "url") return null;
    return getXPostInfo(itemContent);
  }, [itemContent, itemType]);

  const safeItemUrl = useMemo(() => {
    if (!itemContent || itemType !== "url") return null;
    return getSafeExternalUrl(itemContent);
  }, [itemContent, itemType]);

  const safeSourceUrl = useMemo(() => {
    if (!itemSourceUrl) return null;
    return getSafeExternalUrl(itemSourceUrl);
  }, [itemSourceUrl]);

  const safeImageHref = useMemo(() => {
    const candidate = fullImageUrl || itemImageUrl || itemContent || "";
    return getSafeImageUrl(candidate);
  }, [fullImageUrl, itemImageUrl, itemContent]);

  // Load full image on demand for external images
  useEffect(() => {
    if (!itemId || !isOpen) {
      setFullImageUrl(null);
      return;
    }

    if (itemType === "image" && itemImageExternal) {
      setIsLoadingFullImage(true);
      tauri
        .getFullImage(itemId)
        .then((url) => {
          setFullImageUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load full image:", err);
          setFullImageUrl(itemImageUrl || itemContent || null);
        })
        .finally(() => {
          setIsLoadingFullImage(false);
        });
    } else {
      setFullImageUrl(null);
    }
  }, [itemId, itemType, itemImageExternal, itemImageUrl, itemContent, isOpen]);

  // Hide body scrollbar when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle keyboard navigation (but not for notes being edited)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if we're in a textarea
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Escape") {
        onClose();
      }
      // Arrow key navigation
      if (onNavigate && totalItems > 1) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onNavigate("prev");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onNavigate("next");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onNavigate, totalItems]);

  if (!item) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-10 left-6 right-6 bottom-6 z-50 flex"
          >
            <div className="w-full max-w-[1600px] h-full mx-auto flex rounded-2xl overflow-hidden bg-stone-100 shadow-2xl">
              <PreviewContent
                item={item}
                onNavigate={onNavigate}
                totalItems={totalItems}
                currentIndex={currentIndex}
                fullImageUrl={fullImageUrl}
                isLoadingFullImage={isLoadingFullImage}
                onUpdateItem={onUpdateItem}
                youtubeVideoId={youtubeVideoId}
                youtubeEmbedUrl={youtubeEmbedUrl}
                xPostInfo={xPostInfo}
              />

              <PreviewDetails
                item={item}
                onClose={onClose}
                safeItemUrl={safeItemUrl}
                safeSourceUrl={safeSourceUrl}
                safeImageHref={safeImageHref}
                youtubeVideoId={youtubeVideoId}
                xPostInfo={xPostInfo}
                spaces={spaces}
                itemSpaceIds={itemSpaceIds}
                onToggleItemSpace={onToggleItemSpace}
                onCreateSpace={onCreateSpace}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

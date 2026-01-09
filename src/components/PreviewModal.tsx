import { useMemo, useEffect, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import type { Item } from "../types";
import * as tauri from "../lib/tauri";
import {
  getYouTubeVideoId,
  getXPostInfo,
  formatDate,
  getDomain,
  getSafeExternalUrl,
  getSafeImageUrl,
} from "../utils/urlUtils";
import { SimpleNoteEditor } from "./SimpleNoteEditor";

interface PreviewModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  totalItems?: number;
  currentIndex?: number;
  onUpdateItem?: (item: Item) => Promise<Item | null>;
}

export function PreviewModal({
  item,
  isOpen,
  onClose,
  onNavigate,
  totalItems = 0,
  currentIndex = -1,
  onUpdateItem,
}: PreviewModalProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [isLoadingFullImage, setIsLoadingFullImage] = useState(false);

  // Inline note editing state
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reader mode state
  const [isReaderMode, setIsReaderMode] = useState(false);

  // URL image error state
  const [urlImageError, setUrlImageError] = useState(false);

  // Initialize edited content when item changes
  useEffect(() => {
    if (item?.type === "note") {
      setEditedContent(item.content);
    }
  }, [item?.id, item?.type, item?.content]);

  // Default to reader mode for articles
  useEffect(() => {
    if (item?.type === "url" && item.is_article && item.article_content) {
      setIsReaderMode(true);
    } else {
      setIsReaderMode(false);
    }
  }, [item?.id, item?.type, item?.is_article, item?.article_content]);

  // Reset URL image error when item changes
  useEffect(() => {
    setUrlImageError(false);
  }, [item?.id]);

  const hasChanges = item?.type === "note" && editedContent !== item.content;

  const handleSave = useCallback(async () => {
    if (!item || !onUpdateItem || !hasChanges) return;
    setIsSaving(true);
    try {
      const updatedItem = {
        ...item,
        content: editedContent,
        updated_at: new Date().toISOString(),
      };
      await onUpdateItem(updatedItem);
    } finally {
      setIsSaving(false);
    }
  }, [item, editedContent, onUpdateItem, hasChanges]);

  const youtubeVideoId = useMemo(() => {
    if (!item || item.type !== "url") return null;
    return getYouTubeVideoId(item.content);
  }, [item]);

  const youtubeEmbedUrl = useMemo(() => {
    if (!youtubeVideoId) return null;
    // enablejsapi=0 disables YouTube's postMessage API that requires valid origin matching
    return `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=0&rel=0&enablejsapi=0`;
  }, [youtubeVideoId]);

  const xPostInfo = useMemo(() => {
    if (!item || item.type !== "url") return null;
    return getXPostInfo(item.content);
  }, [item]);

  const safeItemUrl = useMemo(() => {
    if (!item || item.type !== "url") return null;
    return getSafeExternalUrl(item.content);
  }, [item?.type, item?.content]);

  const safeSourceUrl = useMemo(() => {
    if (!item?.source_url) return null;
    return getSafeExternalUrl(item.source_url);
  }, [item?.source_url]);

  const safeImageHref = useMemo(() => {
    const candidate = fullImageUrl || item?.image_url || item?.content || "";
    return getSafeImageUrl(candidate);
  }, [fullImageUrl, item?.image_url, item?.content]);

  // Load full image on demand for external images
  useEffect(() => {
    if (!item || !isOpen) {
      setFullImageUrl(null);
      return;
    }

    if (item.type === "image" && item.image_external) {
      setIsLoadingFullImage(true);
      tauri
        .getFullImage(item.id)
        .then((url) => {
          setFullImageUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load full image:", err);
          setFullImageUrl(item.image_url || item.content);
        })
        .finally(() => {
          setIsLoadingFullImage(false);
        });
    } else {
      setFullImageUrl(null);
    }
  }, [item?.id, item?.type, item?.image_external, isOpen]);

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
              {/* Left: Content Preview / Editor */}
              <div
                className="flex-1 bg-stone-900 flex items-center justify-center overflow-hidden relative"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                {/* Navigation arrows (not for notes) */}
                {onNavigate && totalItems > 1 && item.type !== "note" && (
                  <>
                    <button
                      onClick={() => onNavigate("prev")}
                      className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10 ${
                        isHovering ? "opacity-100" : "opacity-0"
                      }`}
                      title="Previous (←)"
                    >
                      <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => onNavigate("next")}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10 ${
                        isHovering ? "opacity-100" : "opacity-0"
                      }`}
                      title="Next (→)"
                    >
                      <ChevronRightIcon className="w-6 h-6" />
                    </button>
                    <div
                      className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm font-medium z-10 transition-all ${
                        isHovering ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {currentIndex + 1} / {totalItems}
                    </div>
                  </>
                )}

                {item.type === "image" && (
                  <>
                    {isLoadingFullImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-stone-900/50">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                    <img
                      src={fullImageUrl || item.image_url || item.content}
                      alt={item.title || "Image"}
                      className="max-w-full max-h-full object-contain"
                    />
                  </>
                )}

                {item.type === "url" && youtubeVideoId && youtubeEmbedUrl && (
                  <iframe
                    src={youtubeEmbedUrl}
                    title={item.title || "YouTube video"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {item.type === "url" && xPostInfo && !youtubeVideoId && (
                  <div className="w-full h-full flex items-center justify-center p-8 bg-white overflow-auto">
                    <iframe
                      src={`https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${xPostInfo.postId}&theme=light`}
                      className="w-full max-w-xl border-0 rounded-xl"
                      style={{ height: "600px", maxHeight: "80vh" }}
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Reader Mode Toggle Button */}
                {item.type === "url" &&
                  !youtubeVideoId &&
                  !xPostInfo &&
                  item.article_content && (
                    <button
                      onClick={() => setIsReaderMode(!isReaderMode)}
                      className={`absolute top-4 right-4 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors z-10 flex items-center gap-1.5 ${
                        isReaderMode
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-white/90 text-stone-700 hover:bg-white"
                      }`}
                    >
                      <DocumentTextIcon className="w-4 h-4" />
                      {isReaderMode ? "Show Preview" : "Reader Mode"}
                    </button>
                  )}

                {/* Reader Mode Content */}
                {item.type === "url" &&
                  !youtubeVideoId &&
                  !xPostInfo &&
                  isReaderMode &&
                  item.article_content && (
                    <div className="w-full h-full overflow-auto bg-stone-50">
                      <article className="max-w-2xl mx-auto px-8 py-12">
                        <h1 className="text-2xl font-bold text-stone-800 mb-6 leading-tight">
                          {item.title}
                        </h1>
                        <div
                          className="prose prose-stone prose-lg max-w-none prose-headings:text-stone-800 prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(item.article_content, {
                              ALLOWED_TAGS: [
                                "p",
                                "br",
                                "strong",
                                "b",
                                "em",
                                "i",
                                "a",
                                "ul",
                                "ol",
                                "li",
                                "h1",
                                "h2",
                                "h3",
                                "h4",
                                "h5",
                                "h6",
                                "blockquote",
                                "code",
                                "pre",
                                "img",
                                "figure",
                                "figcaption",
                              ],
                              ALLOWED_ATTR: [
                                "href",
                                "target",
                                "rel",
                                "src",
                                "alt",
                              ],
                            }),
                          }}
                        />
                      </article>
                    </div>
                  )}

                {/* Standard URL preview (image or domain icon) */}
                {item.type === "url" &&
                  !youtubeVideoId &&
                  !xPostInfo &&
                  !isReaderMode &&
                  item.image_url &&
                  !urlImageError && (
                    <img
                      src={item.image_url}
                      alt={item.title || "Link preview"}
                      className="max-w-full max-h-full object-contain"
                      onError={() => setUrlImageError(true)}
                    />
                  )}

                {item.type === "url" &&
                  !youtubeVideoId &&
                  !xPostInfo &&
                  !isReaderMode &&
                  (!item.image_url || urlImageError) && (
                    <div className="flex flex-col items-center justify-center gap-4 p-8 text-stone-400">
                      <LinkIcon className="w-16 h-16" />
                      <span className="text-lg font-medium">
                        {getDomain(item.content)}
                      </span>
                    </div>
                  )}

                {/* Simple inline note editor - click to edit */}
                {item.type === "note" && onUpdateItem && (
                  <SimpleNoteEditor
                    content={editedContent}
                    onChange={setEditedContent}
                    onSave={handleSave}
                    hasChanges={hasChanges}
                    isSaving={isSaving}
                  />
                )}
              </div>

              {/* Right: Details Panel */}
              <div className="w-80 p-6 flex flex-col bg-white overflow-y-auto modal-scrollable relative">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>

                {/* Title */}
                <h2 className="text-lg font-semibold text-stone-800 pr-8">
                  {item.title ||
                    (item.type === "note"
                      ? "Note"
                      : item.type === "url"
                        ? getDomain(item.content)
                        : "Image")}
                </h2>

                {/* Date */}
                <p className="text-sm text-stone-400 mt-1">
                  {formatDate(item.created_at)}
                </p>

                {/* AI Summary */}
                {(item.summary || item.description) && (
                  <div className="mt-6">
                    <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2">
                      {item.summary ? "AI Summary" : "Description"}
                    </p>
                    <p className="text-sm text-stone-600 leading-relaxed bg-amber-50/50 rounded-lg p-3 border border-amber-100">
                      {item.summary || item.description}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                      Mind Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag, index) => (
                        <span
                          key={`${tag}-${index}`}
                          className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-medium hover:bg-stone-200 transition-colors cursor-default"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* URL Link */}
                {item.type === "url" && (
                  <div className="mt-6">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                      Source
                    </p>
                    {safeItemUrl ? (
                      <a
                        href={safeItemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 transition-colors group"
                      >
                        <span className="truncate">
                          {getDomain(item.content)}
                        </span>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <span className="text-sm text-stone-400 truncate">
                        {getDomain(item.content)}
                      </span>
                    )}
                  </div>
                )}

                {/* Source URL for notes/images */}
                {item.type !== "url" && item.source_url && (
                  <div className="mt-6">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                      Captured from
                    </p>
                    {safeSourceUrl ? (
                      <a
                        href={safeSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 transition-colors group"
                      >
                        <LinkIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                          {getDomain(item.source_url)}
                        </span>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <span className="flex items-center gap-2 text-sm text-stone-400 truncate">
                        <LinkIcon className="w-4 h-4 flex-shrink-0" />
                        {getDomain(item.source_url)}
                      </span>
                    )}
                  </div>
                )}

                {/* Color Palette for images */}
                {item.type === "image" &&
                  item.colors &&
                  item.colors.length > 0 && (
                    <div className="mt-6">
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                        Color Palette
                      </p>
                      <div className="flex gap-2">
                        {item.colors.map((color, index) => (
                          <div
                            key={`${color}-${index}`}
                            className="group relative"
                          >
                            <div
                              className="w-8 h-8 rounded-lg shadow-sm ring-1 ring-stone-200 cursor-pointer hover:scale-110 transition-transform"
                              style={{ backgroundColor: color }}
                              title={color}
                              onClick={() => {
                                navigator.clipboard.writeText(color);
                              }}
                            />
                            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-stone-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              {color}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100">
                  {item.type === "url" && safeItemUrl && (
                    <a
                      href={safeItemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors flex items-center gap-2"
                    >
                      {youtubeVideoId
                        ? "Open on YouTube"
                        : xPostInfo
                          ? "Open on X"
                          : "Open Link"}
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  )}
                  {item.type === "url" && !safeItemUrl && (
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 bg-stone-200 text-stone-400 rounded-lg text-sm font-medium cursor-not-allowed"
                    >
                      Invalid URL
                    </button>
                  )}
                  {item.type === "image" && safeImageHref && (
                    <a
                      href={safeImageHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors flex items-center gap-2"
                    >
                      View Full Size
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

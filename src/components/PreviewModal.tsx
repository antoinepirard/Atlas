import { useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import type { MymindItem } from "../types";
import { NoteContent } from "./CodeBlock";
import { detectCode } from "../utils/codeDetection";
import * as tauri from "../lib/tauri";

// Get font size class based on content length
function getFontSizeClass(contentLength: number): string {
  if (contentLength < 100) return "text-3xl";
  if (contentLength < 300) return "text-2xl";
  if (contentLength < 600) return "text-xl";
  if (contentLength < 1200) return "text-lg";
  return "text-base";
}

// Note preview component that handles both code and regular text
function NotePreview({ content }: { content: string }) {
  const { isCode } = useMemo(() => detectCode(content), [content]);
  const fontSizeClass = useMemo(
    () => getFontSizeClass(content.length),
    [content.length]
  );

  if (isCode) {
    return (
      <div className="p-6 w-full h-full flex items-start justify-center overflow-auto modal-scrollable bg-[#1e1e2e]">
        <div className="w-full max-w-4xl">
          <NoteContent content={content} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full h-full overflow-auto modal-scrollable bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="min-h-full flex items-center justify-center py-8">
        <div
          className={`max-w-2xl w-full ${fontSizeClass} text-stone-700 font-serif leading-relaxed note-markdown`}
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-[1.75em] font-bold mb-4 mt-6 first:mt-0 text-stone-800">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-[1.5em] font-semibold mb-3 mt-5 first:mt-0 text-stone-800">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-[1.25em] font-semibold mb-2 mt-4 first:mt-0 text-stone-800">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-[1.1em] font-medium mb-2 mt-3 first:mt-0 text-stone-800">
                  {children}
                </h4>
              ),
              p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc list-outside ml-6 mb-4 space-y-1">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-outside ml-6 mb-4 space-y-1">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="pl-1">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-amber-300 pl-4 py-1 my-4 italic text-stone-600 bg-amber-50/50 rounded-r">
                  {children}
                </blockquote>
              ),
              code: ({ className, children }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code className="bg-stone-200/70 text-stone-800 px-1.5 py-0.5 rounded text-[0.9em] font-mono">
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="block bg-stone-800 text-stone-100 p-4 rounded-lg my-4 text-[0.85em] font-mono overflow-x-auto">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => <pre className="my-4">{children}</pre>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:text-amber-700 underline underline-offset-2"
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-stone-800">
                  {children}
                </strong>
              ),
              em: ({ children }) => <em className="italic">{children}</em>,
              hr: () => <hr className="my-6 border-stone-300" />,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

interface PreviewModalProps {
  item: MymindItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  totalItems?: number;
  currentIndex?: number;
}

function getYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname === "youtube.com" && urlObj.pathname === "/watch") {
      return urlObj.searchParams.get("v");
    }
    if (hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }
    if (hostname === "youtube.com" && urlObj.pathname.startsWith("/embed/")) {
      return urlObj.pathname.replace("/embed/", "");
    }

    return null;
  } catch {
    return null;
  }
}

function getXPostInfo(
  url: string
): { username: string; postId: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return null;
    }

    const match = urlObj.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (match) {
      return { username: match[1], postId: match[2] };
    }

    return null;
  } catch {
    return null;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function PreviewModal({
  item,
  isOpen,
  onClose,
  onNavigate,
  totalItems = 0,
  currentIndex = -1,
}: PreviewModalProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [isLoadingFullImage, setIsLoadingFullImage] = useState(false);

  const youtubeVideoId = useMemo(() => {
    if (!item || item.type !== "url") return null;
    return getYouTubeVideoId(item.content);
  }, [item]);

  const xPostInfo = useMemo(() => {
    if (!item || item.type !== "url") return null;
    return getXPostInfo(item.content);
  }, [item]);

  // Load full image on demand for external images
  useEffect(() => {
    if (!item || !isOpen) {
      setFullImageUrl(null);
      return;
    }

    // If it's an image with external storage, load the full image
    if (item.type === "image" && item.image_external) {
      setIsLoadingFullImage(true);
      tauri
        .getFullImage(item.id)
        .then((url) => {
          setFullImageUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load full image:", err);
          // Fall back to thumbnail
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

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
              {/* Left: Content Preview */}
              <div
                className="flex-1 bg-stone-900 flex items-center justify-center overflow-hidden relative"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                {/* Navigation arrows */}
                {onNavigate && totalItems > 1 && (
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
                    {/* Item counter */}
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

                {item.type === "url" && youtubeVideoId && (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=0&rel=0&origin=${encodeURIComponent(
                      window.location.origin
                    )}`}
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

                {item.type === "url" &&
                  !youtubeVideoId &&
                  !xPostInfo &&
                  item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.title || "Link preview"}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}

                {item.type === "url" &&
                  !youtubeVideoId &&
                  !xPostInfo &&
                  !item.image_url && (
                    <div className="flex flex-col items-center justify-center gap-4 p-8 text-stone-400">
                      <LinkIcon className="w-16 h-16" />
                      <span className="text-lg font-medium">
                        {getDomain(item.content)}
                      </span>
                    </div>
                  )}

                {item.type === "note" && <NotePreview content={item.content} />}
              </div>

              {/* Right: Details Panel */}
              <div className="w-96 p-6 flex flex-col bg-white overflow-y-auto modal-scrollable relative">
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
                    <a
                      href={item.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 transition-colors group"
                    >
                      <span className="truncate">
                        {getDomain(item.content)}
                      </span>
                      <ArrowTopRightOnSquareIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>
                )}

                {/* Source URL for notes/images */}
                {item.type !== "url" && item.source_url && (
                  <div className="mt-6">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                      Captured from
                    </p>
                    <a
                      href={item.source_url}
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
                  {item.type === "url" && (
                    <a
                      href={item.content}
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
                  {item.type === "image" && (
                    <a
                      href={fullImageUrl || item.image_url || item.content}
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

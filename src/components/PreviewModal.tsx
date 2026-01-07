import { useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import type { MymindItem } from "../types";
import { NoteContent } from "./CodeBlock";
import { detectCode } from "../utils/codeDetection";

// Note preview component that handles both code and regular text
function NotePreview({ content }: { content: string }) {
  const { isCode } = useMemo(() => detectCode(content), [content]);

  if (isCode) {
    return (
      <div className="p-6 w-full h-full flex items-start justify-center overflow-auto bg-[#1e1e2e]">
        <div className="w-full max-w-4xl">
          <NoteContent content={content} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
      <p className="text-2xl text-stone-700 font-serif leading-relaxed max-w-lg text-center whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

interface PreviewModalProps {
  item: MymindItem | null;
  isOpen: boolean;
  onClose: () => void;
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

export function PreviewModal({ item, isOpen, onClose }: PreviewModalProps) {
  const youtubeVideoId = useMemo(() => {
    if (!item || item.type !== "url") return null;
    return getYouTubeVideoId(item.content);
  }, [item]);

  const xPostInfo = useMemo(() => {
    if (!item || item.type !== "url") return null;
    return getXPostInfo(item.content);
  }, [item]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
              <div className="flex-1 bg-stone-900 flex items-center justify-center overflow-hidden relative">
                {item.type === "image" && (
                  <img
                    src={item.content}
                    alt={item.title || "Image"}
                    className="max-w-full max-h-full object-contain"
                  />
                )}

                {item.type === "url" && youtubeVideoId && (
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=0&rel=0`}
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
              <div className="w-96 p-6 flex flex-col bg-white overflow-y-auto relative">
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
                      href={item.content}
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

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LinkIcon,
  DocumentTextIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";
import type { MymindItem } from "../types";
import { NoteContent } from "./CodeBlock";
import { detectCode } from "../utils/codeDetection";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onOpenExternal?: () => void;
  onCopy: () => void;
  showOpenExternal: boolean;
}

function ContextMenu({
  x,
  y,
  onClose,
  onDelete,
  onOpenExternal,
  onCopy,
  showOpenExternal,
}: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleScroll = () => onClose();
    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 bg-white rounded-lg shadow-lg ring-1 ring-stone-200 py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {showOpenExternal && onOpenExternal && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenExternal();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100 flex items-center gap-2"
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          Open in browser
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100 flex items-center gap-2"
      >
        <ClipboardIcon className="w-4 h-4" />
        Copy
      </button>
      <div className="border-t border-stone-100 my-1" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <TrashIcon className="w-4 h-4" />
        Delete
      </button>
    </motion.div>
  );
}

// Detect X/Twitter post URL and extract info
function getXPostInfo(
  url: string
): { username: string; postId: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return null;
    }

    // Match /username/status/postId pattern
    const match = urlObj.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (match) {
      return { username: match[1], postId: match[2] };
    }

    return null;
  } catch {
    return null;
  }
}

interface ItemCardProps {
  item: MymindItem;
  onDelete: () => void;
  onClick?: () => void;
}

export function ItemCard({ item, onDelete, onClick }: ItemCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open(item.content, "_blank", "noopener,noreferrer");
  }, [item.content]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(item.content);
  }, [item.content]);

  // Check if this is an X/Twitter post
  const xPostInfo = useMemo(() => {
    if (item.type !== "url") return null;
    return getXPostInfo(item.content);
  }, [item.type, item.content]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    await onDelete();
  }, [onDelete]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "";
    }
  };

  // Detect if content is code for notes
  const isCode = useMemo(() => {
    if (item.type !== "note") return false;
    return detectCode(item.content).isCode;
  }, [item.type, item.content]);

  // Special rendering for X/Twitter posts - embed the actual tweet
  if (item.type === "url" && xPostInfo) {
    const embedUrl = `https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${xPostInfo.postId}&theme=light`;

    return (
      <>
        <motion.div
          layout
          className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 ring-stone-200/50"
          onHoverStart={() => setShowMenu(true)}
          onHoverEnd={() => setShowMenu(false)}
          onContextMenu={handleContextMenu}
        >
          {/* Embedded Tweet */}
          <div className="relative w-full" style={{ minHeight: "250px" }}>
            <iframe
              src={embedUrl}
              className="w-full border-0 pointer-events-none"
              style={{ minHeight: "250px", height: "350px" }}
              scrolling="no"
              loading="lazy"
            />

            {/* Click overlay to trigger preview modal */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={onClick}
            />
          </div>

          {/* Hover actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showMenu ? 1 : 0 }}
            className="absolute top-2 right-2 flex items-center gap-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={item.content}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-600 hover:text-stone-800 rounded-lg shadow-sm transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
        <AnimatePresence>
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onDelete={handleDelete}
              onOpenExternal={handleOpenExternal}
              onCopy={handleCopy}
              showOpenExternal={true}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Standard URL rendering
  if (item.type === "url") {
    return (
      <>
        <motion.div
          layout
          className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 ring-stone-200/50 cursor-pointer"
          onHoverStart={() => setShowMenu(true)}
          onHoverEnd={() => setShowMenu(false)}
          onClick={onClick}
          onContextMenu={handleContextMenu}
        >
          {item.image_url && (
            <div className="block overflow-hidden bg-stone-100">
              <img
                src={item.image_url}
                alt={item.title || "Link preview"}
                className="w-full max-h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          )}

          <div className="p-4">
            <div className="block">
              {item.title && (
                <h3 className="text-sm font-medium text-stone-800 mb-1 line-clamp-2 group-hover:text-amber-600 transition-colors">
                  {item.title}
                </h3>
              )}
              {item.description && (
                <p className="text-xs text-stone-500 line-clamp-2 mb-2">
                  {item.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-400">
              <LinkIcon className="w-3.5 h-3.5" />
              <span className="truncate">{getDomain(item.content)}</span>
              <span>·</span>
              <span>{formatDate(item.created_at)}</span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showMenu ? 1 : 0 }}
            className="absolute top-2 right-2 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={item.content}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-600 hover:text-stone-800 rounded-lg shadow-sm transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
        <AnimatePresence>
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onDelete={handleDelete}
              onOpenExternal={handleOpenExternal}
              onCopy={handleCopy}
              showOpenExternal={true}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  if (item.type === "image") {
    return (
      <>
        <motion.div
          layout
          className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          onHoverStart={() => setShowMenu(true)}
          onHoverEnd={() => setShowMenu(false)}
          onClick={onClick}
          onContextMenu={handleContextMenu}
        >
          <div className="relative">
            <img
              src={item.image_url || item.content}
              alt={item.title || "Saved image"}
              className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showMenu ? 1 : 0 }}
              className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showMenu ? 1 : 0 }}
              className="absolute top-2 right-2 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={item.content}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-600 hover:text-stone-800 rounded-lg shadow-sm transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showMenu ? 1 : 0, y: showMenu ? 0 : 10 }}
              className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-end"
            >
              <span className="text-[10px] text-white/80 font-medium">
                {formatDate(item.created_at)}
              </span>
            </motion.div>
          </div>
        </motion.div>
        <AnimatePresence>
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onDelete={handleDelete}
              onOpenExternal={handleOpenExternal}
              onCopy={handleCopy}
              showOpenExternal={true}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Note type - with code detection
  return (
    <>
      <motion.div
        layout
        className={`group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
          isCode
            ? "bg-[#1e1e2e] border border-stone-700/50"
            : "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50"
        }`}
        onHoverStart={() => setShowMenu(true)}
        onHoverEnd={() => setShowMenu(false)}
        onClick={onClick}
        onContextMenu={handleContextMenu}
      >
        <div className="p-4">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${
              isCode ? "bg-violet-500/20" : "bg-amber-100"
            }`}
          >
            {isCode ? (
              <CodeBracketIcon className="w-4 h-4 text-violet-400" />
            ) : (
              <DocumentTextIcon className="w-4 h-4 text-amber-600" />
            )}
          </div>

          <div className="mb-3">
            <NoteContent content={item.content} compact maxLines={6} />
          </div>

          <div
            className={`flex items-center gap-2 text-[10px] ${
              isCode ? "text-stone-500" : "text-stone-400"
            }`}
          >
            <span>{formatDate(item.created_at)}</span>
            {item.source_url && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 truncate">
                  <LinkIcon className="w-3 h-3" />
                  {getDomain(item.source_url)}
                </span>
              </>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showMenu ? 1 : 0 }}
          className="absolute top-2 right-2 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`p-1.5 backdrop-blur-sm rounded-lg shadow-sm transition-colors disabled:opacity-50 ${
              isCode
                ? "bg-stone-800/90 text-stone-400 hover:text-red-400"
                : "bg-white/90 text-stone-400 hover:text-red-500"
            }`}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onDelete={handleDelete}
            onCopy={handleCopy}
            showOpenExternal={false}
          />
        )}
      </AnimatePresence>
    </>
  );
}

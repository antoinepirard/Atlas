import { useCallback, useEffect, useState } from "react";
import DOMPurify from "dompurify";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import type { Item } from "../../types";
import { getDomain } from "../../utils/urlUtils";
import { SimpleNoteEditor } from "../SimpleNoteEditor";

type XPostInfo = { username: string; postId: string } | null;

const ARTICLE_SANITIZE_OPTIONS = {
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
  ALLOWED_ATTR: ["href", "target", "rel", "src", "alt"],
};

interface PreviewContentProps {
  item: Item;
  onNavigate?: (direction: "prev" | "next") => void;
  totalItems: number;
  currentIndex: number;
  fullImageUrl: string | null;
  isLoadingFullImage: boolean;
  onUpdateItem?: (item: Item) => Promise<Item | null>;
  youtubeVideoId: string | null;
  youtubeEmbedUrl: string | null;
  xPostInfo: XPostInfo;
}

export function PreviewContent({
  item,
  onNavigate,
  totalItems,
  currentIndex,
  fullImageUrl,
  isLoadingFullImage,
  onUpdateItem,
  youtubeVideoId,
  youtubeEmbedUrl,
  xPostInfo,
}: PreviewContentProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isReaderMode, setIsReaderMode] = useState(false);
  const [urlImageError, setUrlImageError] = useState(false);

  useEffect(() => {
    if (item.type === "note") {
      setEditedContent(item.content);
    }
  }, [item.id, item.type, item.content]);

  useEffect(() => {
    if (item.type === "url" && item.is_article && item.article_content) {
      setIsReaderMode(true);
    } else {
      setIsReaderMode(false);
    }
  }, [item.id, item.type, item.is_article, item.article_content]);

  useEffect(() => {
    setUrlImageError(false);
  }, [item.id]);

  const hasChanges = item.type === "note" && editedContent !== item.content;

  const handleSave = useCallback(async () => {
    if (!onUpdateItem || !hasChanges) return;
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

  const showNavigation = onNavigate && totalItems > 1 && item.type !== "note";
  const isUrlPreview = item.type === "url" && !youtubeVideoId && !xPostInfo;

  return (
    <div
      className="flex-1 bg-stone-900 flex items-center justify-center overflow-hidden relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {showNavigation && (
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

      {isUrlPreview && item.article_content && (
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

      {isUrlPreview && isReaderMode && item.article_content && (
        <div className="w-full h-full overflow-auto bg-stone-50">
          <article className="max-w-2xl mx-auto px-8 py-12">
            <h1 className="text-2xl font-bold text-stone-800 mb-6 leading-tight">
              {item.title}
            </h1>
            <div
              className="prose prose-stone prose-lg max-w-none prose-headings:text-stone-800 prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  item.article_content,
                  ARTICLE_SANITIZE_OPTIONS
                ),
              }}
            />
          </article>
        </div>
      )}

      {isUrlPreview && !isReaderMode && item.image_url && !urlImageError && (
        <img
          src={item.image_url}
          alt={item.title || "Link preview"}
          className="max-w-full max-h-full object-contain"
          onError={() => setUrlImageError(true)}
        />
      )}

      {isUrlPreview && !isReaderMode && (!item.image_url || urlImageError) && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-stone-400">
          <LinkIcon className="w-16 h-16" />
          <span className="text-lg font-medium">{getDomain(item.content)}</span>
        </div>
      )}

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
  );
}

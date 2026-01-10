import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { DocumentTextIcon, LinkIcon } from "@heroicons/react/24/outline";
import type { Item } from "../../types";
import { getDomain } from "../../utils/urlUtils";

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
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "span",
    "img",
    "figure",
    "figcaption",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "src", "alt"],
};

interface UrlPreviewProps {
  item: Item;
}

export function UrlPreview({ item }: UrlPreviewProps) {
  const [isReaderMode, setIsReaderMode] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasRichContent =
    !!item.article_content && (item.is_article || item.subtype === "code");
  const richContentLabel = item.subtype === "code" ? "README" : "Reader Mode";

  useEffect(() => {
    if (hasRichContent) {
      setIsReaderMode(true);
    } else {
      setIsReaderMode(false);
    }
  }, [hasRichContent, item.id]);

  useEffect(() => {
    setImageError(false);
  }, [item.id, item.image_url]);

  const fallbackTitle = item.title || getDomain(item.content);
  const fallbackSummary = item.summary || item.description;

  if (isReaderMode && hasRichContent) {
    return (
      <>
        <button
          onClick={() => setIsReaderMode(false)}
          className="absolute top-4 right-4 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors z-10 flex items-center gap-1.5 bg-amber-500 text-white hover:bg-amber-600"
        >
          <DocumentTextIcon className="w-4 h-4" />
          Show Preview
        </button>
        <div className="w-full h-full overflow-auto bg-stone-50">
          <article className="max-w-2xl mx-auto px-8 py-12">
            <h1 className="text-2xl font-bold text-stone-800 mb-6 leading-tight">
              {item.title}
            </h1>
            <div
              className="prose prose-stone prose-lg max-w-none prose-headings:text-stone-800 prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  item.article_content ?? "",
                  ARTICLE_SANITIZE_OPTIONS
                ),
              }}
            />
          </article>
        </div>
      </>
    );
  }

  return (
    <>
      {hasRichContent && (
        <button
          onClick={() => setIsReaderMode(true)}
          className="absolute top-4 right-4 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors z-10 flex items-center gap-1.5 bg-white/90 text-stone-700 hover:bg-white"
        >
          <DocumentTextIcon className="w-4 h-4" />
          {richContentLabel}
        </button>
      )}

      {item.image_url && !imageError ? (
        <img
          src={item.image_url}
          alt={item.title || "Link preview"}
          className="max-w-full max-h-full object-contain"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-stone-300 text-center">
          <LinkIcon className="w-16 h-16" />
          <div className="max-w-xl">
            <p className="text-lg font-semibold text-stone-200">
              {fallbackTitle}
            </p>
            {fallbackSummary ? (
              <p className="text-sm text-stone-400 mt-2 line-clamp-3">
                {fallbackSummary}
              </p>
            ) : (
              <p className="text-sm text-stone-500 mt-2">
                {getDomain(item.content)}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

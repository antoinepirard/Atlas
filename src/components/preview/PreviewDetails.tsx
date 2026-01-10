import { useMemo } from "react";
import {
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  XMarkIcon,
  PlayIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  MusicalNoteIcon,
  ChatBubbleLeftIcon,
  CameraIcon,
  PhotoIcon,
  ChartBarIcon,
  DocumentIcon,
  PaintBrushIcon,
  ListBulletIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/outline";
import type { Item } from "../../types";
import { formatDate, getDomain } from "../../utils/urlUtils";

type XPostInfo = { username: string; postId: string } | null;

// Subtype display configuration
const subtypeConfig: Record<
  string,
  { label: string; icon: typeof PlayIcon; color: string }
> = {
  // URL subtypes
  video: { label: "Video", icon: PlayIcon, color: "text-red-500 bg-red-50" },
  product: {
    label: "Product",
    icon: ShoppingBagIcon,
    color: "text-amber-500 bg-amber-50",
  },
  article: {
    label: "Article",
    icon: DocumentTextIcon,
    color: "text-blue-500 bg-blue-50",
  },
  code: {
    label: "Code",
    icon: CodeBracketIcon,
    color: "text-violet-500 bg-violet-50",
  },
  audio: {
    label: "Audio",
    icon: MusicalNoteIcon,
    color: "text-green-500 bg-green-50",
  },
  social: {
    label: "Social",
    icon: ChatBubbleLeftIcon,
    color: "text-sky-500 bg-sky-50",
  },
  // Image subtypes
  screenshot: {
    label: "Screenshot",
    icon: CameraIcon,
    color: "text-purple-500 bg-purple-50",
  },
  photo: {
    label: "Photo",
    icon: PhotoIcon,
    color: "text-emerald-500 bg-emerald-50",
  },
  diagram: {
    label: "Diagram",
    icon: ChartBarIcon,
    color: "text-orange-500 bg-orange-50",
  },
  document: {
    label: "Document",
    icon: DocumentIcon,
    color: "text-gray-500 bg-gray-50",
  },
  illustration: {
    label: "Illustration",
    icon: PaintBrushIcon,
    color: "text-pink-500 bg-pink-50",
  },
  // Note subtypes
  plain: {
    label: "Note",
    icon: DocumentTextIcon,
    color: "text-amber-500 bg-amber-50",
  },
  checklist: {
    label: "Checklist",
    icon: ListBulletIcon,
    color: "text-emerald-500 bg-emerald-50",
  },
  quote: {
    label: "Quote",
    icon: ChatBubbleBottomCenterTextIcon,
    color: "text-purple-500 bg-purple-50",
  },
};

interface PreviewDetailsProps {
  item: Item;
  onClose: () => void;
  safeItemUrl: string | null;
  safeSourceUrl: string | null;
  safeImageHref: string | null;
  youtubeVideoId: string | null;
  xPostInfo: XPostInfo;
}

export function PreviewDetails({
  item,
  onClose,
  safeItemUrl,
  safeSourceUrl,
  safeImageHref,
  youtubeVideoId,
  xPostInfo,
}: PreviewDetailsProps) {
  // Get subtype display info
  const subtypeInfo = useMemo(() => {
    if (!item.subtype) return null;
    const config = subtypeConfig[item.subtype];
    if (!config) return null;
    // Only show badge if confidence is decent
    if (
      item.subtype_confidence !== undefined &&
      item.subtype_confidence < 0.5
    ) {
      return null;
    }
    return config;
  }, [item.subtype, item.subtype_confidence]);

  return (
    <div className="w-80 p-6 flex flex-col bg-white overflow-y-auto modal-scrollable relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-600"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>

      {/* Subtype badge */}
      {subtypeInfo && (
        <div className="mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${subtypeInfo.color}`}
          >
            <subtypeInfo.icon className="w-3.5 h-3.5" />
            {subtypeInfo.label}
          </span>
        </div>
      )}

      <h2 className="text-lg font-semibold text-stone-800 pr-8">
        {item.title ||
          (item.type === "note"
            ? "Note"
            : item.type === "url"
              ? getDomain(item.content)
              : "Image")}
      </h2>

      <p className="text-sm text-stone-400 mt-1">
        {formatDate(item.created_at)}
      </p>

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
              <span className="truncate">{getDomain(item.content)}</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ) : (
            <span className="text-sm text-stone-400 truncate">
              {getDomain(item.content)}
            </span>
          )}
        </div>
      )}

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
              <span className="truncate">{getDomain(item.source_url)}</span>
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

      {item.type === "image" && item.colors && item.colors.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
            Color Palette
          </p>
          <div className="flex gap-2">
            {item.colors.map((color, index) => (
              <div key={`${color}-${index}`} className="group relative">
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

      <div className="flex-1" />

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
  );
}

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { Item } from "../../types";
import { ImagePreview } from "./ImagePreview";
import { NotePreview } from "./NotePreview";
import { PlacePreview } from "./PlacePreview";
import { UrlPreview } from "./UrlPreview";

type XPostInfo = { username: string; postId: string } | null;

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
        <ImagePreview
          item={item}
          fullImageUrl={fullImageUrl}
          isLoadingFullImage={isLoadingFullImage}
        />
      )}

      {item.type === "url" && youtubeVideoId && youtubeEmbedUrl && (
        <iframe
          src={youtubeEmbedUrl}
          title={item.title || "YouTube video"}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
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

      {isUrlPreview &&
        (item.subtype === "place" ? (
          <PlacePreview item={item} />
        ) : (
          <UrlPreview item={item} />
        ))}

      {item.type === "note" && onUpdateItem && (
        <NotePreview item={item} onUpdateItem={onUpdateItem} />
      )}
    </div>
  );
}

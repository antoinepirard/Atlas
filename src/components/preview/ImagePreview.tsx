import type { Item } from "../../types";

interface ImagePreviewProps {
  item: Item;
  fullImageUrl: string | null;
  isLoadingFullImage: boolean;
}

export function ImagePreview({
  item,
  fullImageUrl,
  isLoadingFullImage,
}: ImagePreviewProps) {
  return (
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
  );
}

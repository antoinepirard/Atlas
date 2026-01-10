import { useEffect, useMemo, useState } from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";
import type { Item } from "../../types";
import {
  getDomain,
  getMapEmbedUrl,
  getSafeExternalUrl,
  getSafeImageUrl,
  getStaticMapUrls,
} from "../../utils/urlUtils";

interface PlacePreviewProps {
  item: Item;
}

export function PlacePreview({ item }: PlacePreviewProps) {
  const [mapError, setMapError] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [mapIndex, setMapIndex] = useState(0);
  const [embedReady, setEmbedReady] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  useEffect(() => {
    setMapError(false);
    setPhotoError(false);
    setMapIndex(0);
    setEmbedReady(false);
    setPhotoExpanded(false);
  }, [item.id]);

  const staticMapUrls = useMemo(() => {
    return getStaticMapUrls(item.content)
      .map((mapUrl) => getSafeImageUrl(mapUrl))
      .filter((mapUrl): mapUrl is string => Boolean(mapUrl));
  }, [item.content]);

  const mapEmbedUrl = useMemo(() => {
    return getMapEmbedUrl(item.content);
  }, [item.content]);

  const safeMapEmbedUrl = mapEmbedUrl ? getSafeExternalUrl(mapEmbedUrl) : null;
  const safeStaticMapUrl = staticMapUrls[mapIndex] || null;
  const safePlacePhotoUrl = item.image_url
    ? getSafeImageUrl(item.image_url)
    : null;
  const showStaticMap = !!safeStaticMapUrl && !mapError;
  const showPlacePhoto = !!safePlacePhotoUrl && !photoError;

  const placeTitle = item.title || getDomain(item.content);
  const placeDetail = item.description || item.summary;

  return (
    <div className="w-full h-full relative">
      {showStaticMap ? (
        <img
          src={safeStaticMapUrl as string}
          alt={placeTitle}
          className="w-full h-full object-cover"
          onError={() => {
            if (mapIndex < staticMapUrls.length - 1) {
              setMapIndex((current) => current + 1);
            } else {
              setMapError(true);
            }
          }}
        />
      ) : showPlacePhoto ? (
        <img
          src={safePlacePhotoUrl as string}
          alt={placeTitle}
          className="w-full h-full object-cover"
          onError={() => setPhotoError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 via-stone-900 to-stone-950">
          <MapPinIcon className="w-14 h-14 text-emerald-200/60" />
        </div>
      )}

      {safeMapEmbedUrl && (
        <iframe
          src={safeMapEmbedUrl}
          title={`${placeTitle} map`}
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            embedReady ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          onLoad={() => setEmbedReady(true)}
        />
      )}

      {showStaticMap && showPlacePhoto && (
        <button
          type="button"
          onClick={() => setPhotoExpanded(true)}
          className="absolute bottom-6 right-6 w-24 h-24 rounded-xl overflow-hidden shadow-lg border border-white/40 bg-white/10 pointer-events-auto"
        >
          <img
            src={safePlacePhotoUrl as string}
            alt={`${placeTitle} photo`}
            className="w-full h-full object-cover"
            onError={() => setPhotoError(true)}
          />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 px-8 py-6 bg-gradient-to-t from-stone-900/80 via-stone-900/30 to-transparent pointer-events-none">
        <h2 className="text-xl font-semibold text-white/95">{placeTitle}</h2>
        {placeDetail && (
          <p className="text-sm text-stone-200/90 mt-1 line-clamp-2">
            {placeDetail}
          </p>
        )}
      </div>

      {photoExpanded && showPlacePhoto && (
        <button
          type="button"
          onClick={() => setPhotoExpanded(false)}
          className="absolute inset-0 bg-black/70 flex items-center justify-center p-8"
        >
          <img
            src={safePlacePhotoUrl as string}
            alt={`${placeTitle} expanded photo`}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
          />
        </button>
      )}
    </div>
  );
}

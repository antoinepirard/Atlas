import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { MapPinIcon } from "@heroicons/react/24/outline";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

function extractPlaceDetail(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s\|\s|,\s| - /);
  return parts[0]?.trim() || null;
}

export function PlaceCard({
  item,
  onDelete,
  onClick,
  isSelected,
  isMultiSelectMode,
  onSelect,
}: BaseCardProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [item.image_url]);

  const {
    showMenu,
    isDeleting,
    handleClick,
    handleContextMenu,
    handleDelete,
    handleHoverStart,
    handleHoverEnd,
  } = useCardState({
    item,
    onDelete,
    onClick,
    isMultiSelectMode,
    onSelect,
  });

  const platformName = useMemo(() => {
    const domain = getDomain(item.content);
    if (
      domain.includes("maps.google") ||
      (domain.includes("google.") && item.content.includes("/maps"))
    ) {
      return "Google Maps";
    }
    if (domain.includes("maps.apple")) return "Apple Maps";
    if (domain.includes("yelp")) return "Yelp";
    if (domain.includes("tripadvisor")) return "Tripadvisor";
    if (domain.includes("foursquare")) return "Foursquare";
    if (domain.includes("openstreetmap")) return "OpenStreetMap";
    if (domain.includes("bing.com")) return "Bing Maps";
    if (domain.includes("waze")) return "Waze";
    return domain;
  }, [item.content]);

  const placeDetail = useMemo(() => {
    return (
      extractPlaceDetail(item.description) ||
      extractPlaceDetail(item.summary) ||
      null
    );
  }, [item.description, item.summary]);

  return (
    <motion.div
      layout
      className={`group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 cursor-pointer ${
        isSelected ? "ring-2 ring-amber-500" : "ring-stone-200/50"
      }`}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <SelectionIndicator
        isMultiSelectMode={isMultiSelectMode}
        isSelected={isSelected}
      />

      <div className="relative bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50">
        {item.image_url && !imageError ? (
          <img
            src={item.image_url}
            alt={item.title || "Place preview"}
            className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-40 flex items-center justify-center">
            <MapPinIcon className="w-16 h-16 text-emerald-300" />
          </div>
        )}

        <span className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full">
          Place
        </span>
      </div>

      <div className="p-4 border-t border-stone-100">
        {item.title && (
          <h3 className="text-sm font-medium text-stone-800 mb-1 line-clamp-2 group-hover:text-emerald-600 transition-colors">
            {item.title}
          </h3>
        )}

        {placeDetail && (
          <p className="text-xs text-stone-500 line-clamp-1 mb-2">
            {placeDetail}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-stone-400">
          <MapPinIcon className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-medium">{platformName}</span>
          <span>-</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
      </div>

      <CardActions
        showMenu={showMenu}
        isMultiSelectMode={isMultiSelectMode}
        isDeleting={isDeleting}
        onDelete={handleDelete}
      />
    </motion.div>
  );
}

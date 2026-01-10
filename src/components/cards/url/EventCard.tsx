import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

function extractEventLabel(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const monthPattern =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?/i;
  const numericPattern = /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/;
  const timePattern = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i;

  const dateMatch =
    normalized.match(monthPattern) || normalized.match(numericPattern);
  const timeMatch = normalized.match(timePattern);

  if (dateMatch && timeMatch) {
    return `${dateMatch[0]} - ${timeMatch[0]}`;
  }
  if (dateMatch) return dateMatch[0];
  if (timeMatch) return timeMatch[0];
  return null;
}

export function EventCard({
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

  const eventLabel = useMemo(() => {
    const source = [item.title, item.summary, item.description]
      .filter(Boolean)
      .join(" ");
    return extractEventLabel(source);
  }, [item.title, item.summary, item.description]);

  const platformName = useMemo(() => {
    const domain = getDomain(item.content);
    if (domain.includes("eventbrite")) return "Eventbrite";
    if (domain.includes("meetup")) return "Meetup";
    if (domain.includes("lu.ma")) return "Luma";
    if (domain.includes("ticketmaster")) return "Ticketmaster";
    if (domain.includes("seatgeek")) return "SeatGeek";
    if (domain.includes("dice.fm")) return "DICE";
    if (domain.includes("facebook")) return "Facebook Events";
    return domain;
  }, [item.content]);

  const eventDetail = item.summary || item.description;

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

      <div className="relative bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50">
        {item.image_url && !imageError ? (
          <img
            src={item.image_url}
            alt={item.title || "Event preview"}
            className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-40 flex items-center justify-center">
            <CalendarDaysIcon className="w-16 h-16 text-rose-300" />
          </div>
        )}

        <span className="absolute top-2 right-2 px-2 py-0.5 bg-rose-500 text-white text-xs font-medium rounded-full">
          Event
        </span>

        {eventLabel && (
          <span className="absolute bottom-2 left-2 px-2.5 py-1 bg-white/90 text-rose-600 text-xs font-medium rounded-full shadow-sm">
            {eventLabel}
          </span>
        )}
      </div>

      <div className="p-4 border-t border-stone-100">
        {item.title && (
          <h3 className="text-sm font-medium text-stone-800 mb-1 line-clamp-2 group-hover:text-rose-600 transition-colors">
            {item.title}
          </h3>
        )}

        {eventDetail && (
          <p className="text-xs text-stone-500 line-clamp-2 mb-2">
            {eventDetail}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-stone-400">
          <CalendarDaysIcon className="w-3.5 h-3.5 text-rose-500" />
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

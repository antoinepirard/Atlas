import { useMemo } from "react";
import type { Item } from "../../types";
import { getXPostInfo } from "./utils";

// Base cards
import { XPostCard } from "./XPostCard";
import { UrlCard } from "./UrlCard";
import { ImageCard } from "./ImageCard";
import { NoteCard } from "./NoteCard";

// URL subtype cards
import {
  VideoCard,
  ProductCard,
  ArticleCard,
  CodeRepoCard,
  AudioCard,
} from "./url";

// Note subtype cards
import { ChecklistCard, QuoteCard } from "./note";

export interface ItemCardProps {
  item: Item;
  onDelete: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  isMultiSelectMode?: boolean;
  onSelect?: (id: string) => void;
}

export function ItemCard({
  item,
  onDelete,
  onClick,
  isSelected,
  isMultiSelectMode,
  onSelect,
}: ItemCardProps) {
  // Check if this is an X/Twitter post (legacy detection for items without subtype)
  const xPostInfo = useMemo(() => {
    if (item.type !== "url") return null;
    return getXPostInfo(item.content);
  }, [item.type, item.content]);

  const baseProps = {
    item,
    onDelete,
    onClick,
    isSelected,
    isMultiSelectMode,
    onSelect,
  };

  // URL routing by subtype
  if (item.type === "url") {
    switch (item.subtype) {
      case "video":
        return <VideoCard {...baseProps} />;
      case "product":
        return <ProductCard {...baseProps} />;
      case "article":
        return <ArticleCard {...baseProps} />;
      case "code":
        return <CodeRepoCard {...baseProps} />;
      case "audio":
        return <AudioCard {...baseProps} />;
      case "social":
        // Use XPostCard for X/Twitter posts
        if (xPostInfo)
          return <XPostCard {...baseProps} xPostInfo={xPostInfo} />;
        return <UrlCard {...baseProps} />;
      default:
        // Legacy fallback: check for xPostInfo (for old items without subtype)
        if (xPostInfo)
          return <XPostCard {...baseProps} xPostInfo={xPostInfo} />;
        return <UrlCard {...baseProps} />;
    }
  }

  // Note routing by subtype
  if (item.type === "note") {
    switch (item.subtype) {
      case "checklist":
        return <ChecklistCard {...baseProps} />;
      case "quote":
        return <QuoteCard {...baseProps} />;
      default:
        // NoteCard handles both "code" and "plain" subtypes internally
        return <NoteCard {...baseProps} />;
    }
  }

  // Image routing (use base ImageCard for now, subtypes handled by AI)
  if (item.type === "image") {
    return <ImageCard {...baseProps} />;
  }

  // Default fallback
  return <NoteCard {...baseProps} />;
}

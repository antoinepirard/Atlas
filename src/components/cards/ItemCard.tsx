import { useMemo } from "react";
import type { MymindItem } from "../../types";
import { getXPostInfo } from "./utils";
import { XPostCard } from "./XPostCard";
import { UrlCard } from "./UrlCard";
import { ImageCard } from "./ImageCard";
import { NoteCard } from "./NoteCard";

export interface ItemCardProps {
  item: MymindItem;
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
  // Check if this is an X/Twitter post
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

  // Route to the appropriate card component
  if (item.type === "url" && xPostInfo) {
    return <XPostCard {...baseProps} xPostInfo={xPostInfo} />;
  }

  if (item.type === "url") {
    return <UrlCard {...baseProps} />;
  }

  if (item.type === "image") {
    return <ImageCard {...baseProps} />;
  }

  // Default to note
  return <NoteCard {...baseProps} />;
}


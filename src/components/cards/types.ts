import type { MymindItem } from "../../types";

export interface BaseCardProps {
  item: MymindItem;
  onDelete: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  isMultiSelectMode?: boolean;
  onSelect?: (id: string) => void;
}

export interface XPostInfo {
  username: string;
  postId: string;
}

export interface XPostCardProps extends BaseCardProps {
  xPostInfo: XPostInfo;
}

export interface CardActionsProps {
  showMenu: boolean;
  isMultiSelectMode?: boolean;
  isDeleting: boolean;
  onDelete: () => void;
  externalUrl?: string;
  isDark?: boolean;
}

export interface SelectionIndicatorProps {
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
}


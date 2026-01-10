import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import type { BaseCardProps } from "../types";
import { useCardState } from "../useCardState";
import { SelectionIndicator } from "../SelectionIndicator";
import { CardActions } from "../CardActions";
import { formatDate, getDomain } from "../utils";

export function ProductCard({
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

  // Get store name from domain
  const storeName = useMemo(() => {
    const domain = getDomain(item.content);
    if (domain.includes("amazon")) return "Amazon";
    if (domain.includes("ebay")) return "eBay";
    if (domain.includes("etsy")) return "Etsy";
    if (domain.includes("walmart")) return "Walmart";
    if (domain.includes("target")) return "Target";
    if (domain.includes("bestbuy")) return "Best Buy";
    if (domain.includes("aliexpress")) return "AliExpress";
    if (domain.includes("shopify")) return "Shopify";
    return domain;
  }, [item.content]);

  const productDetail = item.description || item.summary;

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

      {/* Product image */}
      <div className="relative bg-stone-50 overflow-hidden">
        {item.image_url && !imageError ? (
          <div className="p-4">
            <img
              src={item.image_url}
              alt={item.title || "Product image"}
              className="w-full h-40 object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-40 flex items-center justify-center">
            <ShoppingBagIcon className="w-16 h-16 text-stone-300" />
          </div>
        )}

        {/* Product badge */}
        <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
          Product
        </span>
      </div>

      <div className="p-4 border-t border-stone-100">
        {item.title && (
          <h3 className="text-sm font-medium text-stone-800 mb-1 line-clamp-2 group-hover:text-amber-600 transition-colors">
            {item.title}
          </h3>
        )}

        {productDetail && (
          <p className="text-xs text-stone-500 line-clamp-2 mb-2">
            {productDetail}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-stone-400">
          <ShoppingBagIcon className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-medium">{storeName}</span>
          <span>·</span>
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

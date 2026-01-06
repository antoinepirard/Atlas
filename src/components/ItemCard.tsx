import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  LinkIcon,
  DocumentTextIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import type { MymindItem } from '../types';

interface ItemCardProps {
  item: MymindItem;
  onDelete: () => void;
  onClick?: () => void;
}

export function ItemCard({ item, onDelete, onClick }: ItemCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    await onDelete();
  }, [onDelete]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  if (item.type === 'url') {
    return (
      <motion.div
        layout
        className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ring-1 ring-stone-200/50 cursor-pointer"
        onHoverStart={() => setShowMenu(true)}
        onHoverEnd={() => setShowMenu(false)}
        onClick={onClick}
      >
        {item.image_url && (
          <div className="block overflow-hidden bg-stone-100">
            <img
              src={item.image_url}
              alt={item.title || 'Link preview'}
              className="w-full max-h-64 object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        )}

        <div className="p-4">
          <div className="block">
            {item.title && (
              <h3 className="text-sm font-medium text-stone-800 mb-1 line-clamp-2 group-hover:text-amber-600 transition-colors">
                {item.title}
              </h3>
            )}
            {item.description && (
              <p className="text-xs text-stone-500 line-clamp-2 mb-2">
                {item.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-400">
            <LinkIcon className="w-3.5 h-3.5" />
            <span className="truncate">{getDomain(item.content)}</span>
            <span>·</span>
            <span>{formatDate(item.created_at)}</span>
          </div>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {item.tags.slice(0, 4).map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full text-[10px] font-medium max-w-24 truncate"
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 4 && (
                <span className="px-2 py-0.5 text-stone-400 text-[10px]">
                  +{item.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showMenu ? 1 : 0 }}
          className="absolute top-2 right-2 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href={item.content}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-600 hover:text-stone-800 rounded-lg shadow-sm transition-colors"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    );
  }

  if (item.type === 'image') {
    return (
      <motion.div
        layout
        className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        onHoverStart={() => setShowMenu(true)}
        onHoverEnd={() => setShowMenu(false)}
        onClick={onClick}
      >
        <div className="relative">
          <img
            src={item.content}
            alt={item.title || 'Saved image'}
            className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showMenu ? 1 : 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showMenu ? 1 : 0 }}
            className="absolute top-2 right-2 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={item.content}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-600 hover:text-stone-800 rounded-lg shadow-sm transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: showMenu ? 1 : 0, y: showMenu ? 0 : 10 }}
            className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between"
          >
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="px-2 py-0.5 bg-white/90 backdrop-blur-sm text-stone-700 rounded-full text-[10px] font-medium max-w-24 truncate"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <span className="text-[10px] text-white/80 font-medium">
              {formatDate(item.created_at)}
            </span>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Note type
  return (
    <motion.div
      layout
      className="group relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-amber-100/50 cursor-pointer"
      onHoverStart={() => setShowMenu(true)}
      onHoverEnd={() => setShowMenu(false)}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
          <DocumentTextIcon className="w-4 h-4 text-amber-600" />
        </div>

        <p className="text-sm text-stone-700 whitespace-pre-wrap line-clamp-6 mb-3">
          {item.content}
        </p>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.slice(0, 4).map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="px-2 py-0.5 bg-amber-100/50 text-amber-700 rounded-full text-[10px] font-medium max-w-24 truncate"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="text-[10px] text-stone-400">
          {formatDate(item.created_at)}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showMenu ? 1 : 0 }}
        className="absolute top-2 right-2 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1.5 bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
}


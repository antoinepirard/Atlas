import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import type { Space, CreateSpaceInput, UpdateSpaceInput } from "../types";

// Preset colors for spaces
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#78716c", // stone
];

interface SpaceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: Space[];
  onCreateSpace: (input: CreateSpaceInput) => Promise<Space>;
  onUpdateSpace: (input: UpdateSpaceInput) => Promise<Space>;
  onDeleteSpace: (id: string) => Promise<boolean>;
}

export function SpaceManagementModal({
  isOpen,
  onClose,
  spaces,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
}: SpaceManagementModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[5]); // default green
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setIsCreating(false);
      setNewName("");
      setNewColor(PRESET_COLORS[5]);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
        } else if (isCreating) {
          setIsCreating(false);
        } else if (deleteConfirmId) {
          setDeleteConfirmId(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, editingId, isCreating, deleteConfirmId, onClose]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setIsLoading(true);
    try {
      await onCreateSpace({ name: newName.trim(), color: newColor });
      setNewName("");
      setNewColor(PRESET_COLORS[5]);
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to create space:", err);
    } finally {
      setIsLoading(false);
    }
  }, [newName, newColor, onCreateSpace]);

  const handleStartEdit = useCallback((space: Space) => {
    setEditingId(space.id);
    setEditName(space.name);
    setEditColor(space.color);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    setIsLoading(true);
    try {
      await onUpdateSpace({
        id: editingId,
        name: editName.trim(),
        color: editColor,
      });
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update space:", err);
    } finally {
      setIsLoading(false);
    }
  }, [editingId, editName, editColor, onUpdateSpace]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    setIsLoading(true);
    try {
      await onDeleteSpace(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete space:", err);
    } finally {
      setIsLoading(false);
    }
  }, [deleteConfirmId, onDeleteSpace]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h2 className="text-lg font-semibold text-stone-900">
                Manage Spaces
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Space list */}
              <div className="space-y-2">
                {spaces.map((space) => (
                  <div
                    key={space.id}
                    className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg"
                  >
                    {editingId === space.id ? (
                      // Edit mode
                      <>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-stone-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <div className="flex items-center gap-1">
                          {PRESET_COLORS.slice(0, 8).map((color) => (
                            <button
                              key={color}
                              onClick={() => setEditColor(color)}
                              className={`w-5 h-5 rounded-full border-2 ${
                                editColor === color
                                  ? "border-stone-900"
                                  : "border-transparent"
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <button
                          onClick={handleSaveEdit}
                          disabled={isLoading || !editName.trim()}
                          className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-stone-400 hover:bg-stone-200 rounded-lg transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </>
                    ) : deleteConfirmId === space.id ? (
                      // Delete confirmation
                      <>
                        <span className="flex-1 text-sm text-stone-600">
                          Delete "{space.name}"?
                        </span>
                        <button
                          onClick={handleDelete}
                          disabled={isLoading}
                          className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1 text-xs font-medium text-stone-600 bg-stone-200 rounded-lg hover:bg-stone-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      // Display mode
                      <>
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: space.color }}
                        />
                        <span className="flex-1 text-sm font-medium text-stone-700 truncate">
                          {space.name}
                        </span>
                        <button
                          onClick={() => handleStartEdit(space)}
                          className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(space.id)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {spaces.length === 0 && !isCreating && (
                  <p className="text-center text-sm text-stone-400 py-6">
                    No spaces yet. Create one to organize your items.
                  </p>
                )}
              </div>

              {/* Create new space */}
              {isCreating ? (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Space name..."
                      className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                        if (e.key === "Escape") setIsCreating(false);
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          newColor === color
                            ? "border-stone-900 scale-110"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={isLoading || !newName.trim()}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      Create Space
                    </button>
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-200 rounded-lg hover:bg-stone-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create New Space
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  LinkIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  ClipboardDocumentIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type { QuickCaptureData } from "../types";

export type { QuickCaptureData };

interface QuickCaptureModalProps {
  isOpen: boolean;
  captureData: QuickCaptureData | null;
  onClose: () => void;
  onSaveUrl: (url: string) => Promise<void>;
  onSaveNote: (text: string, sourceUrl?: string) => Promise<void>;
}

type SaveMode = "url" | "note" | "both";

export function QuickCaptureModal({
  isOpen,
  captureData,
  onClose,
  onSaveUrl,
  onSaveNote,
}: QuickCaptureModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("url");
  const [editedText, setEditedText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine available save modes based on captured data
  const hasUrl = captureData?.url && captureData.url.length > 0;
  const hasText = captureData?.selected_text && captureData.selected_text.length > 0;

  // Reset state when new capture comes in
  useEffect(() => {
    if (isOpen && captureData) {
      setEditedText(captureData.selected_text || "");
      
      // Auto-select the best save mode
      if (hasText && hasUrl) {
        setSaveMode("both");
      } else if (hasText) {
        setSaveMode("note");
      } else if (hasUrl) {
        setSaveMode("url");
      }
      
      // Focus textarea if we have text
      if (hasText) {
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    }
  }, [isOpen, captureData, hasUrl, hasText]);

  const handleSubmit = useCallback(async () => {
    if (!captureData || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (saveMode === "url" && captureData.url) {
        await onSaveUrl(captureData.url);
      } else if (saveMode === "note" && editedText.trim()) {
        await onSaveNote(editedText.trim(), captureData.url || undefined);
      } else if (saveMode === "both") {
        // Save both: URL as link, text as note with source reference
        if (captureData.url) {
          await onSaveUrl(captureData.url);
        }
        if (editedText.trim()) {
          await onSaveNote(editedText.trim(), captureData.url || undefined);
        }
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [captureData, editedText, saveMode, isSubmitting, onSaveUrl, onSaveNote, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSubmit, onClose]
  );

  // Determine what we can save
  const canSave = 
    (saveMode === "url" && hasUrl) ||
    (saveMode === "note" && editedText.trim()) ||
    (saveMode === "both" && (hasUrl || editedText.trim()));

  return (
    <AnimatePresence>
      {isOpen && captureData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg"
            onKeyDown={handleKeyDown}
          >
            <div className="bg-white rounded-2xl shadow-2xl shadow-stone-900/10 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <SparklesIcon className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-stone-800">
                      Quick Capture
                    </h2>
                    <p className="text-xs text-stone-400">
                      from {captureData.app_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Source Info */}
              {hasUrl && (
                <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                  <div className="flex items-start gap-3">
                    <GlobeAltIcon className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      {captureData.page_title && (
                        <p className="text-sm font-medium text-stone-700 truncate">
                          {captureData.page_title}
                        </p>
                      )}
                      <p className="text-xs text-stone-400 truncate">
                        {captureData.url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Mode Selector */}
              {hasUrl && hasText && (
                <div className="flex items-center gap-1 px-5 py-3 bg-stone-50 border-b border-stone-100">
                  {[
                    { mode: "both" as const, label: "Save Both", icon: ClipboardDocumentIcon },
                    { mode: "url" as const, label: "Link Only", icon: LinkIcon },
                    { mode: "note" as const, label: "Note Only", icon: DocumentTextIcon },
                  ].map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      onClick={() => setSaveMode(mode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        saveMode === mode
                          ? "bg-white text-stone-800 shadow-sm"
                          : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Selected Text Preview/Edit */}
                {(saveMode === "note" || saveMode === "both") && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-stone-500">
                      <DocumentTextIcon className="w-3.5 h-3.5" />
                      {hasText ? "Selected Text" : "Add a Note"}
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      placeholder="Enter text to save..."
                      rows={hasText ? Math.min(8, Math.max(3, editedText.split('\n').length)) : 4}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 resize-none text-sm"
                    />
                  </div>
                )}

                {/* URL Preview */}
                {saveMode === "url" && hasUrl && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-stone-500">
                      <LinkIcon className="w-3.5 h-3.5" />
                      Link to Save
                    </label>
                    <div className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl">
                      <p className="text-sm text-stone-700 font-medium truncate">
                        {captureData.page_title || "Untitled Page"}
                      </p>
                      <p className="text-xs text-stone-400 truncate mt-1">
                        {captureData.url}
                      </p>
                    </div>
                  </div>
                )}

                {/* No content message */}
                {!hasUrl && !hasText && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
                      <ClipboardDocumentIcon className="w-6 h-6 text-stone-400" />
                    </div>
                    <p className="text-sm text-stone-500">
                      No content captured
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      Select text or open a webpage before using the shortcut
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 bg-stone-50 border-t border-stone-100">
                <p className="text-xs text-stone-400">
                  <kbd className="px-1 py-0.5 bg-stone-200 rounded text-stone-500 font-mono text-[10px]">
                    ⌘
                  </kbd>
                  {" + "}
                  <kbd className="px-1 py-0.5 bg-stone-200 rounded text-stone-500 font-mono text-[10px]">
                    ↵
                  </kbd>
                  {" to save"}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !canSave}
                    className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      `Save ${saveMode === "both" ? "Both" : saveMode === "url" ? "Link" : "Note"}`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


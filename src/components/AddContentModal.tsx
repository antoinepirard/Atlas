import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  LinkIcon,
  PhotoIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

interface AddContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddContent: (content: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<void>;
}

type InputMode = "auto" | "url" | "note" | "image";

export function AddContentModal({
  isOpen,
  onClose,
  onAddContent,
  onUploadImage,
}: AddContentModalProps) {
  const [mode, setMode] = useState<InputMode>("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [displayContent, setDisplayContent] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedType = useCallback((text: string): "url" | "note" => {
    try {
      const url = new URL(text.trim());
      if (url.protocol === "http:" || url.protocol === "https:") {
        return "url";
      }
    } catch {
      // Not a URL
    }
    return "note";
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDisplayContent("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const getContent = useCallback(() => {
    return inputRef.current?.value || "";
  }, []);

  const handleSubmit = useCallback(async () => {
    const content = getContent();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddContent(content.trim());
      if (inputRef.current) inputRef.current.value = "";
      setDisplayContent("");
      setMode("auto");
    } finally {
      setIsSubmitting(false);
    }
  }, [getContent, isSubmitting, onAddContent]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) => f.type.startsWith("image/"));

      if (imageFile) {
        setIsSubmitting(true);
        try {
          await onUploadImage(imageFile);
          if (inputRef.current) inputRef.current.value = "";
          setDisplayContent("");
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [onUploadImage]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsSubmitting(true);
      try {
        await onUploadImage(file);
        if (inputRef.current) inputRef.current.value = "";
        setDisplayContent("");
      } finally {
        setIsSubmitting(false);
      }
    },
    [onUploadImage]
  );

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

  const currentType =
    mode === "auto"
      ? detectedType(displayContent)
      : mode === "image"
        ? "note"
        : mode;

  return (
    <AnimatePresence>
      {isOpen && (
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
          >
            <div
              className={`bg-white rounded-2xl shadow-2xl shadow-stone-900/10 overflow-hidden transition-all ${
                dragActive ? "ring-2 ring-amber-400 ring-offset-2" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                <h2 className="text-lg font-medium text-stone-800">
                  Add to your mind
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-1 px-5 py-3 bg-stone-50 border-b border-stone-100">
                {[
                  { mode: "auto" as const, label: "Auto", icon: null },
                  { mode: "url" as const, label: "Link", icon: LinkIcon },
                  {
                    mode: "note" as const,
                    label: "Note",
                    icon: DocumentTextIcon,
                  },
                  { mode: "image" as const, label: "Image", icon: PhotoIcon },
                ].map(({ mode: m, label, icon: Icon }) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      mode === m
                        ? "bg-white text-stone-800 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="p-5">
                {mode === "image" ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      dragActive
                        ? "border-amber-400 bg-amber-50"
                        : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <ArrowUpTrayIcon className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                    <p className="text-sm text-stone-600 mb-1">
                      Drop an image or click to upload
                    </p>
                    <p className="text-xs text-stone-400">
                      PNG, JPG, GIF, WebP
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      ref={inputRef}
                      defaultValue=""
                      onChange={(e) => setDisplayContent(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        mode === "url"
                          ? "Paste a URL..."
                          : mode === "note"
                            ? "Write a note..."
                            : "Paste a URL or write a note..."
                      }
                      rows={4}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 resize-none"
                    />

                    {displayContent.trim() && (
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        {currentType === "url" ? (
                          <>
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span>Will be saved as a link</span>
                          </>
                        ) : (
                          <>
                            <DocumentTextIcon className="w-3.5 h-3.5" />
                            <span>Will be saved as a note</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save"
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

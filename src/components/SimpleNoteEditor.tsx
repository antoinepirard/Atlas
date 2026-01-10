import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { detectCode } from "../utils/codeDetection";
import { markdownComponents } from "./MarkdownComponents";

export interface SimpleNoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  hasChanges: boolean;
  isSaving: boolean;
}

/**
 * Simple inline note editor - click anywhere to edit, auto-saves
 */
export function SimpleNoteEditor({
  content,
  onChange,
  onSave,
  hasChanges,
  isSaving,
}: SimpleNoteEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const { isCode } = useMemo(() => detectCode(content), [content]);

  // Auto-save after 1.5 seconds of no typing
  useEffect(() => {
    if (hasChanges) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        onSave();
      }, 1500);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, hasChanges, onSave]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      // Place cursor at the end
      const endPosition = textarea.value.length;
      textarea.setSelectionRange(endPosition, endPosition);
    }
  }, [isEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape to exit edit mode
      if (e.key === "Escape") {
        e.preventDefault();
        setIsEditing(false);
        if (hasChanges) {
          onSave();
        }
      }
    },
    [hasChanges, onSave]
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow clicking on other elements
    setTimeout(() => {
      setIsEditing(false);
      if (hasChanges) {
        onSave();
      }
    }, 100);
  }, [hasChanges, onSave]);

  // Code content - always editable, styled like a code editor
  if (isCode) {
    return (
      <div className="w-full h-full bg-[#1e1e2e] overflow-auto">
        <div className="p-6 min-h-full">
          <div className="max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full min-h-[70vh] text-[13px] text-[#cdd6f4] leading-[1.7] resize-none focus:outline-none bg-transparent selection:bg-[#45475a]"
              style={{
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
                tabSize: 2,
                caretColor: "#f5e0dc",
              }}
            />
          </div>
        </div>
        {/* Subtle save indicator */}
        {isSaving && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-stone-700 text-stone-300 text-xs rounded-full shadow-lg">
            Saving...
          </div>
        )}
      </div>
    );
  }

  // Regular note - clean markdown editing
  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 overflow-auto">
      {isEditing ? (
        <div className="min-h-full p-8">
          <div className="max-w-2xl mx-auto">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Write something..."
              className="w-full min-h-[60vh] text-lg text-stone-700 font-serif leading-relaxed resize-none focus:outline-none bg-transparent placeholder-stone-400"
            />
          </div>
        </div>
      ) : (
        <div
          className="min-h-full p-8 cursor-text"
          onClick={() => setIsEditing(true)}
        >
          <div className="max-w-2xl mx-auto text-lg text-stone-700 font-serif leading-relaxed">
            {content.trim() ? (
              <ReactMarkdown components={markdownComponents}>
                {content}
              </ReactMarkdown>
            ) : (
              <p className="text-stone-400 italic">Click to start writing...</p>
            )}
          </div>
        </div>
      )}

      {/* Subtle save indicator */}
      {isSaving && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-stone-800 text-white text-xs rounded-full shadow-lg">
          Saving...
        </div>
      )}
    </div>
  );
}

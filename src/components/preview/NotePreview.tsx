import { useCallback, useEffect, useState } from "react";
import type { Item } from "../../types";
import { SimpleNoteEditor } from "../SimpleNoteEditor";

interface NotePreviewProps {
  item: Item;
  onUpdateItem: (item: Item) => Promise<Item | null>;
}

export function NotePreview({ item, onUpdateItem }: NotePreviewProps) {
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedContent(item.content);
  }, [item.id, item.content]);

  const hasChanges = editedContent !== item.content;

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const updatedItem = {
        ...item,
        content: editedContent,
        updated_at: new Date().toISOString(),
      };
      await onUpdateItem(updatedItem);
    } finally {
      setIsSaving(false);
    }
  }, [item, editedContent, onUpdateItem, hasChanges]);

  return (
    <SimpleNoteEditor
      content={editedContent}
      onChange={setEditedContent}
      onSave={handleSave}
      hasChanges={hasChanges}
      isSaving={isSaving}
    />
  );
}

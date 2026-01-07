import { useState, useCallback } from "react";
import * as tauri from "../lib/tauri";
import type { Item } from "../types";
import { detectType, isGenericTitle } from "../utils/contentUtils";
import { isXPostUrl, fetchTweetContent } from "../utils/twitterUtils";

export interface ItemOperationsCallbacks {
  onItemAdded: (item: Item) => void;
  onItemUpdated: (item: Item) => void;
  onItemDeleted: (id: string) => void;
  onItemsDeleted: (ids: string[]) => void;
  onCountChange: (delta: number) => void;
}

export interface UseItemOperationsReturn {
  isLoading: boolean;
  error: string | null;
  addContent: (content: string, sourceUrl?: string) => Promise<Item | null>;
  uploadImage: (file: File) => Promise<Item | null>;
  deleteItem: (itemId: string) => Promise<boolean>;
  deleteItems: (itemIds: string[]) => Promise<boolean>;
  updateItem: (updatedItem: Item) => Promise<Item | null>;
}

export function useItemOperations(
  callbacks: ItemOperationsCallbacks
): UseItemOperationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add content
  const addContent = useCallback(
    async (content: string, sourceUrl?: string): Promise<Item | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const itemType = detectType(content);
        let title: string | undefined;
        let description: string | undefined;
        let imageUrl: string | undefined;
        let tweetContent: string | undefined;
        let author: string | undefined;

        if (itemType === "url") {
          // Check if it's an X/Twitter post
          if (isXPostUrl(content)) {
            // Fetch tweet content via oEmbed for better AI summarization
            const tweetData = await fetchTweetContent(content);
            if (tweetData) {
              title = `Tweet by ${tweetData.author}`;
              description = tweetData.text;
              tweetContent = tweetData.text;
              author = tweetData.author;
            }
          }

          // Also fetch standard metadata (for image, etc.)
          try {
            const metadata = await tauri.fetchUrlMetadata(content);
            if (!title) title = metadata.title || undefined;
            if (!description) description = metadata.description || undefined;
            imageUrl = metadata.image || undefined;
            // Get author/channel name if not already set (e.g., from X/Twitter)
            if (!author && metadata.author) {
              author = metadata.author;
            }
          } catch {
            // Fallback
          }
        }

        // Process with AI - for X posts, pass the actual tweet text
        let tags: string[] = [itemType];
        let summary = "";
        let embedding: number[] = [];
        try {
          // For X posts, use the tweet content for AI processing
          const contentForAI = tweetContent || content;
          // Include author/channel in description for better tag generation
          const descriptionForAI = author
            ? `By: ${author}. ${description || ""}`
            : description;
          const aiResult = await tauri.processWithAI(
            contentForAI,
            itemType,
            title,
            descriptionForAI
          );
          tags = aiResult.tags;
          summary = aiResult.summary;
          embedding = aiResult.embedding;
          // Use AI-generated title if current title is missing or generic
          if (aiResult.title && isGenericTitle(title)) {
            title = aiResult.title;
          }
          // Auto-add author as a tag if present and not already included
          if (
            author &&
            !tags.some((t) =>
              t.toLowerCase().includes(author!.toLowerCase().split(" ")[0])
            )
          ) {
            // Add normalized version of author name as tag
            const authorTag = author
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, "")
              .trim();
            if (authorTag && !tags.includes(authorTag)) {
              tags.push(authorTag);
            }
          }
        } catch (err) {
          console.warn("AI processing failed, using defaults:", err);
        }

        const newItem = await tauri.addItem({
          content,
          type: itemType,
          title,
          description,
          summary: summary || undefined,
          image_url: imageUrl,
          source_url: sourceUrl,
          tags,
          embedding: embedding.length > 0 ? embedding : undefined,
        });

        callbacks.onItemAdded(newItem);
        callbacks.onCountChange(1);
        return newItem;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [callbacks]
  );

  // Upload image
  const uploadImage = useCallback(
    async (file: File): Promise<Item | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        let imageTags: string[] = ["image"];
        let imageSummary = "";
        let imageEmbedding: number[] = [];
        let imageTitle: string = file.name;
        try {
          const aiResult = await tauri.processWithAI(
            dataUrl,
            "image",
            file.name
          );
          imageTags = aiResult.tags;
          imageSummary = aiResult.summary;
          imageEmbedding = aiResult.embedding;
          // Use AI-generated title if filename is generic
          if (aiResult.title && isGenericTitle(file.name)) {
            imageTitle = aiResult.title;
          }
        } catch (err) {
          console.warn("AI processing failed, using defaults:", err);
        }

        const newItem = await tauri.addItem({
          content: dataUrl,
          type: "image",
          title: imageTitle,
          summary: imageSummary || undefined,
          image_url: dataUrl,
          tags: imageTags,
          embedding: imageEmbedding.length > 0 ? imageEmbedding : undefined,
        });

        callbacks.onItemAdded(newItem);
        callbacks.onCountChange(1);
        return newItem;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [callbacks]
  );

  // Delete item
  const deleteItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        await tauri.deleteItem(itemId);
        callbacks.onItemDeleted(itemId);
        callbacks.onCountChange(-1);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      }
    },
    [callbacks]
  );

  // Bulk delete items
  const deleteItems = useCallback(
    async (itemIds: string[]): Promise<boolean> => {
      try {
        // Delete items in parallel
        await Promise.all(itemIds.map((id) => tauri.deleteItem(id)));
        callbacks.onItemsDeleted(itemIds);
        callbacks.onCountChange(-itemIds.length);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      }
    },
    [callbacks]
  );

  // Update item (for editing notes)
  const updateItem = useCallback(
    async (updatedItem: Item): Promise<Item | null> => {
      try {
        const result = await tauri.updateItem(updatedItem);
        callbacks.onItemUpdated(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return null;
      }
    },
    [callbacks]
  );

  return {
    isLoading,
    error,
    addContent,
    uploadImage,
    deleteItem,
    deleteItems,
    updateItem,
  };
}


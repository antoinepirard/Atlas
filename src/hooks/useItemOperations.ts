import { useState, useCallback } from "react";
import * as tauri from "../lib/tauri";
import type { Item, ItemSubtype } from "../types";
import { detectType, isGenericTitle } from "../utils/contentUtils";
import { isXPostUrl, fetchTweetContent } from "../utils/twitterUtils";
import {
  detectUrlSubtypeByDomain,
  detectNoteSubtype,
  getDefaultImageSubtype,
  resolveSubtype,
} from "../utils/subtypeDetection";

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
  enrichItems: (items: Item[]) => Promise<{ updated: number; failed: number }>;
}

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

function isScreenshotFilename(name: string): boolean {
  const lowered = name.toLowerCase();
  return (
    lowered.includes("screenshot") ||
    lowered.includes("screen shot") ||
    lowered.includes("screen-shot") ||
    lowered.includes("screen_shot") ||
    lowered.includes("capture d'ecran") ||
    lowered.includes("capture d'écran")
  );
}

function isLikelyScreenshot(
  file: File,
  dimensions: { width: number; height: number } | null
): boolean {
  if (!dimensions) return false;
  if (!file.type.includes("png")) return false;
  const { width, height } = dimensions;
  if (width < 900 || height < 600) return false;
  const aspect = width / height;
  return aspect >= 1.2 && aspect <= 2.5;
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

        let articleContent: string | undefined;

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
            // Capture article content for reader mode
            if (metadata.article_content) {
              articleContent = metadata.article_content;
            }
          } catch {
            // Fallback
          }
        }

        // Process with AI - for X posts, pass the actual tweet text
        let tags: string[] = [itemType];
        let summary = "";
        let embedding: number[] = [];
        let isArticle = false;
        let aiSubtype: ItemSubtype | undefined;
        let aiSubtypeConfidence: number | undefined;
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
          isArticle = aiResult.is_article || false;
          aiSubtype = aiResult.subtype;
          aiSubtypeConfidence = aiResult.subtype_confidence;
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

        // Detect subtype using hybrid approach (domain detection + AI)
        let subtypeResult = null;
        if (itemType === "url") {
          const domainDetection = detectUrlSubtypeByDomain(content);
          subtypeResult = resolveSubtype(
            domainDetection,
            aiSubtype,
            aiSubtypeConfidence
          );
        } else if (itemType === "note") {
          subtypeResult = detectNoteSubtype(content);
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
          article_content: articleContent,
          is_article: isArticle,
          subtype: subtypeResult?.subtype,
          subtype_confidence: subtypeResult?.confidence,
          subtype_method: subtypeResult?.method,
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

        const dimensions = await getImageDimensions(file);
        const screenshotHint =
          isScreenshotFilename(file.name) ||
          isLikelyScreenshot(file, dimensions);

        let imageTags: string[] = ["image"];
        let imageSummary = "";
        let imageEmbedding: number[] = [];
        let imageTitle: string = file.name;
        let aiSubtype: ItemSubtype | undefined;
        let aiSubtypeConfidence: number | undefined;
        try {
          const aiResult = await tauri.processWithAI(
            dataUrl,
            "image",
            file.name
          );
          imageTags = aiResult.tags;
          imageSummary = aiResult.summary;
          imageEmbedding = aiResult.embedding;
          aiSubtype = aiResult.subtype;
          aiSubtypeConfidence = aiResult.subtype_confidence;
          // Use AI-generated title if filename is generic
          if (aiResult.title && isGenericTitle(file.name)) {
            imageTitle = aiResult.title;
          }
        } catch (err) {
          console.warn("AI processing failed, using defaults:", err);
        }

        // For images, use AI classification, with a screenshot override when likely
        const prefersScreenshot =
          screenshotHint &&
          (!aiSubtype ||
            aiSubtype === "illustration" ||
            (aiSubtypeConfidence !== undefined && aiSubtypeConfidence < 0.65));

        const subtypeResult = prefersScreenshot
          ? {
              subtype: "screenshot" as ItemSubtype,
              confidence: 0.65,
              method: "ai" as const,
            }
          : aiSubtype
            ? {
                subtype: aiSubtype,
                confidence: aiSubtypeConfidence ?? 0.5,
                method: "ai" as const,
              }
            : getDefaultImageSubtype();

        const newItem = await tauri.addItem({
          content: dataUrl,
          type: "image",
          title: imageTitle,
          summary: imageSummary || undefined,
          image_url: dataUrl,
          tags: imageTags,
          embedding: imageEmbedding.length > 0 ? imageEmbedding : undefined,
          subtype: subtypeResult.subtype,
          subtype_confidence: subtypeResult.confidence,
          subtype_method: subtypeResult.method,
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

  const enrichItem = useCallback(
    async (item: Item): Promise<Item | null> => {
      try {
        let title = item.title ?? undefined;
        let description = item.description ?? undefined;
        let imageUrl = item.image_url ?? undefined;
        let author: string | undefined;
        let articleContent = item.article_content ?? undefined;
        let contentForAI = item.content;

        if (item.type === "url") {
          if (isXPostUrl(item.content)) {
            const tweetData = await fetchTweetContent(item.content);
            if (tweetData) {
              title = `Tweet by ${tweetData.author}`;
              description = tweetData.text;
              contentForAI = tweetData.text;
              author = tweetData.author;
            }
          }

          try {
            const metadata = await tauri.fetchUrlMetadata(item.content);
            if (!title) title = metadata.title || undefined;
            if (!description) description = metadata.description || undefined;
            imageUrl = metadata.image || imageUrl;
            if (!author && metadata.author) {
              author = metadata.author;
            }
            if (metadata.article_content) {
              articleContent = metadata.article_content;
            }
          } catch {
            // Ignore metadata fetch errors and fall back to existing fields
          }
        } else if (item.type === "image") {
          if (item.image_external) {
            try {
              contentForAI = await tauri.getFullImage(item.id);
            } catch (err) {
              console.warn("Failed to load full image for AI:", err);
              contentForAI = item.image_url || item.content;
            }
          } else {
            contentForAI = item.image_url || item.content;
          }

          if (!contentForAI || contentForAI.startsWith("external:")) {
            throw new Error("Missing image data for AI");
          }
        }

        const descriptionForAI =
          item.type === "url"
            ? author
              ? `By: ${author}${description ? `. ${description}` : ""}`
              : description
            : undefined;

        const aiResult = await tauri.processWithAI(
          contentForAI,
          item.type,
          title,
          descriptionForAI
        );

        if (aiResult.title && isGenericTitle(title)) {
          title = aiResult.title;
        }

        let tags = aiResult.tags;
        if (
          author &&
          !tags.some((t) =>
            t.toLowerCase().includes(author.toLowerCase().split(" ")[0])
          )
        ) {
          const authorTag = author
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .trim();
          if (authorTag && !tags.includes(authorTag)) {
            tags = [...tags, authorTag];
          }
        }

        // Detect subtype using hybrid approach
        let subtypeResult = null;
        if (item.type === "url") {
          const domainDetection = detectUrlSubtypeByDomain(item.content);
          subtypeResult = resolveSubtype(
            domainDetection,
            aiResult.subtype,
            aiResult.subtype_confidence
          );
        } else if (item.type === "note") {
          subtypeResult = detectNoteSubtype(item.content);
        } else if (item.type === "image") {
          subtypeResult = aiResult.subtype
            ? {
                subtype: aiResult.subtype,
                confidence: aiResult.subtype_confidence ?? 0.5,
                method: "ai" as const,
              }
            : getDefaultImageSubtype();
        }

        const updatedItem: Item = {
          ...item,
          title: title ?? null,
          description: description ?? null,
          summary: aiResult.summary || null,
          image_url: imageUrl ?? null,
          tags,
          embedding: aiResult.embedding,
          article_content: articleContent ?? null,
          is_article:
            item.type === "url"
              ? (aiResult.is_article ?? item.is_article ?? false)
              : item.is_article,
          subtype: subtypeResult?.subtype,
          subtype_confidence: subtypeResult?.confidence,
          subtype_method: subtypeResult?.method,
        };

        const result = await tauri.updateItem(updatedItem);
        callbacks.onItemUpdated(result);
        return result;
      } catch (err) {
        console.warn("Failed to enrich item:", err);
        setError(err instanceof Error ? err.message : "Failed to enrich item");
        return null;
      }
    },
    [callbacks, setError]
  );

  const enrichItems = useCallback(
    async (items: Item[]): Promise<{ updated: number; failed: number }> => {
      let updated = 0;
      let failed = 0;

      for (const item of items) {
        const result = await enrichItem(item);
        if (result) {
          updated += 1;
        } else {
          failed += 1;
        }
      }

      return { updated, failed };
    },
    [enrichItem]
  );

  return {
    isLoading,
    error,
    addContent,
    uploadImage,
    deleteItem,
    deleteItems,
    updateItem,
    enrichItems,
  };
}

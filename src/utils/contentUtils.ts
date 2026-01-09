import type { ItemType } from "../types";

/**
 * Detect content type from a string
 * Returns 'url' if the content is a valid HTTP(S) URL, otherwise 'note'
 */
export function detectType(content: string): ItemType {
  try {
    const url = new URL(content);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return "url";
    }
  } catch {
    // Not a URL
  }
  return "note";
}

/**
 * Check if a title is generic (missing, empty, or looks like a filename)
 * Used to determine if AI-generated title should be used instead
 */
export function isGenericTitle(title: string | undefined): boolean {
  if (!title || title.trim() === "") return true;

  const filenamePatterns = [
    /^IMG[_-]?\d+/i, // IMG_1234, IMG-1234
    /^DSC[_-]?\d+/i, // DSC_1234
    /^photo[_-]?\d*/i, // photo, photo_1
    /^image[_-]?\d*/i, // image, image_1
    /^screenshot[_-]?\d*/i, // screenshot_2024
    /^screen\s*shot/i, // Screen Shot 2024
    /^capture[_-]?\d*/i, // capture_1
    /\.(jpg|jpeg|png|gif|webp|heic|bmp|tiff?)$/i, // ends with image extension
  ];

  return filenamePatterns.some((pattern) => pattern.test(title));
}

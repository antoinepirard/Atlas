import type { XPostInfo } from "./types";

/**
 * Detect X/Twitter post URL and extract info
 */
export function getXPostInfo(url: string): XPostInfo | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return null;
    }

    // Match /username/status/postId pattern
    const match = urlObj.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (match) {
      return { username: match[1], postId: match[2] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Format a date string to a relative or short format
 * Uses calendar day comparison (not raw time difference)
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // Compare calendar dates (ignoring time of day)
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = today.getTime() - dateDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Extract domain from a URL
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

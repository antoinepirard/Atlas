/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname === "youtube.com" && urlObj.pathname === "/watch") {
      return urlObj.searchParams.get("v");
    }
    if (hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }
    if (hostname === "youtube.com" && urlObj.pathname.startsWith("/embed/")) {
      return urlObj.pathname.replace("/embed/", "");
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts username and post ID from X/Twitter post URLs
 */
export function getXPostInfo(
  url: string
): { username: string; postId: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return null;
    }

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
 * Formats a date string as a relative time (e.g., "2 hours ago")
 * or absolute date for older items
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Extracts the domain from a URL, stripping "www." prefix
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/**
 * Returns a safe external URL (http/https) or null.
 */
export function getSafeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // Ignore invalid URLs
  }
  return null;
}

/**
 * Returns a safe image URL (http/https, blob, or data:image) or null.
 */
export function getSafeImageUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("blob:")) return url;
  if (/^data:image\//i.test(url)) return url;
  return getSafeExternalUrl(url);
}

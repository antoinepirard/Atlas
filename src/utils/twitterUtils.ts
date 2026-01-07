/**
 * Check if a URL is an X/Twitter post URL
 */
export function isXPostUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");
    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return false;
    }
    return /^\/[^/]+\/status\/\d+/.test(urlObj.pathname);
  } catch {
    return false;
  }
}

export interface TweetContent {
  author: string;
  text: string;
}

/**
 * Fetch tweet content via oEmbed API
 * Returns author name and tweet text, or null if fetch fails
 */
export async function fetchTweetContent(
  url: string
): Promise<TweetContent | null> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(
      url
    )}&omit_script=true`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;

    const data = await response.json();

    // Extract text from the HTML (it's in a blockquote)
    // The HTML looks like: <blockquote>tweet text<br>— Author (@handle)</blockquote>
    const html = data.html || "";

    // Use a simple regex to extract the text content before the author line
    const textMatch = html.match(/<blockquote[^>]*><p[^>]*>([\s\S]*?)<\/p>/i);
    let text = "";
    if (textMatch) {
      text = textMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<a[^>]*>(.*?)<\/a>/gi, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }

    return {
      author: data.author_name || "",
      text: text || data.author_name ? `Tweet by ${data.author_name}` : "",
    };
  } catch (error) {
    console.warn("Failed to fetch tweet content:", error);
    return null;
  }
}


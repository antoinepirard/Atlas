/**
 * Subtype detection utilities for content classification
 *
 * Provides domain-based and pattern-based detection for content subtypes,
 * enabling specialized UI rendering for different content types.
 */

import type { SubtypeMethod, ItemSubtype } from "../types";

export interface SubtypeDetection {
  subtype: ItemSubtype;
  confidence: number;
  method: SubtypeMethod;
}

/**
 * Detect URL subtype based on domain patterns
 *
 * Returns a detection result if a known domain pattern is matched,
 * null if the URL should fall through to AI classification.
 */
export function detectUrlSubtypeByDomain(
  urlStr: string
): SubtypeDetection | null {
  try {
    const url = new URL(urlStr);
    let host = url.hostname.toLowerCase();
    host = host.startsWith("www.") ? host.slice(4) : host;
    const path = url.pathname.toLowerCase();

    // Video platforms
    if (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("vimeo.com") ||
      host.includes("dailymotion.com") ||
      host.includes("twitch.tv") ||
      host.includes("tiktok.com")
    ) {
      return { subtype: "video", confidence: 1.0, method: "domain" };
    }

    // Social platforms
    if (
      host === "x.com" ||
      host === "twitter.com" ||
      host.includes("threads.net") ||
      host.includes("bsky.app") ||
      host.includes("mastodon.") ||
      host.endsWith(".social") ||
      host.includes("facebook.com") ||
      host.includes("instagram.com") ||
      host.includes("linkedin.com") ||
      host.includes("reddit.com")
    ) {
      return { subtype: "social", confidence: 1.0, method: "domain" };
    }

    // Code repositories
    if (
      host.includes("github.com") ||
      host.includes("gitlab.com") ||
      host.includes("bitbucket.org") ||
      host.includes("codepen.io") ||
      host.includes("codesandbox.io") ||
      host.includes("replit.com") ||
      host.includes("stackblitz.com") ||
      host.includes("jsfiddle.net")
    ) {
      return { subtype: "code", confidence: 1.0, method: "domain" };
    }

    // E-commerce / Products - by domain
    if (
      host.includes("amazon.") ||
      host.includes("ebay.com") ||
      host.includes("etsy.com") ||
      host.includes("aliexpress.com") ||
      host.includes("walmart.com") ||
      host.includes("target.com") ||
      host.includes("bestbuy.com") ||
      host.includes("newegg.com") ||
      host.includes("wayfair.com") ||
      host.includes("shopify.com")
    ) {
      return { subtype: "product", confidence: 1.0, method: "domain" };
    }

    // E-commerce - by URL pattern
    if (
      path.includes("/product") ||
      path.includes("/item/") ||
      path.includes("/dp/") ||
      path.includes("/gp/product") ||
      path.includes("/shop/") ||
      path.includes("/buy/")
    ) {
      return { subtype: "product", confidence: 0.85, method: "domain" };
    }

    // Audio/Podcast platforms
    if (
      host.includes("spotify.com") ||
      host.includes("soundcloud.com") ||
      host.includes("podcasts.apple.com") ||
      host.includes("overcast.fm") ||
      host.includes("pocketcasts.com") ||
      host.includes("anchor.fm") ||
      host.includes("transistor.fm") ||
      host.includes("simplecast.com") ||
      host.includes("podbean.com") ||
      host.includes("buzzsprout.com") ||
      host.includes("castbox.fm") ||
      host.includes("deezer.com") ||
      host.includes("audible.com")
    ) {
      return { subtype: "audio", confidence: 1.0, method: "domain" };
    }

    // News/Article domains
    if (
      host.includes("medium.com") ||
      host.includes("substack.com") ||
      host.includes("nytimes.com") ||
      host.includes("washingtonpost.com") ||
      host.includes("theguardian.com") ||
      host.includes("bbc.com") ||
      host.includes("bbc.co.uk") ||
      host.includes("reuters.com") ||
      host.includes("arstechnica.com") ||
      host.includes("techcrunch.com") ||
      host.includes("theverge.com") ||
      host.includes("wired.com") ||
      host.includes("forbes.com") ||
      host.includes("bloomberg.com") ||
      host.includes("cnn.com") ||
      host.includes("npr.org") ||
      host.includes("theatlantic.com") ||
      host.includes("newyorker.com") ||
      host.includes("economist.com") ||
      host.includes("ft.com") ||
      host.includes("wsj.com") ||
      host.includes("dev.to") ||
      host.includes("hackernoon.com") ||
      host.includes("freecodecamp.org")
    ) {
      return { subtype: "article", confidence: 0.95, method: "domain" };
    }

    // Article URL patterns
    if (
      path.includes("/article/") ||
      path.includes("/blog/") ||
      path.includes("/post/") ||
      path.includes("/news/") ||
      path.includes("/story/")
    ) {
      return { subtype: "article", confidence: 0.7, method: "domain" };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect note subtype based on content patterns
 */
export function detectNoteSubtype(content: string): SubtypeDetection {
  const trimmed = content.trim();
  const lines = trimmed.split("\n");

  // Checklist detection
  const checklistLines = lines.filter((line) => isChecklistLine(line)).length;
  if (lines.length >= 2 && checklistLines / lines.length >= 0.5) {
    return { subtype: "checklist", confidence: 0.9, method: "domain" };
  }

  // Quote detection
  // Check for various quote characters: " ' " ' (curly quotes)
  if (
    trimmed.startsWith('"') ||
    trimmed.startsWith("'") ||
    trimmed.startsWith("\u201C") || // "
    trimmed.startsWith("\u2018") || // '
    trimmed.startsWith(">")
  ) {
    return { subtype: "quote", confidence: 0.8, method: "domain" };
  }

  // Code detection
  if (detectCodeHeuristics(trimmed)) {
    return { subtype: "code", confidence: 0.85, method: "domain" };
  }

  // Default to plain note
  return { subtype: "plain", confidence: 1.0, method: "domain" };
}

/**
 * Check if a line looks like a checklist item
 */
function isChecklistLine(line: string): boolean {
  const trimmed = line.trim();

  // GitHub style: - [ ] or - [x]
  if (
    trimmed.startsWith("- [ ]") ||
    trimmed.startsWith("- [x]") ||
    trimmed.startsWith("- [X]")
  ) {
    return true;
  }

  // Bracket style: [ ] or [x]
  if (
    trimmed.startsWith("[ ]") ||
    trimmed.startsWith("[x]") ||
    trimmed.startsWith("[X]")
  ) {
    return true;
  }

  // Unordered list: - item or * item
  if (
    (trimmed.startsWith("- ") || trimmed.startsWith("* ")) &&
    trimmed.length > 2
  ) {
    return true;
  }

  // Numbered list: 1. item or 1) item
  const numberedMatch = trimmed.match(/^\d+[.)]\s+/);
  if (numberedMatch) {
    return true;
  }

  return false;
}

/**
 * Detect if content looks like code using heuristics
 */
function detectCodeHeuristics(content: string): boolean {
  let score = 0;

  const codeIndicators = [
    "function ",
    "const ",
    "let ",
    "var ",
    "return ",
    "import ",
    "export ",
    "class ",
    "def ",
    "fn ",
    "pub ",
    "async ",
    "await ",
    "if (",
    "for (",
    "while (",
    "switch (",
    "match ",
    "struct ",
    "impl ",
    "interface ",
    "type ",
    "enum ",
    "package ",
    "use ",
    "require(",
    "module.exports",
    "=>",
    "->",
  ];

  for (const indicator of codeIndicators) {
    if (content.includes(indicator)) {
      score += 1;
    }
  }

  // Check for balanced braces
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  if (openBraces > 0 && openBraces === closeBraces) {
    score += 2;
  }

  // Check for balanced brackets
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/]/g) || []).length;
  if (openBrackets > 1 && openBrackets === closeBrackets) {
    score += 1;
  }

  // Check for semicolons at line ends
  const semicolonLines = content
    .split("\n")
    .filter((l) => l.trim().endsWith(";")).length;
  if (semicolonLines >= 2) {
    score += 2;
  }

  // Check for common syntax patterns
  if (content.includes("()") || content.includes("() {")) {
    score += 1;
  }

  // Check for indentation patterns
  const indentedLines = content
    .split("\n")
    .filter((l) => l.startsWith("    ") || l.startsWith("\t")).length;
  if (indentedLines >= 3) {
    score += 1;
  }

  return score >= 3;
}

/**
 * Get default subtype for image items
 */
export function getDefaultImageSubtype(): SubtypeDetection {
  return { subtype: "photo", confidence: 0.5, method: "domain" };
}

/**
 * Determine final subtype by choosing between domain detection and AI classification
 * Prefers domain detection if confidence is higher
 */
export function resolveSubtype(
  domainDetection: SubtypeDetection | null,
  aiSubtype?: ItemSubtype,
  aiConfidence?: number
): SubtypeDetection | null {
  // If domain detection exists and has high confidence, use it
  if (domainDetection && domainDetection.confidence >= 0.9) {
    return domainDetection;
  }

  // If AI provided a subtype with good confidence, use it
  if (aiSubtype && aiConfidence !== undefined && aiConfidence >= 0.7) {
    return {
      subtype: aiSubtype,
      confidence: aiConfidence,
      method: "ai",
    };
  }

  // Fall back to domain detection even with lower confidence
  if (domainDetection) {
    return domainDetection;
  }

  // Finally, use AI result even with lower confidence
  if (aiSubtype) {
    return {
      subtype: aiSubtype,
      confidence: aiConfidence ?? 0.5,
      method: "ai",
    };
  }

  return null;
}

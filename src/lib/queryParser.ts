import type {
  ParsedQuery,
  ParsedToken,
  DateRangeFilter,
  ItemType,
} from "../types";
import * as tauri from "./tauri";

// CSS color names to hex mapping (common colors)
const CSS_COLORS: Record<string, string> = {
  red: "#ff0000",
  orange: "#ffa500",
  yellow: "#ffff00",
  green: "#008000",
  blue: "#0000ff",
  purple: "#800080",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  grey: "#808080",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  lime: "#00ff00",
  navy: "#000080",
  teal: "#008080",
  maroon: "#800000",
  olive: "#808000",
  coral: "#ff7f50",
  salmon: "#fa8072",
  gold: "#ffd700",
  silver: "#c0c0c0",
  indigo: "#4b0082",
  violet: "#ee82ee",
  turquoise: "#40e0d0",
  beige: "#f5f5dc",
  mint: "#98fb98",
  lavender: "#e6e6fa",
};

// Type keywords that map to ItemType
const TYPE_KEYWORDS: Record<string, ItemType> = {
  // Direct type names
  image: "image",
  images: "image",
  photo: "image",
  photos: "image",
  picture: "image",
  pictures: "image",
  screenshot: "image",
  screenshots: "image",

  link: "url",
  links: "url",
  url: "url",
  urls: "url",
  website: "url",
  websites: "url",
  webpage: "url",
  webpages: "url",

  note: "note",
  notes: "note",
  text: "note",

  // Platform/service names (map to url type)
  figma: "url",
  github: "url",
  youtube: "url",
  twitter: "url",
  x: "url",
  slack: "url",
  notion: "url",
  linear: "url",
  stripe: "url",
  vercel: "url",
  netlify: "url",
  dribbble: "url",
  behance: "url",
  medium: "url",
  substack: "url",
};

// Time phrase patterns
interface TimePattern {
  pattern: RegExp;
  getRange: (match: RegExpMatchArray) => DateRangeFilter | null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getMonthNumber(monthName: string): number {
  const months: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };
  return months[monthName.toLowerCase()] ?? -1;
}

const TIME_PATTERNS: TimePattern[] = [
  // "today"
  {
    pattern: /^today$/i,
    getRange: () => {
      const now = new Date();
      return { start: startOfDay(now), end: endOfDay(now), label: "today" };
    },
  },
  // "yesterday"
  {
    pattern: /^yesterday$/i,
    getRange: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
        label: "yesterday",
      };
    },
  },
  // "last week"
  {
    pattern: /^last\s*week$/i,
    getRange: () => {
      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return {
        start: startOfDay(start),
        end: endOfDay(end),
        label: "last week",
      };
    },
  },
  // "this week"
  {
    pattern: /^this\s*week$/i,
    getRange: () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(start.getDate() - dayOfWeek); // Start of week (Sunday)
      return {
        start: startOfDay(start),
        end: endOfDay(now),
        label: "this week",
      };
    },
  },
  // "last month"
  {
    pattern: /^last\s*month$/i,
    getRange: () => {
      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      return {
        start: startOfDay(start),
        end: endOfDay(end),
        label: "last month",
      };
    },
  },
  // "this month"
  {
    pattern: /^this\s*month$/i,
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: startOfDay(start),
        end: endOfDay(now),
        label: "this month",
      };
    },
  },
  // "in December", "in january", etc.
  {
    pattern:
      /^in\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/i,
    getRange: (match) => {
      const monthName = match[1];
      const monthNum = getMonthNumber(monthName);
      if (monthNum === -1) return null;

      const now = new Date();
      let year = now.getFullYear();
      // If the month is in the future, use last year
      if (monthNum > now.getMonth()) {
        year--;
      }

      const start = new Date(year, monthNum, 1);
      const end = new Date(year, monthNum + 1, 0); // Last day of month
      return {
        start: startOfDay(start),
        end: endOfDay(end),
        label: `in ${monthName}`,
      };
    },
  },
  // Q1, Q2, Q3, Q4
  {
    pattern: /^q([1-4])$/i,
    getRange: (match) => {
      const quarter = parseInt(match[1], 10);
      const now = new Date();
      let year = now.getFullYear();

      const quarterStartMonth = (quarter - 1) * 3;
      const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

      // If this quarter is in the future, use last year
      if (quarter > currentQuarter) {
        year--;
      }

      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 0);
      return {
        start: startOfDay(start),
        end: endOfDay(end),
        label: `Q${quarter}`,
      };
    },
  },
  // "before:YYYY-MM-DD" or "before:YYYY/MM/DD"
  {
    pattern: /^before:(\d{4}[-/]\d{2}[-/]\d{2})$/i,
    getRange: (match) => {
      const dateStr = match[1].replace(/\//g, "-");
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;

      const veryOld = new Date(2000, 0, 1); // Reasonable start date
      return {
        start: startOfDay(veryOld),
        end: endOfDay(date),
        label: `before ${dateStr}`,
      };
    },
  },
  // "after:YYYY-MM-DD" or "after:YYYY/MM/DD"
  {
    pattern: /^after:(\d{4}[-/]\d{2}[-/]\d{2})$/i,
    getRange: (match) => {
      const dateStr = match[1].replace(/\//g, "-");
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;

      return {
        start: startOfDay(date),
        end: endOfDay(new Date()),
        label: `after ${dateStr}`,
      };
    },
  },
  // Multi-word: "last X days"
  {
    pattern: /^last\s*(\d+)\s*days?$/i,
    getRange: (match) => {
      const days = parseInt(match[1], 10);
      if (isNaN(days) || days <= 0) return null;

      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      return {
        start: startOfDay(start),
        end: endOfDay(now),
        label: `last ${days} days`,
      };
    },
  },
];

/**
 * Parse a hex color code
 */
function parseHexColor(token: string): string | null {
  // Match #RGB, #RRGGBB, or #RRGGBBAA
  const hexMatch = token.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    // Expand 3-char to 6-char
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return `#${hex.toLowerCase().slice(0, 6)}`; // Remove alpha if present
  }
  return null;
}

/**
 * Parse an rgb/rgba color
 */
function parseRgbColor(token: string): string | null {
  const rgbMatch = token.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (r <= 255 && g <= 255 && b <= 255) {
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * Try to parse a color from a token
 */
function parseColor(token: string): string | null {
  const lower = token.toLowerCase();

  // Check CSS color names
  if (CSS_COLORS[lower]) {
    return CSS_COLORS[lower];
  }

  // Check hex color
  const hex = parseHexColor(token);
  if (hex) return hex;

  // Check rgb color
  const rgb = parseRgbColor(token);
  if (rgb) return rgb;

  return null;
}

/**
 * Try to parse a date range from a token or phrase
 */
function parseDateRange(text: string): DateRangeFilter | null {
  for (const { pattern, getRange } of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return getRange(match);
    }
  }
  return null;
}

/**
 * Try to parse a type filter from a token
 */
function parseType(token: string): ItemType | null {
  const lower = token.toLowerCase();
  return TYPE_KEYWORDS[lower] ?? null;
}

/**
 * Tokenize input while preserving multi-word phrases
 */
function tokenize(input: string): string[] {
  // First, try to match multi-word patterns
  const tokens: string[] = [];
  let remaining = input.trim();

  // Multi-word patterns to check
  const multiWordPatterns = [
    /^(last\s+\d+\s+days?)/i,
    /^(last\s+week)/i,
    /^(this\s+week)/i,
    /^(last\s+month)/i,
    /^(this\s+month)/i,
    /^(in\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec))/i,
  ];

  while (remaining.length > 0) {
    remaining = remaining.trimStart();
    if (remaining.length === 0) break;

    let matched = false;

    // Try multi-word patterns first
    for (const pattern of multiWordPatterns) {
      const match = remaining.match(pattern);
      if (match) {
        tokens.push(match[1]);
        remaining = remaining.slice(match[1].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Take the next word
      const wordMatch = remaining.match(/^(\S+)/);
      if (wordMatch) {
        tokens.push(wordMatch[1]);
        remaining = remaining.slice(wordMatch[1].length);
      } else {
        break;
      }
    }
  }

  return tokens;
}

/**
 * Parse a search query into structured filters
 */
export function parseQuery(
  query: string,
  existingTags: string[] = []
): ParsedQuery {
  const rawQuery = query;
  const tokens = tokenize(query);
  const parsedTokens: ParsedToken[] = [];

  const filters: ParsedQuery["filters"] = {};
  const remainingParts: string[] = [];

  // Normalize existing tags for case-insensitive matching
  const normalizedTags = existingTags.map((t) => t.toLowerCase());
  const tagMap = new Map(existingTags.map((t) => [t.toLowerCase(), t]));

  for (const tokenText of tokens) {
    let parsed = false;

    // Try date range
    const dateRange = parseDateRange(tokenText);
    if (dateRange) {
      parsedTokens.push({
        text: tokenText,
        type: "filter",
        filterKind: "date",
        confidence: 1.0,
        resolvedValue: dateRange.label,
      });
      filters.dateRange = dateRange;
      parsed = true;
    }

    // Try type
    if (!parsed) {
      const itemType = parseType(tokenText);
      if (itemType) {
        parsedTokens.push({
          text: tokenText,
          type: "filter",
          filterKind: "type",
          confidence: 1.0,
          resolvedValue: itemType,
        });
        filters.types = filters.types || [];
        if (!filters.types.includes(itemType)) {
          filters.types.push(itemType);
        }
        parsed = true;
      }
    }

    // Try color
    if (!parsed) {
      const color = parseColor(tokenText);
      if (color) {
        parsedTokens.push({
          text: tokenText,
          type: "filter",
          filterKind: "color",
          confidence: 1.0,
          resolvedValue: color,
        });
        filters.colors = filters.colors || [];
        if (!filters.colors.includes(color)) {
          filters.colors.push(color);
        }
        parsed = true;
      }
    }

    // Try tag match
    if (!parsed) {
      const lowerToken = tokenText.toLowerCase();
      if (normalizedTags.includes(lowerToken)) {
        const originalTag = tagMap.get(lowerToken) || tokenText;
        parsedTokens.push({
          text: tokenText,
          type: "filter",
          filterKind: "tag",
          confidence: 1.0,
          resolvedValue: originalTag,
        });
        filters.tags = filters.tags || [];
        if (!filters.tags.includes(originalTag)) {
          filters.tags.push(originalTag);
        }
        parsed = true;
      }
    }

    // Fallback: treat as plain text
    if (!parsed) {
      parsedTokens.push({
        text: tokenText,
        type: "text",
        confidence: 1.0,
      });
      remainingParts.push(tokenText);
    }
  }

  return {
    tokens: parsedTokens,
    filters,
    remainingText: remainingParts.join(" "),
    rawQuery,
  };
}

/**
 * Check if a color matches any of the filter colors (with tolerance)
 */
export function colorMatches(
  itemColors: string[],
  filterColors: string[],
  tolerance: number = 50
): boolean {
  if (!itemColors || itemColors.length === 0) return false;
  if (!filterColors || filterColors.length === 0) return true;

  for (const filterColor of filterColors) {
    for (const itemColor of itemColors) {
      if (colorDistance(filterColor, itemColor) <= tolerance) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculate color distance (simple RGB Euclidean distance)
 */
function colorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return 999;

  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Apply parsed filters to an item - returns true if item matches all filters
 */
export function itemMatchesFilters(
  item: { created_at: string; type: string; colors?: string[]; tags: string[] },
  filters: ParsedQuery["filters"]
): boolean {
  // Date range filter
  if (filters.dateRange) {
    const itemDate = new Date(item.created_at);
    if (
      itemDate < filters.dateRange.start ||
      itemDate > filters.dateRange.end
    ) {
      return false;
    }
  }

  // Type filter
  if (filters.types && filters.types.length > 0) {
    if (!filters.types.includes(item.type as any)) {
      return false;
    }
  }

  // Color filter
  if (filters.colors && filters.colors.length > 0) {
    if (!colorMatches(item.colors || [], filters.colors)) {
      return false;
    }
  }

  // Tag filter
  if (filters.tags && filters.tags.length > 0) {
    const itemTagsLower = item.tags.map((t) => t.toLowerCase());
    const hasMatchingTag = filters.tags.some((filterTag) =>
      itemTagsLower.includes(filterTag.toLowerCase())
    );
    if (!hasMatchingTag) {
      return false;
    }
  }

  return true;
}

/**
 * Enhance a parsed query with AI classification for ambiguous tokens
 * This is optional and can be called for tokens that don't match deterministic rules
 * Returns an enhanced ParsedQuery with AI-classified tokens
 */
export async function enhanceWithAI(
  parsedQuery: ParsedQuery,
  existingTags: string[] = []
): Promise<ParsedQuery> {
  // Get tokens that were classified as plain text (not filters)
  const textTokens = parsedQuery.tokens.filter((t) => t.type === "text");

  if (textTokens.length === 0) {
    return parsedQuery;
  }

  try {
    const classifications = await tauri.classifySearchTokens(
      textTokens.map((t) => t.text),
      existingTags
    );

    // Create a map of token -> classification
    const classificationMap = new Map(classifications.map((c) => [c.token, c]));

    // Update tokens with AI classifications (only if confidence >= 0.7)
    const enhancedTokens = parsedQuery.tokens.map((token) => {
      if (token.type !== "text") return token;

      const classification = classificationMap.get(token.text);
      if (
        !classification ||
        !classification.filter_kind ||
        classification.confidence < 0.7
      ) {
        return token;
      }

      return {
        ...token,
        type: "filter" as const,
        filterKind: classification.filter_kind as
          | "date"
          | "type"
          | "color"
          | "tag",
        confidence: classification.confidence,
        resolvedValue: classification.resolved_value || undefined,
      };
    });

    // Rebuild filters based on enhanced tokens
    const enhancedFilters = { ...parsedQuery.filters };
    const remainingParts: string[] = [];

    for (const token of enhancedTokens) {
      if (token.type === "filter" && token.confidence < 1.0) {
        // This is an AI-classified token
        switch (token.filterKind) {
          case "type":
            enhancedFilters.types = enhancedFilters.types || [];
            if (
              token.resolvedValue &&
              !enhancedFilters.types.includes(token.resolvedValue as any)
            ) {
              enhancedFilters.types.push(token.resolvedValue as any);
            }
            break;
          case "color":
            enhancedFilters.colors = enhancedFilters.colors || [];
            if (
              token.resolvedValue &&
              !enhancedFilters.colors.includes(token.resolvedValue)
            ) {
              enhancedFilters.colors.push(token.resolvedValue);
            }
            break;
          case "tag":
            enhancedFilters.tags = enhancedFilters.tags || [];
            if (
              token.resolvedValue &&
              !enhancedFilters.tags.includes(token.resolvedValue)
            ) {
              enhancedFilters.tags.push(token.resolvedValue);
            }
            break;
          // Date would need special handling to create DateRangeFilter
        }
      } else if (token.type === "text") {
        remainingParts.push(token.text);
      }
    }

    return {
      ...parsedQuery,
      tokens: enhancedTokens,
      filters: enhancedFilters,
      remainingText: remainingParts.join(" "),
    };
  } catch (error) {
    console.warn(
      "AI classification failed, using deterministic results:",
      error
    );
    return parsedQuery;
  }
}

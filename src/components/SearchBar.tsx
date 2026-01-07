import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { listen } from "@tauri-apps/api/event";
import { parseQuery } from "../lib/queryParser";
import type { ParsedQuery, ParsedToken } from "../types";

interface SearchBarProps {
  value: string;
  onChange: (value: string, parsed: ParsedQuery) => void;
  placeholder?: string;
  isLoading?: boolean;
  compact?: boolean;
  existingTags?: string[];
}

/**
 * Render a parsed token with appropriate styling
 */
function TokenSpan({
  token,
  isAnimating,
}: {
  token: ParsedToken;
  isAnimating: boolean;
}) {
  const isFilter = token.type === "filter";

  // Different colors based on filter kind for subtle distinction
  const getFilterColor = () => {
    if (!isFilter) return undefined;
    switch (token.filterKind) {
      case "date":
        return "rgb(234, 88, 12)"; // orange-600
      case "type":
        return "rgb(220, 38, 38)"; // red-600
      case "color":
        return "rgb(217, 70, 239)"; // fuchsia-500
      case "tag":
        return "rgb(14, 165, 233)"; // sky-500
      default:
        return "rgb(234, 88, 12)"; // orange-600
    }
  };

  return (
    <span
      className={`transition-all duration-300 ${
        isAnimating ? "scale-105" : ""
      }`}
      style={{
        color: isFilter ? getFilterColor() : undefined,
        fontWeight: isFilter ? 500 : undefined,
      }}
    >
      {token.text}
    </span>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search my mind...",
  isLoading,
  compact,
  existingTags = [],
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [recentlyParsedTokens, setRecentlyParsedTokens] = useState<Set<string>>(
    new Set()
  );
  const debounceRef = useRef<number>();
  const parseDebounceRef = useRef<number>();
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Parse query for highlighting (fast, runs on every keystroke with minimal debounce)
  useEffect(() => {
    if (parseDebounceRef.current) {
      clearTimeout(parseDebounceRef.current);
    }

    parseDebounceRef.current = window.setTimeout(() => {
      const parsed = parseQuery(localValue, existingTags);

      // Track newly detected filter tokens for animation
      const newFilterTexts = new Set(
        parsed.tokens.filter((t) => t.type === "filter").map((t) => t.text)
      );

      const previousFilterTexts = new Set(
        parsedQuery?.tokens
          .filter((t) => t.type === "filter")
          .map((t) => t.text) || []
      );

      // Find tokens that just became filters
      const newlyParsed = new Set(
        [...newFilterTexts].filter((t) => !previousFilterTexts.has(t))
      );

      if (newlyParsed.size > 0) {
        setRecentlyParsedTokens(newlyParsed);
        // Clear animation state after animation completes
        setTimeout(() => setRecentlyParsedTokens(new Set()), 300);
      }

      setParsedQuery(parsed);
    }, 50); // Very fast parse for responsive highlighting

    return () => {
      if (parseDebounceRef.current) {
        clearTimeout(parseDebounceRef.current);
      }
    };
  }, [localValue, existingTags, parsedQuery]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = window.setTimeout(() => {
        const parsed = parseQuery(newValue, existingTags);
        onChange(newValue, parsed);
      }, 300);
    },
    [onChange, existingTags]
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    setParsedQuery(null);
    const emptyParsed = parseQuery("", existingTags);
    onChange("", emptyParsed);
    inputRef.current?.focus();
  }, [onChange, existingTags]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for focus-search event from menu bar (⌘F)
  useEffect(() => {
    const unlisten = listen("focus-search", () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Sync scroll position between input and overlay
  const handleScroll = useCallback(() => {
    if (overlayRef.current && inputRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, []);

  // Render the highlighted overlay content
  const overlayContent = useMemo(() => {
    if (!parsedQuery || parsedQuery.tokens.length === 0) {
      return null;
    }

    // Build a flat list of elements with spaces between tokens
    const elements: React.ReactNode[] = [];
    parsedQuery.tokens.forEach((token, index) => {
      elements.push(
        <TokenSpan
          key={`token-${index}`}
          token={token}
          isAnimating={recentlyParsedTokens.has(token.text)}
        />
      );
      if (index < parsedQuery.tokens.length - 1) {
        elements.push(" "); // Natural space between words
      }
    });
    return elements;
  }, [parsedQuery, recentlyParsedTokens]);

  const fontSize = compact
    ? "clamp(1.5rem, 3.5vw, 2.5rem)"
    : "clamp(2rem, 5vw, 3.5rem)";
  const fontStyles = {
    fontSize,
    fontFamily: "'Newsreader', 'Georgia', serif",
    fontStyle: "italic" as const,
    lineHeight: "1.2",
  };

  const hasFilters = parsedQuery?.tokens.some((t) => t.type === "filter");

  return (
    <div className="w-full">
      <div className="relative">
        {/* Invisible input for actual typing */}
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          className="w-full bg-transparent placeholder-stone-300 outline-none border-none ring-0 focus:outline-none focus:border-none focus:ring-0 font-light tracking-tight transition-all duration-300"
          style={{
            ...fontStyles,
            // Make text transparent when we have parsed content to show overlay
            color: hasFilters ? "transparent" : "rgb(68, 64, 60)", // stone-700
            caretColor: "rgb(68, 64, 60)", // stone-700 - keep caret visible
          }}
        />

        {/* Overlay for colored tokens - only show when there are filters */}
        {hasFilters && (
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none overflow-hidden font-light text-stone-700"
            style={{
              ...fontStyles,
              // Match input exactly - use word-spacing instead of whitespace-pre
              letterSpacing: "-0.050em", // tracking-tight equivalent
              whiteSpace: "pre-wrap",
              wordSpacing: "normal",
            }}
            aria-hidden="true"
          >
            {overlayContent}
          </div>
        )}

        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
          {isLoading && (
            <div
              className={`border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin transition-all duration-300 ${
                compact ? "w-4 h-4" : "w-5 h-5"
              }`}
            />
          )}

          {localValue && !isLoading && (
            <button
              onClick={handleClear}
              className="p-2 text-stone-300 hover:text-stone-500 transition-colors"
            >
              <XMarkIcon
                className={`transition-all duration-300 ${
                  compact ? "w-5 h-5" : "w-6 h-6"
                }`}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

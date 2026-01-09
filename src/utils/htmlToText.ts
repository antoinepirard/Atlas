/**
 * Convert HTML to plain text while preserving structure
 * This is useful when pasting from web pages to maintain readability
 */

/**
 * Converts HTML string to plain text while preserving formatting structure
 * - Block elements (p, div, br, h1-h6) get newlines
 * - List items (li) get newlines with bullet/number preservation
 * - Removes scripts, styles, and other non-content elements
 */
export function htmlToText(html: string): string {
  // Create a temporary DOM element to parse HTML
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Remove script, style, and other non-content elements
  const elementsToRemove = doc.querySelectorAll(
    "script, style, noscript, head, meta, link"
  );
  elementsToRemove.forEach((el) => el.remove());

  // Process the body content
  return processNode(doc.body).trim();
}

function processNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    // Normalize whitespace but preserve meaningful spaces
    return (node.textContent || "").replace(/\s+/g, " ");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  // Skip hidden elements
  if (
    element.getAttribute("hidden") !== null ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return "";
  }

  // Process children
  const childContent = Array.from(node.childNodes)
    .map((child) => processNode(child))
    .join("");

  // Handle different element types
  switch (tagName) {
    // Block elements that need newlines
    case "p":
    case "div":
    case "section":
    case "article":
    case "header":
    case "footer":
    case "main":
    case "aside":
    case "nav":
    case "address":
    case "blockquote":
    case "pre":
    case "figure":
    case "figcaption":
      return "\n" + childContent.trim() + "\n";

    // Headings - add extra spacing
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "\n\n" + childContent.trim() + "\n";

    // Line breaks
    case "br":
      return "\n";

    // Horizontal rule
    case "hr":
      return "\n---\n";

    // Lists
    case "ul":
    case "ol":
      return "\n" + childContent + "\n";

    // List items - detect parent to use appropriate bullet
    case "li": {
      const parent = element.parentElement;
      const isOrdered = parent?.tagName.toLowerCase() === "ol";

      if (isOrdered) {
        // Get the item index for numbered lists
        const items = parent?.querySelectorAll(":scope > li");
        const index = items ? Array.from(items).indexOf(element) + 1 : 1;
        return `${index}. ${childContent.trim()}\n`;
      }
      return `• ${childContent.trim()}\n`;
    }

    // Definition lists
    case "dl":
      return "\n" + childContent + "\n";
    case "dt":
      return childContent.trim() + ":\n";
    case "dd":
      return "  " + childContent.trim() + "\n";

    // Table elements
    case "table":
      return "\n" + childContent + "\n";
    case "tr":
      return childContent.trim() + "\n";
    case "td":
    case "th":
      return childContent.trim() + "\t";

    // Links - preserve the URL in parentheses if it's different from text
    case "a": {
      const href = element.getAttribute("href");
      const text = childContent.trim();
      // Only add URL if it's different from the link text and is a valid http(s) URL
      if (
        href &&
        href !== text &&
        (href.startsWith("http://") || href.startsWith("https://"))
      ) {
        return `${text} (${href})`;
      }
      return text;
    }

    // Code blocks
    case "code":
    case "kbd":
    case "samp":
      return "`" + childContent.trim() + "`";

    // Emphasis - just return content (no markdown conversion)
    case "strong":
    case "b":
    case "em":
    case "i":
    case "u":
    case "mark":
      return childContent;

    // Span and inline elements - just content
    case "span":
    case "label":
    case "time":
    case "abbr":
    case "cite":
    case "q":
    case "sub":
    case "sup":
    case "small":
      return childContent;

    // Images - use alt text if available
    case "img": {
      const alt = element.getAttribute("alt");
      return alt ? `[${alt}]` : "";
    }

    default:
      return childContent;
  }
}

/**
 * Clean up the converted text:
 * - Remove excessive newlines (more than 2 consecutive)
 * - Trim each line
 * - Remove leading/trailing whitespace
 */
export function cleanText(text: string): string {
  return (
    text
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove excessive newlines (more than 2)
      .replace(/\n{3,}/g, "\n\n")
      // Trim whitespace from each line but preserve newlines
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      // Final trim
      .trim()
  );
}

/**
 * Main function to convert clipboard HTML to clean text
 */
export function convertClipboardHtml(html: string): string {
  const text = htmlToText(html);
  return cleanText(text);
}

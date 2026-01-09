/**
 * Detects if a given text content is likely code.
 * Uses multiple heuristics to determine code likelihood.
 */

// Common programming language keywords
const CODE_KEYWORDS = [
  // JavaScript/TypeScript
  "function",
  "const",
  "let",
  "var",
  "return",
  "import",
  "export",
  "async",
  "await",
  "class",
  "extends",
  "interface",
  "type",
  "enum",
  "implements",
  // Python
  "def ",
  "elif",
  "lambda",
  "from ",
  "import ",
  "self.",
  "__init__",
  // Rust
  "fn ",
  "pub ",
  "impl ",
  "struct ",
  "enum ",
  "match ",
  "mut ",
  // Go
  "func ",
  "package ",
  "go ",
  "defer ",
  "chan ",
  // Java/C#
  "public ",
  "private ",
  "protected ",
  "static ",
  "void ",
  // SQL
  "SELECT ",
  "FROM ",
  "WHERE ",
  "INSERT ",
  "UPDATE ",
  "DELETE ",
  "CREATE TABLE",
  // Shell
  "#!/bin/",
  "echo ",
  "sudo ",
];

// Common code patterns (regex)
const CODE_PATTERNS = [
  /^import\s+[\w{}\s,*]+\s+from\s+['"]/, // ES6 imports
  /^const\s+\w+\s*=\s*/, // const declarations
  /^let\s+\w+\s*=\s*/, // let declarations
  /^function\s+\w+\s*\(/, // function declarations
  /^\s*\w+\s*\([^)]*\)\s*{/, // function definitions
  /=>\s*{/, // arrow functions
  /\bawait\s+\w+/, // await expressions
  /\basync\s+function/, // async functions
  /\bclass\s+\w+/, // class definitions
  /^\s*if\s*\([^)]+\)\s*{/, // if statements
  /^\s*for\s*\([^)]+\)\s*{/, // for loops
  /^\s*while\s*\([^)]+\)\s*{/, // while loops
  /^\s*switch\s*\([^)]+\)\s*{/, // switch statements
  /\.\w+\([^)]*\)/, // method calls
  /^\s*@\w+/, // decorators
  /^\s*#include\s*</, // C/C++ includes
  /^\s*def\s+\w+\s*\(/, // Python functions
  /^\s*fn\s+\w+\s*\(/, // Rust functions
  /^\s*pub\s+fn\s+/, // Rust public functions
  /^SELECT\s+.+\s+FROM\s+/i, // SQL queries
  /^\s*<\w+[^>]*>/, // HTML/JSX tags
  /^\s*{\s*"\w+":\s*/, // JSON objects
  /^\[\s*{/, // JSON arrays
];

// Characters commonly found in code
const CODE_CHARS = [
  "{",
  "}",
  "[",
  "]",
  "(",
  ")",
  ";",
  "=>",
  "===",
  "!==",
  "&&",
  "||",
  "?:",
  "++",
  "--",
];

export interface CodeDetectionResult {
  isCode: boolean;
  confidence: number;
  language: string | null;
}

/**
 * Attempts to detect the programming language from content
 */
function detectLanguage(content: string): string | null {
  const trimmed = content.trim();
  const firstLine = trimmed.split("\n")[0];

  // Shebang detection
  if (firstLine.startsWith("#!/bin/bash") || firstLine.startsWith("#!/bin/sh"))
    return "bash";
  if (firstLine.startsWith("#!/usr/bin/env python")) return "python";
  if (firstLine.startsWith("#!/usr/bin/env node")) return "javascript";

  // Pattern-based detection
  if (
    /^import\s+.*\s+from\s+['"]/.test(trimmed) ||
    /^export\s+(default\s+)?/.test(trimmed)
  ) {
    if (
      trimmed.includes(": ") ||
      /:\s*(string|number|boolean|any|void)/.test(trimmed)
    )
      return "typescript";
    return "javascript";
  }
  if (/^<\w+/.test(trimmed) && /<\/\w+>$/.test(trimmed)) return "html";
  if (/<[A-Z]\w+/.test(trimmed) || /className=/.test(trimmed)) return "jsx";
  if (/^\s*def\s+\w+\s*\(/.test(trimmed) || /^import\s+\w+$/.test(firstLine))
    return "python";
  if (/^\s*fn\s+\w+\s*\(/.test(trimmed) || /^use\s+\w+::/.test(trimmed))
    return "rust";
  if (/^package\s+\w+/.test(firstLine) || /^func\s+\w+/.test(trimmed))
    return "go";
  if (/^(public|private)\s+(static\s+)?(void|class|int|String)/.test(trimmed))
    return "java";
  if (/^#include\s*</.test(trimmed)) return "cpp";
  if (/^SELECT\s+.+\s+FROM\s+/i.test(trimmed)) return "sql";
  if (/^\s*{\s*"\w+":\s*/.test(trimmed) || /^\[\s*{/.test(trimmed))
    return "json";
  if (/^[.#]?\w+\s*{/.test(trimmed) && /:\s*.+;/.test(trimmed)) return "css";
  if (
    /^\w+:/.test(firstLine) &&
    (trimmed.includes("  - ") || trimmed.includes(": |"))
  )
    return "yaml";

  return null;
}

/**
 * Detects if text content is likely code
 */
export function detectCode(content: string): CodeDetectionResult {
  if (!content || content.trim().length === 0) {
    return { isCode: false, confidence: 0, language: null };
  }

  const trimmed = content.trim();
  const lines = trimmed.split("\n");
  let score = 0;

  // Check for code keywords (strong signal)
  for (const keyword of CODE_KEYWORDS) {
    if (trimmed.toLowerCase().includes(keyword.toLowerCase())) {
      score += 15;
      if (score >= 30) break; // Cap keyword contribution
    }
  }

  // Check for code patterns (very strong signal)
  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(trimmed)) {
      score += 25;
      if (score >= 50) break; // Cap pattern contribution
    }
  }

  // Check for code characters
  let codeCharCount = 0;
  for (const char of CODE_CHARS) {
    if (trimmed.includes(char)) {
      codeCharCount++;
    }
  }
  if (codeCharCount >= 3) score += 20;
  if (codeCharCount >= 5) score += 15;

  // Multi-line with consistent indentation (strong code signal)
  if (lines.length > 2) {
    const indentedLines = lines.filter((line) => line.match(/^[\t ]{2,}/));
    if (indentedLines.length >= lines.length * 0.3) {
      score += 20;
    }
  }

  // Check for balanced braces/brackets
  const openBraces = (trimmed.match(/{/g) || []).length;
  const closeBraces = (trimmed.match(/}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;

  if (openBraces > 0 && openBraces === closeBraces) score += 10;
  if (openBrackets > 0 && openBrackets === closeBrackets) score += 5;

  // Check for semicolons at end of lines (common in many languages)
  const semicolonLines = lines.filter((line) => line.trim().endsWith(";"));
  if (semicolonLines.length >= 2) score += 15;

  // Negative signals (prose indicators)
  const avgLineLength = trimmed.length / lines.length;
  if (avgLineLength > 100 && lines.length < 3) score -= 20; // Long single lines are usually prose

  // Check for sentence-like patterns (capital letter, ends with period)
  const sentenceLikeLines = lines.filter((line) =>
    /^[A-Z].*[.!?]$/.test(line.trim())
  );
  if (sentenceLikeLines.length >= lines.length * 0.5) score -= 25;

  // Very short content with no code signals
  if (trimmed.length < 50 && score < 20) {
    score -= 10;
  }

  // Normalize score to 0-100
  const confidence = Math.max(0, Math.min(100, score));
  const isCode = confidence >= 40;

  return {
    isCode,
    confidence,
    language: isCode ? detectLanguage(content) : null,
  };
}

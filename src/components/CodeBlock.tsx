import { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { detectCode } from '../utils/codeDetection';
import { CodeBracketIcon } from '@heroicons/react/24/outline';

interface CodeBlockProps {
  content: string;
  className?: string;
  /** Compact mode for card preview (fewer lines, smaller text) */
  compact?: boolean;
  /** Maximum lines to show in compact mode */
  maxLines?: number;
}

// Custom theme based on oneDark but with tweaks for better aesthetics
const customStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    margin: 0,
    borderRadius: '0.75rem',
    background: '#1e1e2e',
    fontSize: '0.8125rem',
    lineHeight: '1.6',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
  },
};

const compactStyle = {
  ...customStyle,
  'pre[class*="language-"]': {
    ...customStyle['pre[class*="language-"]'],
    fontSize: '0.6875rem',
    lineHeight: '1.4',
    padding: '0.75rem',
  },
};

export function CodeBlock({ content, className = '', compact = false, maxLines = 6 }: CodeBlockProps) {
  const { language } = useMemo(() => detectCode(content), [content]);
  
  // Truncate content for compact mode
  const displayContent = useMemo(() => {
    if (!compact) return content;
    
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    
    return lines.slice(0, maxLines).join('\n') + '\n...';
  }, [content, compact, maxLines]);
  
  const mappedLanguage = useMemo(() => {
    // Map our detected language to Prism's supported languages
    const languageMap: Record<string, string> = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'python': 'python',
      'rust': 'rust',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'sql': 'sql',
      'json': 'json',
      'html': 'markup',
      'css': 'css',
      'bash': 'bash',
      'yaml': 'yaml',
    };
    
    return language ? (languageMap[language] || 'javascript') : 'javascript';
  }, [language]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Language badge */}
      {language && !compact && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-white/10 backdrop-blur-sm rounded-md">
          <CodeBracketIcon className="w-3 h-3 text-stone-400" />
          <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">
            {language}
          </span>
        </div>
      )}
      
      <SyntaxHighlighter
        language={mappedLanguage}
        style={compact ? compactStyle : customStyle}
        customStyle={{
          margin: 0,
          borderRadius: compact ? '0.5rem' : '0.75rem',
        }}
        wrapLongLines={!compact}
        showLineNumbers={!compact && content.split('\n').length > 3}
      >
        {displayContent}
      </SyntaxHighlighter>
    </div>
  );
}

interface NoteContentProps {
  content: string;
  className?: string;
  /** Compact mode for card preview */
  compact?: boolean;
  /** Maximum lines to show for code in compact mode */
  maxLines?: number;
}

/**
 * Smart component that renders either a code block or regular text
 * based on automatic code detection
 */
export function NoteContent({ content, className = '', compact = false, maxLines = 6 }: NoteContentProps) {
  const { isCode } = useMemo(() => detectCode(content), [content]);
  
  if (isCode) {
    return (
      <CodeBlock 
        content={content} 
        className={className} 
        compact={compact}
        maxLines={maxLines}
      />
    );
  }
  
  // Regular text content
  if (compact) {
    return (
      <p className={`text-sm text-stone-700 whitespace-pre-wrap line-clamp-6 ${className}`}>
        {content}
      </p>
    );
  }
  
  return (
    <p className={`text-lg text-stone-700 font-serif leading-relaxed whitespace-pre-wrap ${className}`}>
      {content}
    </p>
  );
}


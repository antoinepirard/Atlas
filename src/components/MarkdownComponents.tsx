import type { Components } from "react-markdown";

/**
 * Custom styled components for ReactMarkdown rendering
 */
export const markdownComponents: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold mb-4 mt-6 first:mt-0 text-stone-800">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold mb-3 mt-5 first:mt-0 text-stone-800">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold mb-2 mt-4 first:mt-0 text-stone-800">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-lg font-medium mb-2 mt-3 first:mt-0 text-stone-800">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-6 mb-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-6 mb-4 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-300 pl-4 py-1 my-4 italic text-stone-600 bg-amber-50/50 rounded-r">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-stone-200/70 text-stone-800 px-1.5 py-0.5 rounded text-[0.9em] font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-stone-800 text-stone-100 p-4 rounded-lg my-4 text-[0.85em] font-mono overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-4">{children}</pre>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-600 hover:text-amber-700 underline underline-offset-2"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-stone-800">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-6 border-stone-300" />,
};


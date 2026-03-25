'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface CustomBlock {
  title: string;
  text: string;
  images: string[];
}

interface PatchnoteViewProps {
  content: string;
  variableScreenshots?: string[];
  customBlocks?: CustomBlock[];
  dark?: boolean;
}

export function PatchnoteView({ content, variableScreenshots, customBlocks, dark = false }: PatchnoteViewProps) {
  const hasVariables = variableScreenshots && variableScreenshots.length > 0;
  const hasBlocks = customBlocks && customBlocks.some((b) => b.title || b.text || b.images.length > 0);

  const proseClasses = dark
    ? 'prose prose-sm max-w-none prose-invert prose-headings:text-slate-50 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-code:text-slate-200 prose-code:bg-white/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-a:text-slate-100 prose-a:underline-offset-2 prose-table:border-separate prose-table:border-spacing-0 prose-th:bg-white/[0.05] prose-th:text-slate-300 prose-th:text-xs prose-th:font-medium prose-th:uppercase prose-th:tracking-wider prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-white/[0.1] prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-white/[0.08] prose-td:text-sm prose-td:text-slate-300 prose-blockquote:border-l-amber-500 prose-blockquote:bg-amber-500/[0.06] prose-blockquote:rounded-xl prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:not-italic prose-blockquote:text-amber-200 prose-h2:text-lg prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2'
    : 'prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-900 prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-a:text-gray-900 prose-a:underline-offset-2 prose-table:border-separate prose-table:border-spacing-0 prose-th:bg-gray-50 prose-th:text-gray-600 prose-th:text-xs prose-th:font-medium prose-th:uppercase prose-th:tracking-wider prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-gray-200 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-gray-100 prose-td:text-sm prose-blockquote:border-l-amber-400 prose-blockquote:bg-amber-50 prose-blockquote:rounded-xl prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:not-italic prose-blockquote:text-amber-800 prose-h2:text-lg prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2';

  const borderColor = dark ? 'border-white/[0.06]' : 'border-gray-200';
  const titleColor = dark ? 'text-slate-50' : 'text-gray-900';
  const imgBorder = dark ? 'border border-white/[0.06] bg-white/[0.02]' : 'border border-gray-200 bg-white';

  return (
    <div>
      <div className={`patchnote-view ${proseClasses}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {content}
        </ReactMarkdown>
      </div>

      {hasVariables && (
        <div className={`mt-10 pt-8 border-t ${borderColor}`}>
          <h2 className={`text-lg font-semibold ${titleColor} mb-4`}>Variables</h2>
          <div className="grid grid-cols-1 gap-3">
            {variableScreenshots.map((url, i) => (
              <div key={i} className={`rounded-xl overflow-hidden ${imgBorder}`}>
                <img src={url} alt={`Variables — capture ${i + 1}`} className="w-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {hasBlocks && (
        <div className="mt-10 space-y-8">
          {customBlocks!
            .filter((b) => b.title || b.text || b.images.length > 0)
            .map((block, i) => (
              <div key={i} className={`pt-8 border-t ${borderColor}`}>
                {block.title && (
                  <h2 className={`text-lg font-semibold ${titleColor} mb-3`}>{block.title}</h2>
                )}
                {block.text && (
                  <div className={`${proseClasses} mb-4`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {block.text}
                    </ReactMarkdown>
                  </div>
                )}
                {block.images.length > 0 && (
                  <div className="grid grid-cols-1 gap-3">
                    {block.images.map((url, j) => (
                      <div key={j} className={`rounded-xl overflow-hidden ${imgBorder}`}>
                        <img src={url} alt={`${block.title || 'Bloc'} — image ${j + 1}`} className="w-full" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

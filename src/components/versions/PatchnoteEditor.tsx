'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Eye, Edit3 } from 'lucide-react';

interface PatchnoteEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PatchnoteEditor({ value, onChange }: PatchnoteEditorProps) {
  const [preview, setPreview] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-foreground">
          Contenu du patchnote
        </label>
        <button
          onClick={() => setPreview(!preview)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          {preview ? (
            <>
              <Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Éditer
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
              Prévisualiser
            </>
          )}
        </button>
      </div>

      {preview ? (
        <div className="prose prose-sm max-w-none border border-border rounded-[8px] p-6 bg-surface min-h-[300px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {value}
          </ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[300px] px-4 py-3 text-sm font-mono bg-surface border border-border rounded-[8px] text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-y"
          placeholder="Contenu markdown du patchnote..."
        />
      )}
    </div>
  );
}

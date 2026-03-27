'use client';

import { useRef } from 'react';
import { Plus, Trash2, Bold, Strikethrough } from 'lucide-react';
import { ImageUploadZone } from './ImageUploadZone';
import type { CustomBlock } from '@/lib/types';

export type { CustomBlock };

interface CustomBlockEditorProps {
  blocks: CustomBlock[];
  onChange: (blocks: CustomBlock[]) => void;
  addLabel?: string;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  wrapper: string,
  currentText: string,
  onUpdate: (text: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = currentText.slice(start, end);

  if (selected && currentText.slice(start - wrapper.length, start) === wrapper && currentText.slice(end, end + wrapper.length) === wrapper) {
    const next = currentText.slice(0, start - wrapper.length) + selected + currentText.slice(end + wrapper.length);
    onUpdate(next);
    requestAnimationFrame(() => {
      textarea.selectionStart = start - wrapper.length;
      textarea.selectionEnd = end - wrapper.length;
      textarea.focus();
    });
    return;
  }

  const next = currentText.slice(0, start) + wrapper + selected + wrapper + currentText.slice(end);
  onUpdate(next);
  requestAnimationFrame(() => {
    textarea.selectionStart = start + wrapper.length;
    textarea.selectionEnd = end + wrapper.length;
    textarea.focus();
  });
}

export function CustomBlockEditor({ blocks, onChange, addLabel }: CustomBlockEditorProps) {
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  const addBlock = () => {
    onChange([...blocks, { title: '', text: '', images: [] }]);
  };

  const updateBlock = (idx: number, patch: Partial<CustomBlock>) => {
    const next = blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange(next);
  };

  const removeBlock = (idx: number) => {
    onChange(blocks.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, idx: number) => {
    const textarea = e.currentTarget;
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      wrapSelection(textarea, '**', blocks[idx].text, (t) => updateBlock(idx, { text: t }));
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      wrapSelection(textarea, '~~', blocks[idx].text, (t) => updateBlock(idx, { text: t }));
    }
  };

  return (
    <div>
      {blocks.map((block, i) => (
        <div
          key={i}
          className="group/block relative border border-white/[0.06] rounded-xl p-4 mb-3 bg-white/[0.02]"
        >
          <button
            type="button"
            onClick={() => removeBlock(i)}
            className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover/block:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <input
            value={block.title}
            onChange={(e) => updateBlock(i, { title: e.target.value })}
            placeholder="Titre du bloc..."
            className="w-full text-sm font-medium text-slate-200 bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-slate-500 focus:outline-none pb-1 mb-2 transition-colors placeholder:text-slate-600"
          />

          <div className="flex items-center gap-1 mb-1.5">
            <button
              type="button"
              title="Gras (⌘B)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const ta = textareaRefs.current.get(i);
                if (ta) wrapSelection(ta, '**', block.text, (t) => updateBlock(i, { text: t }));
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Barré (⌘S)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const ta = textareaRefs.current.get(i);
                if (ta) wrapSelection(ta, '~~', block.text, (t) => updateBlock(i, { text: t }));
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            value={block.text}
            onChange={(e) => {
              updateBlock(i, { text: e.target.value });
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => handleKeyDown(e, i)}
            ref={(el) => {
              if (el) {
                textareaRefs.current.set(i, el);
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }
            }}
            rows={2}
            placeholder="Contenu (markdown supporté)..."
            className="w-full text-sm text-slate-200 bg-transparent resize-none border-0 p-0 focus:ring-0 focus:outline-none leading-relaxed placeholder:text-slate-500 mb-3"
            style={{ overflow: 'hidden' }}
          />

          <ImageUploadZone
            images={block.images}
            onChange={(imgs) => updateBlock(i, { images: imgs })}
            compact
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addBlock}
        className="w-full py-2.5 border border-dashed border-white/[0.12] rounded-xl text-sm text-slate-300 hover:text-white hover:border-white/[0.22] transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        {addLabel || 'Ajouter un bloc'}
      </button>
    </div>
  );
}

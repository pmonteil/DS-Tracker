'use client';

import { Plus, Trash2 } from 'lucide-react';
import { ImageUploadZone } from './ImageUploadZone';
import type { CustomBlock } from '@/lib/types';

export type { CustomBlock };

interface CustomBlockEditorProps {
  blocks: CustomBlock[];
  onChange: (blocks: CustomBlock[]) => void;
}

export function CustomBlockEditor({ blocks, onChange }: CustomBlockEditorProps) {
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

          <textarea
            value={block.text}
            onChange={(e) => {
              updateBlock(i, { text: e.target.value });
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            ref={(el) => {
              if (el) {
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
        Ajouter un bloc
      </button>
    </div>
  );
}

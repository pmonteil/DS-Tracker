'use client';

import { X } from 'lucide-react';
import { PatchnoteView } from '@/components/changelog/PatchnoteView';

interface Props {
  open: boolean;
  onClose: () => void;
  markdown: string;
}

export function PatchnotePreviewModal({ open, onClose, markdown }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="preview-title" className="text-sm font-semibold text-gray-900">
            Prévisualisation du patchnote
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm">
          <PatchnoteView content={markdown || '_Aucun contenu._'} />
        </div>
      </div>
    </div>
  );
}

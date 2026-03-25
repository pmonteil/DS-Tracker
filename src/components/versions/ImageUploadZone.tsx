'use client';

import { useCallback, useRef, useState } from 'react';
import { Plus, X, ImageIcon } from 'lucide-react';

interface ImageUploadZoneProps {
  images: string[];
  onChange: (images: string[]) => void;
  label?: string;
  compact?: boolean;
}

export function ImageUploadZone({ images, onChange, label, compact }: ImageUploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);

      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: form });
          const data = await res.json();
          if (data.url) newUrls.push(data.url);
        } catch {
          console.error('Upload failed');
        }
      }

      onChange([...images, ...newUrls]);
      setUploading(false);
    },
    [images, onChange]
  );

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {label && (
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {label}
        </p>
      )}

      {images.length > 0 && (
        <div className={`grid gap-2 mb-2 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {images.map((url, i) => (
            <div key={url} className="relative group/img rounded-xl overflow-hidden border border-white/[0.06] bg-white">
              <img src={url} alt="" className="w-full rounded-xl" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full py-3 border border-dashed border-white/[0.14] rounded-xl text-sm text-slate-300 hover:text-white hover:border-white/[0.25] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {uploading ? (
          'Upload en cours...'
        ) : (
          <>
            {images.length === 0 ? <ImageIcon className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {images.length === 0 ? 'Ajouter des captures' : 'Ajouter'}
          </>
        )}
      </button>
    </div>
  );
}

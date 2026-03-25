'use client';

import type { DiffItem } from '@/lib/types';

interface Props {
  item: DiffItem;
}

function lh(raw: unknown): string {
  if (typeof raw === 'number') return `${raw}px`;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.value !== undefined) return `${obj.value}px`;
  }
  return String(raw ?? '—');
}

export function TextStyleDiffDetail({ item }: Props) {
  const oldVal = item.old_value as Record<string, unknown> | null;
  const newVal = item.new_value as Record<string, unknown> | null;

  if (item.change_type === 'modified') {
    const changes: string[] = [];
    if (oldVal?.fontSize !== newVal?.fontSize) {
      changes.push(`Taille : ${oldVal?.fontSize}px → ${newVal?.fontSize}px`);
    }
    if (oldVal?.fontStyle !== newVal?.fontStyle) {
      changes.push(`Weight : ${oldVal?.fontStyle} → ${newVal?.fontStyle}`);
    }
    if (JSON.stringify(oldVal?.lineHeight) !== JSON.stringify(newVal?.lineHeight)) {
      changes.push(`Line height : ${lh(oldVal?.lineHeight)} → ${lh(newVal?.lineHeight)}`);
    }
    if (oldVal?.letterSpacing !== newVal?.letterSpacing) {
      changes.push(`Letter spacing : ${oldVal?.letterSpacing} → ${newVal?.letterSpacing}`);
    }

    if (changes.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        {changes.map((c, i) => (
          <p key={i} className="text-xs text-muted">{c}</p>
        ))}
      </div>
    );
  }

  if (item.change_type === 'added') {
    return (
      <div className="mt-2 text-xs text-muted">
        {newVal?.fontFamily as string} {newVal?.fontStyle as string} — {String(newVal?.fontSize)}px / {lh(newVal?.lineHeight)}
      </div>
    );
  }

  return null;
}

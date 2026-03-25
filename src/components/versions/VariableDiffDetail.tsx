'use client';

import type { DiffItem } from '@/lib/types';

interface Props {
  item: DiffItem;
}

function extractHex(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && value.startsWith('#')) return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.r !== undefined && obj.g !== undefined && obj.b !== undefined) {
      const r = Math.round((obj.r as number) * 255).toString(16).padStart(2, '0');
      const g = Math.round((obj.g as number) * 255).toString(16).padStart(2, '0');
      const b = Math.round((obj.b as number) * 255).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`.toUpperCase();
    }
    if (obj.color) return extractHex(obj.color);
  }
  return null;
}

function getFirstModeValue(data: Record<string, unknown> | null): unknown {
  if (!data) return null;
  const vbm = data.valuesByMode as Record<string, unknown> | undefined;
  if (vbm) {
    const vals = Object.values(vbm);
    return vals.length > 0 ? vals[0] : null;
  }
  return null;
}

function ValuePill({ value, variant }: { value: unknown; variant?: 'old' | 'new' | 'neutral' }) {
  if (value === null || value === undefined) return null;

  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const hex = extractHex(value) ?? (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(value) ? value : null);

  const borderColor = variant === 'old'
    ? 'border-amber-200'
    : variant === 'new'
      ? 'border-amber-200'
      : 'border-gray-200';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${borderColor} bg-white text-xs`}>
      {hex && (
        <span
          className="w-3 h-3 rounded-[3px] border border-gray-200 shrink-0"
          style={{ backgroundColor: hex }}
        />
      )}
      <span className="text-gray-700 font-mono text-[11px]">{str}</span>
    </span>
  );
}

export function VariableDiffDetail({ item }: Props) {
  const oldData = item.old_value as Record<string, unknown> | null;
  const newData = item.new_value as Record<string, unknown> | null;

  if (item.change_type === 'added') {
    const val = getFirstModeValue(newData);
    return (
      <div className="mt-2 flex items-center gap-2">
        <ValuePill value={val} variant="new" />
      </div>
    );
  }

  if (item.change_type === 'modified') {
    const oldVal = getFirstModeValue(oldData);
    const newVal = getFirstModeValue(newData);
    return (
      <div className="mt-2 flex items-center gap-2">
        <ValuePill value={oldVal} variant="old" />
        <span className="text-gray-400 text-sm">→</span>
        <ValuePill value={newVal} variant="new" />
      </div>
    );
  }

  if (item.change_type === 'removed') {
    const val = getFirstModeValue(oldData);
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-red-500 font-medium">Supprimée</span>
        {val != null && <ValuePill value={val} variant="old" />}
      </div>
    );
  }

  return null;
}

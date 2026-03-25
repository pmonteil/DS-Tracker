'use client';

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { FigmaBranch } from '@/lib/types';

interface BranchCardProps {
  branch: FigmaBranch;
  selected: boolean;
  onSelect: (branch: FigmaBranch) => void;
}

export function BranchCard({ branch, selected, onSelect }: BranchCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(branch)}
      className={`
        w-full text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer
        ${
          selected
            ? 'border-blue-500/50 bg-blue-500/[0.08] shadow-[0_0_20px_-4px_rgba(59,130,246,0.15)]'
            : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${selected ? 'bg-blue-400' : 'bg-amber-400'}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${selected ? 'text-blue-200' : 'text-slate-200'}`}>
            {branch.name}
          </p>
        </div>
        {branch.last_modified && (
          <span className="text-xs text-slate-400 shrink-0">
            {formatDistanceToNow(new Date(branch.last_modified), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
        )}
      </div>
    </button>
  );
}

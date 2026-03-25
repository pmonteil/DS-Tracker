'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { BranchCard } from './BranchCard';
import type { FigmaBranch } from '@/lib/types';

interface BranchListProps {
  onCompare: (branch: FigmaBranch) => void;
  comparing: boolean;
}

export function BranchList({ onCompare, comparing }: BranchListProps) {
  const [branches, setBranches] = useState<FigmaBranch[]>([]);
  const [selected, setSelected] = useState<FigmaBranch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/figma/branches');
      const data = await res.json();
      if (!res.ok) {
        const msg = [data.error, data.hint, data.details]
          .filter(Boolean)
          .join(' — ');
        throw new Error(msg || data.error);
      }
      setBranches(data.branches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  if (loading) return <Loader message="Chargement des branches..." />;
  if (error) {
    return (
      <div className="text-center py-12 px-2">
        <p className="text-sm text-red-400 mb-3 max-w-md mx-auto whitespace-pre-wrap text-left">
          {error}
        </p>
        <button
          onClick={fetchBranches}
          className="px-4 py-2 text-sm bg-white/[0.06] text-slate-300 rounded-lg border border-white/[0.08] hover:bg-white/[0.1] transition-colors cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <h2 className="text-[13px] font-medium text-slate-300 uppercase tracking-wider">
            Branches actives
          </h2>
          <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/[0.06] text-slate-400 font-mono">
            {branches.length}
          </span>
        </div>
        <button
          onClick={fetchBranches}
          className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/[0.05]"
          title="Rafraîchir"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {branches.length === 0 ? (
        <p className="text-sm text-slate-300 text-center py-8">
          Aucune branche active
        </p>
      ) : (
        <div className="space-y-1.5">
          {branches.map((branch) => (
            <BranchCard
              key={branch.key}
              branch={branch}
              selected={selected?.key === branch.key}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-6">
          <button
            onClick={() => onCompare(selected)}
            disabled={comparing}
            className="w-full px-6 py-3 bg-white text-slate-900 rounded-xl text-sm font-medium hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {comparing ? 'Analyse en cours...' : 'Comparer avec main'}
            {!comparing && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
          </button>
        </div>
      )}
    </div>
  );
}

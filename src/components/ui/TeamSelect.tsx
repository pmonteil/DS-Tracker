'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { TEAMS } from '@/lib/teams';

interface TeamSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function TeamSelect({ value, onChange }: TeamSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TEAMS.find((t) => t.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-sm text-left hover:border-white/[0.28] transition-colors cursor-pointer"
      >
        {selected ? (
          <>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: selected.color,
                boxShadow: `0 0 6px ${selected.color}90`,
              }}
            />
            <span className="text-slate-100">{selected.label}</span>
          </>
        ) : (
          <span className="text-slate-400">Choisir une équipe...</span>
        )}
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl shadow-black/50 z-50">
          {TEAMS.map((team) => (
            <button
              key={team.value}
              type="button"
              onClick={() => {
                onChange(team.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                team.value === value
                  ? 'bg-white/[0.08] text-slate-100'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: team.color,
                  boxShadow: `0 0 6px ${team.color}90`,
                }}
              />
              <span className="flex-1 text-left">{team.label}</span>
              {team.value === value && (
                <Check className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Download } from 'lucide-react';
import { DESIGN_SYSTEM_COLLECTIONS, type DSVariable } from '@/lib/design-system-variables';

const BRAND_HEX_MAP: Record<string, string> = {};
for (const v of DESIGN_SYSTEM_COLLECTIONS[0].variables) {
  if (v.type === 'COLOR') {
    const shortName = v.name;
    const hex = Object.values(v.values)[0] as string;
    BRAND_HEX_MAP[shortName] = hex;
  }
}

function resolveColorHex(value: string | number): string | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith('#')) return value;

  if (BRAND_HEX_MAP[value]) return BRAND_HEX_MAP[value];

  const alias = DESIGN_SYSTEM_COLLECTIONS[1].variables.find((v) => v.name === value);
  if (alias) {
    const aliasTarget = Object.values(alias.values)[0] as string;
    if (BRAND_HEX_MAP[aliasTarget]) return BRAND_HEX_MAP[aliasTarget];
  }

  return null;
}

function isAlias(value: string | number): boolean {
  return typeof value === 'string' && !value.startsWith('#');
}

function groupByCategory(variables: DSVariable[]): Record<string, DSVariable[]> {
  const groups: Record<string, DSVariable[]> = {};
  for (const v of variables) {
    const slashIdx = v.name.indexOf('/');
    const category = slashIdx > -1 ? v.name.slice(0, slashIdx) : 'Autres';
    if (!groups[category]) groups[category] = [];
    groups[category].push(v);
  }
  return groups;
}

function ColorSwatch({ hex }: { hex: string | null }) {
  if (!hex) return <span className="w-6 h-6 rounded border border-white/10 bg-slate-800 inline-flex items-center justify-center text-[8px] text-slate-500">?</span>;
  const isLight = isLightColor(hex);
  return (
    <span
      className="w-6 h-6 rounded border inline-block shrink-0"
      style={{
        backgroundColor: hex,
        borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
      }}
      title={hex}
    />
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

function ValueCell({ value, type }: { value: string | number; type: string }) {
  if (type === 'COLOR') {
    const hex = resolveColorHex(value);
    if (isAlias(value)) {
      return (
        <span className="inline-flex items-center gap-2">
          <ColorSwatch hex={hex} />
          <span className="text-xs font-mono text-blue-300/80">{value as string}</span>
          {hex && <span className="text-[10px] font-mono text-slate-500">{hex}</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2">
        <ColorSwatch hex={hex} />
        <span className="text-xs font-mono text-slate-300">{value as string}</span>
      </span>
    );
  }

  if (typeof value === 'string' && isAlias(value)) {
    return <span className="text-xs font-mono text-blue-300/80">{value}</span>;
  }

  if (type === 'FLOAT') {
    return <span className="text-xs font-mono text-slate-300">{value}</span>;
  }

  return <span className="text-xs text-slate-300">{String(value)}</span>;
}

export default function VariablesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');

  const collection = DESIGN_SYSTEM_COLLECTIONS[activeTab];
  const modeKeys = Object.keys(collection.modes);

  const filtered = useMemo(() => {
    if (!search.trim()) return collection.variables;
    const q = search.toLowerCase();
    return collection.variables.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        Object.values(v.values).some((val) => String(val).toLowerCase().includes(q)),
    );
  }, [collection, search]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);
  const categoryNames = Object.keys(groups);

  const collectionStats = useMemo(() => {
    return DESIGN_SYSTEM_COLLECTIONS.map((c) => ({
      name: c.name,
      count: c.variables.length,
    }));
  }, []);

  const downloadMd = useCallback(() => {
    const lines: string[] = ['# Design System — Variables\n'];
    for (const col of DESIGN_SYSTEM_COLLECTIONS) {
      const mk = Object.keys(col.modes);
      lines.push(`## ${col.name}\n`);
      const groups = groupByCategory(col.variables);
      for (const [cat, vars] of Object.entries(groups)) {
        lines.push(`### ${cat}\n`);
        const header = `| Variable | Type | ${mk.map((k) => col.modes[k]).join(' | ')} |`;
        const sep = `|---|---|${mk.map(() => '---').join('|')}|`;
        lines.push(header, sep);
        for (const v of vars) {
          const short = v.name.includes('/') ? v.name.slice(v.name.indexOf('/') + 1) : v.name;
          const vals = mk.map((k) => {
            const val = v.values[k];
            if (v.type === 'COLOR' && typeof val === 'string' && !val.startsWith('#')) {
              const hex = resolveColorHex(val);
              return hex ? `\`${val}\` (${hex})` : `\`${val}\``;
            }
            if (typeof val === 'string' && !val.startsWith('#') && isAlias(val)) return `\`${val}\``;
            return String(val);
          });
          lines.push(`| ${short} | ${v.type} | ${vals.join(' | ')} |`);
        }
        lines.push('');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-system-variables.md';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Sticky toolbar — full width, collé sous le header app */}
      <div className="sticky top-0 z-[9] w-full bg-slate-950 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-3 h-11">
          <div className="flex gap-0.5">
            {DESIGN_SYSTEM_COLLECTIONS.map((c, i) => (
              <button
                key={c.name}
                onClick={() => { setActiveTab(i); setSearch(''); }}
                className={`px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer ${
                  activeTab === i
                    ? 'bg-white/[0.1] text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {c.name}
                <span className="ml-1 text-[10px] text-slate-500">{collectionStats[i].count}</span>
              </button>
            ))}
          </div>

          {modeKeys.length > 1 && (
            <>
              <div className="w-px h-4 bg-white/[0.08]" />
              {modeKeys.map((k) => (
                <span
                  key={k}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.06] text-slate-400 border border-white/[0.06]"
                >
                  {collection.modes[k]}
                </span>
              ))}
            </>
          )}

          <div className="flex-1" />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-48 px-2.5 py-1 text-xs bg-white/[0.04] border border-white/[0.06] rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20"
          />

          <button
            type="button"
            onClick={downloadMd}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            .md
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
              Variables du Design System
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {DESIGN_SYSTEM_COLLECTIONS.reduce((s, c) => s + c.variables.length, 0)} variables
              &middot; {DESIGN_SYSTEM_COLLECTIONS.length} collections
            </p>
          </div>
        </div>

        {categoryNames.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Aucune variable trouvée pour &ldquo;{search}&rdquo;
          </div>
        )}

        <div className="space-y-6">
          {categoryNames.map((cat) => {
            const vars = groups[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-sm font-semibold text-slate-200">{cat}</h2>
                  <span className="text-[10px] text-slate-500">{vars.length}</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-[11px] text-slate-500 uppercase tracking-wider font-medium px-4 py-2.5 w-[40%]">
                          Variable
                        </th>
                        <th className="text-left text-[11px] text-slate-500 uppercase tracking-wider font-medium px-4 py-2.5 w-[10%]">
                          Type
                        </th>
                        {modeKeys.map((k) => (
                          <th
                            key={k}
                            className="text-left text-[11px] text-slate-500 uppercase tracking-wider font-medium px-4 py-2.5"
                          >
                            {collection.modes[k]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vars.map((v) => {
                        const shortName = v.name.includes('/') ? v.name.slice(v.name.indexOf('/') + 1) : v.name;
                        return (
                          <tr
                            key={v.name}
                            className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-2">
                              <span className="text-sm text-slate-200">{shortName}</span>
                            </td>
                            <td className="px-4 py-2">
                              <TypeBadge type={v.type} />
                            </td>
                            {modeKeys.map((k) => (
                              <td key={k} className="px-4 py-2">
                                <ValueCell value={v.values[k]} type={v.type} />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    COLOR: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
    FLOAT: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    STRING: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono rounded border ${styles[type] ?? 'bg-white/5 text-slate-400 border-white/10'}`}>
      {type}
    </span>
  );
}

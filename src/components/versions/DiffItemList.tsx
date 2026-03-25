'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { DiffItem } from '@/lib/types';
import { ComponentDiffDetail } from './ComponentDiffDetail';
import { VariableDiffDetail } from './VariableDiffDetail';

interface DiffItemListProps {
  items: DiffItem[];
  versionId?: string;
  onPatchnoteChange?: (markdown: string) => void;
  onExclusionChange?: () => void;
  readOnly?: boolean;
  variableScreenshots?: string[];
  customBlocks?: { title: string; text: string; images: string[] }[];
}

function isSubComponent(item: DiffItem): boolean {
  return item.item_name.startsWith('.') || item.is_internal;
}

function getParentName(item: DiffItem): string | null {
  return item.parent_component ?? null;
}

type CatKey =
  | 'breaking'
  | 'variable_mod'
  | 'component_new'
  | 'component_mod'
  | 'variable_new'
  | 'variable_removed'
  | 'effect_style'
  | 'page';

const categoryDot: Record<CatKey, string> = {
  breaking: 'bg-amber-400',
  variable_mod: 'bg-blue-400',
  component_new: 'bg-green-400',
  component_mod: 'bg-sky-400',
  variable_new: 'bg-teal-400',
  variable_removed: 'bg-red-400',
  effect_style: 'bg-violet-400',
  page: 'bg-gray-400',
};

const categories: {
  key: CatKey;
  label: string;
  filter: (d: DiffItem) => boolean;
}[] = [
  { key: 'breaking', label: 'Breaking changes', filter: (d) => d.is_breaking },
  {
    key: 'variable_mod',
    label: 'Variables modifiées',
    filter: (d) => d.category === 'variable' && d.change_type === 'modified' && !d.is_breaking,
  },
  {
    key: 'component_new',
    label: 'Nouveaux composants',
    filter: (d) => d.category === 'component' && d.change_type === 'added' && !d.is_breaking,
  },
  {
    key: 'component_mod',
    label: 'Composants modifiés',
    filter: (d) => d.category === 'component' && d.change_type === 'modified' && !d.is_breaking,
  },
  {
    key: 'variable_new',
    label: 'Nouvelles variables',
    filter: (d) => d.category === 'variable' && d.change_type === 'added' && !d.is_breaking,
  },
  {
    key: 'variable_removed',
    label: 'Variables supprimées',
    filter: (d) => d.category === 'variable' && d.change_type === 'removed' && !d.is_breaking,
  },
  {
    key: 'effect_style',
    label: "Styles d'effets",
    filter: (d) => d.category === 'effect_style' && !d.is_breaking,
  },
  {
    key: 'page',
    label: 'Structure du fichier',
    filter: (d) => d.category === 'page',
  },
];

interface GroupedEntry {
  parent: DiffItem;
  children: DiffItem[];
}

type ListEntry = DiffItem | GroupedEntry;

function isGrouped(e: ListEntry): e is GroupedEntry {
  return 'parent' in e && 'children' in e;
}

function buildGroups(items: DiffItem[]): ListEntry[] {
  const parents = items.filter((d) => !isSubComponent(d));
  const subs = [...items.filter((d) => isSubComponent(d))];
  const result: ListEntry[] = [];

  for (const p of parents) {
    const children = subs.filter(
      (s) => getParentName(s)?.toLowerCase() === p.item_name.toLowerCase()
    );
    children.forEach((c) => subs.splice(subs.indexOf(c), 1));
    result.push(children.length > 0 ? { parent: p, children } : p);
  }

  for (const orphan of subs) {
    result.push(orphan);
  }

  return result;
}

export function DiffItemList({
  items,
  versionId,
  onPatchnoteChange,
  onExclusionChange,
  readOnly = false,
  variableScreenshots,
  customBlocks,
}: DiffItemListProps) {
  const visible = items.filter((d) => !d.excluded);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const debouncers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const draftDesc = useMemo(() => {
    const base: Record<string, string> = {};
    for (const it of items) {
      if (it.id) base[it.id] = it.description ?? '';
    }
    return { ...base, ...overrides };
  }, [items, overrides]);

  const patchDescription = useCallback(
    async (itemId: string, description: string) => {
      if (!versionId || !onPatchnoteChange) return;
      const res = await fetch(`/api/versions/${versionId}/diff-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (res.ok && data.patchnote_md != null) {
        onPatchnoteChange(data.patchnote_md);
        onExclusionChange?.();
      }
    },
    [versionId, onPatchnoteChange, onExclusionChange]
  );

  const scheduleDescriptionSave = useCallback(
    (itemId: string, description: string) => {
      const prev = debouncers.current.get(itemId);
      if (prev) clearTimeout(prev);
      const t = setTimeout(() => {
        debouncers.current.delete(itemId);
        void patchDescription(itemId, description);
      }, 650);
      debouncers.current.set(itemId, t);
    },
    [patchDescription]
  );

  const handleExclude = async (itemId: string) => {
    if (!versionId || !onPatchnoteChange) return;
    const res = await fetch(`/api/versions/${versionId}/diff-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excluded: true }),
    });
    const data = await res.json();
    if (res.ok && data.patchnote_md != null) {
      onPatchnoteChange(data.patchnote_md);
      onExclusionChange?.();
    }
  };

  function ItemContent({ item, compact }: { item: DiffItem; compact?: boolean }) {
    const desc =
      (item.id && draftDesc[item.id] !== undefined ? draftDesc[item.id] : item.description) ?? '';

    return (
      <>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold text-gray-900`}>
            {item.category === 'variable' && item.family_page && (
              <span className="text-xs font-normal text-gray-400 mr-1.5">{item.family_page}/</span>
            )}
            {item.item_name}
          </span>

          {item.change_type === 'added' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
              Ajouté
            </span>
          )}
          {item.change_type === 'modified' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              Modifié
            </span>
          )}
          {item.change_type === 'removed' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
              Supprimé
            </span>
          )}

          {item.is_breaking && (
            <span className="text-amber-500 text-sm" title="Breaking change">
              ⚠️
            </span>
          )}
        </div>

        {readOnly ? (
          desc && (
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">{desc}</p>
          )
        ) : (
          item.id && (
            <textarea
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }
              }}
              value={desc}
              onChange={(e) => {
                const v = e.target.value;
                setOverrides((prev) => ({ ...prev, [item.id!]: v }));
                scheduleDescriptionSave(item.id!, v);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onBlur={(e) => {
                if (!item.id) return;
                const prev = debouncers.current.get(item.id);
                if (prev) clearTimeout(prev);
                debouncers.current.delete(item.id);
                void patchDescription(item.id, e.currentTarget.value);
              }}
              rows={1}
              placeholder="Note pour les devs..."
              className="mt-2 w-full text-sm text-gray-500 bg-transparent resize-none border-0 p-0 focus:ring-0 focus:outline-none leading-relaxed placeholder-gray-300"
              style={{ overflow: 'hidden' }}
            />
          )
        )}

        {item.category === 'component' && <ComponentDiffDetail item={item} />}
        {item.category === 'variable' && <VariableDiffDetail item={item} />}

        {(item.screenshot_before || item.screenshot_after) && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {item.screenshot_before && (
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Avant
                </span>
                <div className="mt-1.5 rounded-xl border border-gray-100 overflow-hidden bg-gray-50/50 p-3">
                  <img
                    src={item.screenshot_before}
                    alt={`${item.item_name} — avant`}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>
            )}
            {item.screenshot_after && (
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  {item.change_type === 'added' ? 'Nouveau' : 'Après'}
                </span>
                <div className="mt-1.5 rounded-xl border border-gray-100 overflow-hidden bg-gray-50/50 p-3">
                  <img
                    src={item.screenshot_after}
                    alt={`${item.item_name} — après`}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  function ExcludeButton({ itemId, small }: { itemId: string; small?: boolean }) {
    if (readOnly) return null;
    return (
      <button
        type="button"
        title="Exclure du patchnote"
        onClick={() => handleExclude(itemId)}
        className={`absolute ${small ? 'top-2 right-2 w-5 h-5 text-base' : 'top-3 right-3 w-6 h-6 text-lg'} opacity-0 group-hover/card:opacity-100 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all cursor-pointer leading-none`}
      >
        ×
      </button>
    );
  }

  const hasVariables = variableScreenshots && variableScreenshots.length > 0;
  const hasBlocks = customBlocks && customBlocks.some((b) => b.title || b.text || b.images.length > 0);

  if (visible.length === 0 && !hasVariables && !hasBlocks) {
    return (
      <p className="text-sm text-slate-300 text-center py-6">Aucun changement détecté</p>
    );
  }

  return (
    <div>
      {/* Variable screenshots (read-only display) */}
      {hasVariables && (
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-2 h-2 rounded-full shrink-0 bg-teal-400" />
            <span className="text-[13px] font-medium text-slate-300">Variables</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
          <div className="space-y-3 pl-4">
            {variableScreenshots!.map((url, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-white/[0.06] bg-white">
                <img src={url} alt={`Variables — capture ${i + 1}`} className="w-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff items by category */}
      {categories.map((cat) => {
        const rawItems = visible.filter(cat.filter);
        if (rawItems.length === 0) return null;

        const grouped = buildGroups(rawItems);
        const parentCount = rawItems.filter((d) => !isSubComponent(d)).length || rawItems.length;

        return (
          <div key={cat.key} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${categoryDot[cat.key]}`} />
              <span className="text-[13px] font-medium text-slate-300">{cat.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 font-medium">
                {parentCount}
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="space-y-3 pl-4">
              {grouped.map((entry, i) => {
                if (isGrouped(entry)) {
                  const { parent, children } = entry;
                  const pk = parent.id || `${cat.key}-g-${i}`;

                  return (
                    <div
                      key={pk}
                      className="group/card relative bg-white rounded-2xl border border-black/5 p-5 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className={readOnly ? '' : 'pr-6'}>
                        <ItemContent item={parent} />
                      </div>

                      {parent.id && <ExcludeButton itemId={parent.id} />}

                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          Sous-composants internes · {children.length}
                        </p>
                        <div className="space-y-2">
                          {children.map((child, ci) => {
                            const ck = child.id || `${cat.key}-c-${ci}`;
                            return (
                              <div
                                key={ck}
                                className="group/card relative bg-amber-50/40 rounded-xl border border-amber-200/30 p-3"
                              >
                                <div className={readOnly ? '' : 'pr-5'}>
                                  <ItemContent item={child} compact />
                                </div>
                                {child.id && <ExcludeButton itemId={child.id} small />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const item = entry as DiffItem;
                const k = item.id || `${cat.key}-${i}`;

                return (
                  <div
                    key={k}
                    className="group/card relative bg-white rounded-2xl border border-black/5 p-5 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className={readOnly ? '' : 'pr-6'}>
                      <ItemContent item={item} />
                    </div>
                    {item.id && <ExcludeButton itemId={item.id} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Custom blocks (read-only display) */}
      {hasBlocks && (
        <div className="mb-8">
          {customBlocks!
            .filter((b) => b.title || b.text || b.images.length > 0)
            .map((block, i) => (
              <div key={i} className="mb-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-purple-400" />
                  <span className="text-[13px] font-medium text-slate-300">
                    {block.title || 'Bloc supplémentaire'}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="pl-4 space-y-3">
                  {block.text && (
                    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm prose prose-sm max-w-none prose-p:text-gray-600 prose-strong:text-gray-900">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {block.text}
                      </ReactMarkdown>
                    </div>
                  )}
                  {block.images.length > 0 && block.images.map((url, j) => (
                    <div key={j} className="rounded-xl overflow-hidden border border-white/[0.06] bg-white">
                      <img src={url} alt={`${block.title || 'Bloc'} — image ${j + 1}`} className="w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

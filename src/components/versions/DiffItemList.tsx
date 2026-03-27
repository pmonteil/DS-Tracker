'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { RotateCcw } from 'lucide-react';
import type { DiffItem } from '@/lib/types';
import { INTEGRATION_VARIABLE_SECTION } from '@/lib/integration-keys';
import {
  buildGroups,
  diffItemCategories,
  isGrouped,
  isSubComponent,
  type DiffItemCategoryKey,
} from '@/lib/integration-trackable';
import { ComponentDiffDetail } from './ComponentDiffDetail';
import { VariableDiffDetail } from './VariableDiffDetail';

interface DiffItemListProps {
  items: DiffItem[];
  versionId?: string;
  onPatchnoteChange?: (markdown: string) => void;
  onExclusionChange?: () => void;
  readOnly?: boolean;
  variableScreenshots?: string[];
  variableBlocks?: { title: string; text: string; images: string[] }[];
  customBlocks?: { title: string; text: string; images: string[] }[];
  completedItemIds?: Set<string>;
  onToggleIntegration?: (itemId: string, completed: boolean) => void;
}

const categoryDot: Record<DiffItemCategoryKey, string> = {
  breaking: 'bg-amber-400',
  variable_mod: 'bg-blue-400',
  component_new: 'bg-green-400',
  component_mod: 'bg-sky-400',
  variable_new: 'bg-teal-400',
  variable_removed: 'bg-red-400',
  effect_style: 'bg-violet-400',
  page: 'bg-gray-400',
};

function IntegrationCheck({
  itemId,
  completed,
  onToggle,
}: {
  itemId: string;
  completed: boolean;
  onToggle: (id: string, val: boolean) => void;
}) {
  const [animating, setAnimating] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !completed;
    onToggle(itemId, next);
    if (next) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 700);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`
        inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 relative shrink-0 cursor-pointer whitespace-nowrap
        ${completed
          ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/35'
          : 'bg-white/[0.08] text-slate-200 ring-1 ring-white/[0.14] hover:bg-emerald-500/15 hover:text-emerald-200'
        }
      `}
      style={animating ? { animation: 'check-pop 0.35s ease-out, ripple-out 0.7s ease-out' } : undefined}
      title={completed ? 'Marquer comme non fait' : 'Marquer comme intégré'}
    >
      {completed ? (
        <>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Intégré</span>
        </>
      ) : (
        <span>c&apos;est OK</span>
      )}
      {animating && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ animation: 'ping-once 0.6s ease-out forwards', backgroundColor: 'rgba(16,185,129,0.3)' }}
        />
      )}
    </button>
  );
}

export function DiffItemList({
  items,
  versionId,
  onPatchnoteChange,
  onExclusionChange,
  readOnly = false,
  variableScreenshots,
  variableBlocks,
  customBlocks,
  completedItemIds,
  onToggleIntegration,
}: DiffItemListProps) {
  const visible = items.filter((d) => !d.excluded);
  const excluded = items.filter((d) => d.excluded);
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
      }
    },
    [versionId, onPatchnoteChange]
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

  const handleRestore = async (itemId: string) => {
    if (!versionId || !onPatchnoteChange) return;
    const res = await fetch(`/api/versions/${versionId}/diff-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excluded: false }),
    });
    const data = await res.json();
    if (res.ok && data.patchnote_md != null) {
      onPatchnoteChange(data.patchnote_md);
      onExclusionChange?.();
    }
  };

  /* Render function — NOT a component. Called as renderItemContent(...) to avoid
     React creating a new component type on each render (which would unmount/remount
     the textarea and lose focus). */
  const renderItemContent = (item: DiffItem, compact?: boolean) => {
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
          item.id && !item.excluded && (
            <textarea
              key={`desc-${item.id}`}
              defaultValue={desc}
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
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }
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
  };

  const showIntegration = readOnly && !!onToggleIntegration && !!completedItemIds;

  const renderExcludeButton = (itemId: string, small?: boolean) => {
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
  };

  const renderRestoreButton = (itemId: string) => (
    <button
      type="button"
      title="Remettre dans le patchnote"
      onClick={() => handleRestore(itemId)}
      className="absolute top-1/2 -translate-y-1/2 -right-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.08] text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer ring-1 ring-white/[0.1]"
    >
      <RotateCcw className="w-3.5 h-3.5" />
    </button>
  );

  const hasVariables = variableScreenshots && variableScreenshots.length > 0;
  const hasVariableBlocks = variableBlocks && variableBlocks.some((b) => b.title || b.text || b.images.length > 0);
  const hasBlocks = customBlocks && customBlocks.some((b) => b.title || b.text || b.images.length > 0);

  if (visible.length === 0 && excluded.length === 0 && !hasVariables && !hasVariableBlocks && !hasBlocks) {
    return (
      <p className="text-sm text-slate-300 text-center py-6">Aucun changement détecté</p>
    );
  }

  return (
    <div>
      {/* Variable screenshots + blocks (read-only display) */}
      {(hasVariables || hasVariableBlocks) && (
        <div className="mb-8">
          <div className="flex items-start gap-3">
            <div
              className={`flex-1 min-w-0 transition-opacity duration-500 ${
                showIntegration && completedItemIds.has(INTEGRATION_VARIABLE_SECTION) ? 'opacity-40' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2 h-2 rounded-full shrink-0 bg-teal-400" />
                <span className="text-[13px] font-medium text-slate-300">Variables</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="space-y-3 pl-4">
                {hasVariables && variableScreenshots!.map((url, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-white/[0.06] bg-white">
                    <img src={url} alt={`Variables — capture ${i + 1}`} className="w-full" />
                  </div>
                ))}
                {hasVariableBlocks && variableBlocks!
                  .filter((b) => b.title || b.text || b.images.length > 0)
                  .map((block, i) => (
                    <div key={`vb-${i}`}>
                      {block.title && (
                        <p className="text-sm font-medium text-slate-200 mb-1.5">{block.title}</p>
                      )}
                      {block.text && (
                        <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-5 mb-2 text-sm text-slate-200 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:text-slate-200 prose-strong:text-white">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {block.text.replace(/\n/g, '  \n')}
                          </ReactMarkdown>
                        </div>
                      )}
                      {block.images.length > 0 && block.images.map((url, j) => (
                        <div key={j} className="rounded-xl overflow-hidden border border-white/[0.06] bg-white mb-2">
                          <img src={url} alt={`${block.title || 'Variables'} — image ${j + 1}`} className="w-full" />
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
            {showIntegration && (
              <div className="shrink-0 mt-7">
                <IntegrationCheck
                  itemId={INTEGRATION_VARIABLE_SECTION}
                  completed={completedItemIds.has(INTEGRATION_VARIABLE_SECTION)}
                  onToggle={onToggleIntegration!}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diff items by category */}
      {diffItemCategories.map((cat) => {
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
                  const parentDone = showIntegration && parent.id && completedItemIds.has(parent.id);

                  return (
                    <div key={pk} className="flex items-start gap-3">
                      <div
                        className={`group/card relative flex-1 min-w-0 bg-white rounded-2xl border border-black/5 p-5 shadow-sm hover:shadow-md transition-all duration-500 ${
                          parentDone ? 'opacity-40' : ''
                        }`}
                      >
                        <div className={readOnly ? '' : 'pr-6'}>
                          {renderItemContent(parent)}
                        </div>

                        {parent.id && renderExcludeButton(parent.id)}

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
                                    {renderItemContent(child, true)}
                                  </div>
                                  {child.id && renderExcludeButton(child.id, true)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {showIntegration && parent.id && (
                        <div className="shrink-0 pt-4">
                          <IntegrationCheck
                            itemId={parent.id}
                            completed={completedItemIds.has(parent.id)}
                            onToggle={onToggleIntegration}
                          />
                        </div>
                      )}
                    </div>
                  );
                }

                const item = entry as DiffItem;
                const k = item.id || `${cat.key}-${i}`;
                const itemDone = showIntegration && item.id && completedItemIds.has(item.id);

                return (
                  <div key={k} className="flex items-start gap-3">
                    <div
                      className={`group/card relative flex-1 min-w-0 bg-white rounded-2xl border border-black/5 p-5 shadow-sm hover:shadow-md transition-all duration-500 ${
                        itemDone ? 'opacity-40' : ''
                      }`}
                    >
                      <div className={readOnly ? '' : 'pr-6'}>
                        {renderItemContent(item)}
                      </div>
                      {item.id && renderExcludeButton(item.id)}
                    </div>
                    {showIntegration && item.id && (
                      <div className="shrink-0 pt-4">
                        <IntegrationCheck
                          itemId={item.id}
                          completed={completedItemIds.has(item.id)}
                          onToggle={onToggleIntegration}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Excluded items (soft-delete: dimmed with restore button) */}
      {!readOnly && excluded.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-2 h-2 rounded-full shrink-0 bg-slate-600" />
            <span className="text-[13px] font-medium text-slate-500">Exclus</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-500 font-medium">
              {excluded.length}
            </span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>

          <div className="space-y-2 pl-4">
            {excluded.map((item) => {
              const k = item.id || `excl-${item.item_name}`;
              return (
                <div key={k} className="relative pr-12">
                  <div className="bg-white/60 rounded-2xl border border-black/[0.03] p-4 shadow-sm opacity-40 transition-opacity hover:opacity-60">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-gray-900">
                        {item.item_name}
                      </span>
                      {item.change_type === 'added' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Ajouté</span>
                      )}
                      {item.change_type === 'modified' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Modifié</span>
                      )}
                      {item.change_type === 'removed' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Supprimé</span>
                      )}
                    </div>
                  </div>
                  {item.id && renderRestoreButton(item.id)}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-5 text-sm text-slate-200 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:text-slate-200 prose-strong:text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {block.text.replace(/\n/g, '  \n')}
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

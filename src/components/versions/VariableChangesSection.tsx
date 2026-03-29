'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check, Palette, Hash, Type, ToggleLeft } from 'lucide-react';
import type { DiffItem } from '@/lib/types';

interface VariableChangesSectionProps {
  items: DiffItem[];
  completedItemIds?: Set<string>;
  onToggleIntegration?: (itemId: string, completed: boolean) => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof Palette; label: string; color: string }> = {
  COLOR: { icon: Palette, label: 'Color', color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
  FLOAT: { icon: Hash, label: 'Float', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  STRING: { icon: Type, label: 'String', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  BOOLEAN: { icon: ToggleLeft, label: 'Bool', color: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
};

const CHANGE_BADGE: Record<string, { label: string; cls: string }> = {
  added: { label: 'Ajoutée', cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
  modified: { label: 'Modifiée', cls: 'text-blue-300 bg-blue-400/10 border-blue-400/20' },
  removed: { label: 'Supprimée', cls: 'text-red-300 bg-red-400/10 border-red-400/20' },
};

function extractHex(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6,8}$/i.test(value)) return value;
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

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function ColorSwatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block w-5 h-5 rounded-md border border-white/20 shrink-0 shadow-sm"
      style={{ backgroundColor: hex }}
    />
  );
}

function ValueDisplay({ value, resolvedType }: { value: unknown; resolvedType?: string }) {
  const hex = extractHex(value);
  const isColor = resolvedType === 'COLOR' || hex;

  if (isColor && hex) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <ColorSwatch hex={hex} />
        <code className="text-[11px] text-slate-400 font-mono">{hex}</code>
      </span>
    );
  }

  return (
    <code className="text-[11px] text-slate-300 font-mono bg-white/[0.05] px-1.5 py-0.5 rounded">
      {formatValue(value)}
    </code>
  );
}

function ModeValueRow({
  modeName,
  oldVal,
  newVal,
  changeType,
  resolvedType,
}: {
  modeName?: string;
  oldVal?: unknown;
  newVal?: unknown;
  changeType: string;
  resolvedType?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5 min-h-[28px]">
      {modeName && (
        <span className="text-[11px] text-slate-500 font-medium w-16 shrink-0 text-right">
          {modeName}
        </span>
      )}
      {changeType === 'modified' && (
        <>
          <ValueDisplay value={oldVal} resolvedType={resolvedType} />
          <span className="text-slate-600 text-xs shrink-0">&rarr;</span>
          <ValueDisplay value={newVal} resolvedType={resolvedType} />
        </>
      )}
      {changeType === 'added' && (
        <ValueDisplay value={newVal} resolvedType={resolvedType} />
      )}
      {changeType === 'removed' && (
        <span className="line-through opacity-60">
          <ValueDisplay value={oldVal} resolvedType={resolvedType} />
        </span>
      )}
    </div>
  );
}

function IntegrationCheckButton({
  itemId,
  completed,
  onToggle,
}: {
  itemId: string;
  completed: boolean;
  onToggle: (itemId: string, completed: boolean) => void;
}) {
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    if (!completed) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }
    onToggle(itemId, !completed);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
        completed
          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400'
          : 'border-white/[0.12] hover:border-white/[0.25] text-transparent hover:text-slate-500'
      } ${animating ? 'scale-125' : ''}`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

interface CollectionGroup {
  name: string;
  items: DiffItem[];
  stats: { added: number; modified: number; removed: number };
}

function groupByCollection(items: DiffItem[]): CollectionGroup[] {
  const map = new Map<string, DiffItem[]>();
  for (const item of items) {
    const collection = item.family_page || 'Autre';
    if (!map.has(collection)) map.set(collection, []);
    map.get(collection)!.push(item);
  }

  const groups: CollectionGroup[] = [];
  for (const [name, groupItems] of map) {
    groups.push({
      name,
      items: groupItems,
      stats: {
        added: groupItems.filter((i) => i.change_type === 'added').length,
        modified: groupItems.filter((i) => i.change_type === 'modified').length,
        removed: groupItems.filter((i) => i.change_type === 'removed').length,
      },
    });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function CollectionCard({
  group,
  completedItemIds,
  onToggleIntegration,
}: {
  group: CollectionGroup;
  completedItemIds?: Set<string>;
  onToggleIntegration?: (itemId: string, completed: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const statParts: string[] = [];
  if (group.stats.modified > 0) statParts.push(`${group.stats.modified} modif.`);
  if (group.stats.added > 0) statParts.push(`${group.stats.added} ajout.`);
  if (group.stats.removed > 0) statParts.push(`${group.stats.removed} suppr.`);

  return (
    <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" strokeWidth={1.5} />
        )}
        <span className="text-sm font-semibold text-slate-200">{group.name}</span>
        <span className="text-[11px] text-slate-500 ml-auto">{statParts.join(' · ')}</span>
      </button>

      {!collapsed && (
        <div className="border-t border-white/[0.06]">
          {group.items.map((item, idx) => (
            <VariableRow
              key={item.item_id || `${item.item_name}-${idx}`}
              item={item}
              isLast={idx === group.items.length - 1}
              completedItemIds={completedItemIds}
              onToggleIntegration={onToggleIntegration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariableRow({
  item,
  isLast,
  completedItemIds,
  onToggleIntegration,
}: {
  item: DiffItem;
  isLast: boolean;
  completedItemIds?: Set<string>;
  onToggleIntegration?: (itemId: string, completed: boolean) => void;
}) {
  const data = item.change_type === 'removed' ? item.old_value : item.new_value;
  const oldData = item.old_value as Record<string, unknown> | null;
  const newData = item.new_value as Record<string, unknown> | null;

  const resolvedType = (data?.resolvedType as string) || '';
  const typeConf = TYPE_CONFIG[resolvedType];
  const changeBadge = CHANGE_BADGE[item.change_type];
  const TypeIcon = typeConf?.icon;

  const modeNames = (data?.modeNames as Record<string, string>) || {};
  const newModes = (newData?.valuesByMode as Record<string, unknown>) || {};
  const oldModes = (oldData?.valuesByMode as Record<string, unknown>) || {};
  const allModeKeys = useMemo(() => {
    const keys = new Set([...Object.keys(oldModes), ...Object.keys(newModes)]);
    return [...keys];
  }, [oldModes, newModes]);

  const showModeLabels = allModeKeys.length > 1;
  const itemId = item.id || item.item_id || item.item_name;
  const isCompleted = completedItemIds?.has(itemId);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 ${
        !isLast ? 'border-b border-white/[0.05]' : ''
      } ${item.excluded ? 'opacity-40' : ''}`}
    >
      {onToggleIntegration && itemId && (
        <div className="pt-0.5">
          <IntegrationCheckButton
            itemId={itemId}
            completed={!!isCompleted}
            onToggle={onToggleIntegration}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[13px] font-medium text-slate-200 font-mono">{item.item_name}</span>

          {typeConf && TypeIcon && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeConf.color}`}>
              <TypeIcon className="h-3 w-3" strokeWidth={1.5} />
              {typeConf.label}
            </span>
          )}

          {changeBadge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${changeBadge.cls}`}>
              {changeBadge.label}
            </span>
          )}
        </div>

        <div className="pl-0.5">
          {item.change_type === 'modified' && allModeKeys.map((modeKey) => {
            const oldVal = oldModes[modeKey];
            const newVal = newModes[modeKey];
            if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
            return (
              <ModeValueRow
                key={modeKey}
                modeName={showModeLabels ? (modeNames[modeKey] || modeKey) : undefined}
                oldVal={oldVal}
                newVal={newVal}
                changeType="modified"
                resolvedType={resolvedType}
              />
            );
          })}

          {item.change_type === 'added' && allModeKeys.map((modeKey) => (
            <ModeValueRow
              key={modeKey}
              modeName={showModeLabels ? (modeNames[modeKey] || modeKey) : undefined}
              newVal={newModes[modeKey]}
              changeType="added"
              resolvedType={resolvedType}
            />
          ))}

          {item.change_type === 'removed' && Object.entries(oldModes).map(([modeKey, val]) => (
            <ModeValueRow
              key={modeKey}
              modeName={showModeLabels ? (modeNames[modeKey] || modeKey) : undefined}
              oldVal={val}
              changeType="removed"
              resolvedType={resolvedType}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function VariableChangesSection({
  items,
  completedItemIds,
  onToggleIntegration,
}: VariableChangesSectionProps) {
  const variableItems = useMemo(
    () => items.filter((i) => i.category === 'variable' && !i.excluded),
    [items],
  );

  const groups = useMemo(() => groupByCollection(variableItems), [variableItems]);

  if (variableItems.length === 0) return null;

  const totalMod = variableItems.filter((i) => i.change_type === 'modified').length;
  const totalAdd = variableItems.filter((i) => i.change_type === 'added').length;
  const totalDel = variableItems.filter((i) => i.change_type === 'removed').length;

  const summaryParts: string[] = [];
  if (totalMod > 0) summaryParts.push(`${totalMod} modifiée${totalMod > 1 ? 's' : ''}`);
  if (totalAdd > 0) summaryParts.push(`${totalAdd} ajoutée${totalAdd > 1 ? 's' : ''}`);
  if (totalDel > 0) summaryParts.push(`${totalDel} supprimée${totalDel > 1 ? 's' : ''}`);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400" />
          <h2 className="text-sm font-semibold text-slate-200">Variables</h2>
        </div>
        <span className="text-[11px] text-slate-500">
          {variableItems.length} changement{variableItems.length > 1 ? 's' : ''}{' '}
          {summaryParts.length > 0 && `(${summaryParts.join(', ')})`}
        </span>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <CollectionCard
            key={group.name}
            group={group}
            completedItemIds={completedItemIds}
            onToggleIntegration={onToggleIntegration}
          />
        ))}
      </div>
    </section>
  );
}

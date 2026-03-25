'use client';

import type { DiffItem } from '@/lib/types';

interface Props {
  item: DiffItem;
}

function summarizeVariants(variants: string[]): string {
  if (!variants || variants.length === 0) return '';
  const props = new Set<string>();
  for (const v of variants) {
    for (const part of v.split(',').map((p) => p.trim())) {
      const [propName] = part.split('=');
      if (propName) props.add(propName.trim());
    }
  }
  if (props.size === 0) return '';
  if (props.size === 1) return `nouvelles valeurs de ${[...props][0]}`;
  return `combinaisons ${[...props].join(' × ')}`;
}

const SlidersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-subtle shrink-0" aria-hidden>
    <path
      d="M2 4h4m4 0h4M2 8h8m2 0h2M2 12h2m4 0h6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export function ComponentDiffDetail({ item }: Props) {
  const oldVal = item.old_value as Record<string, unknown> | null;
  const newVal = item.new_value as Record<string, unknown> | null;

  if (item.change_type === 'added') {
    const variantCount = (newVal?.variantCount as number) ?? 0;
    const properties = (newVal?.properties as { name: string; options: string[] }[]) ?? [];
    return (
      <div className="mt-3 space-y-2">
        {variantCount > 0 && (
          <p className="text-xs text-muted">{variantCount} variantes</p>
        )}
        {properties.map((prop) => (
          <div key={prop.name} className="flex items-start gap-2">
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <SlidersIcon />
              <span className="text-xs font-medium text-foreground">{prop.name}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {prop.options?.map((opt) => (
                <span
                  key={opt}
                  className="text-xs px-2 py-0.5 rounded-full bg-neutral-bg text-muted border border-neutral-border"
                >
                  {opt}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (item.change_type === 'modified') {
    const renamedProps = (newVal?.renamedProps as { from: string; to: string }[]) ?? [];
    const addedDetailed =
      (newVal?.addedPropsDetailed as { name: string; options: string[] }[]) ?? [];
    const removedDetailed =
      (newVal?.removedPropsDetailed as { name: string; options: string[] }[]) ?? [];

    const addedVariants = (newVal?.addedVariants as string[]) ?? [];
    const removedVariants = (newVal?.removedVariants as string[]) ?? [];

    const onlyRenameNoVisual =
      renamedProps.length > 0 &&
      addedVariants.length === 0 &&
      removedVariants.length === 0 &&
      addedDetailed.length === 0 &&
      removedDetailed.length === 0;

    const changes: React.ReactNode[] = [];

    const oldName = oldVal?.name as string | undefined;
    const newName = newVal?.name as string | undefined;
    if (oldName && newName && oldName !== newName) {
      changes.push(
        <div key="rename" className="flex items-center gap-2 text-xs">
          <span className="text-muted">Renommé :</span>
          <code className="bg-danger-bg text-danger-text px-1.5 py-0.5 rounded-lg line-through">
            {oldName}
          </code>
          <span className="text-subtle">→</span>
          <code className="bg-success-bg text-success-text px-1.5 py-0.5 rounded-lg">{newName}</code>
        </div>
      );
    }

    if (renamedProps.length > 0) {
      changes.push(
        <div key="renamed-block" className="mt-2 space-y-1.5">
          <p className="text-sm font-medium text-amber-700">Propriétés renommées :</p>
          {renamedProps.map((r) => (
            <div key={`${r.from}-${r.to}`} className="flex items-center gap-2 text-sm">
              <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded-lg text-xs border border-red-200">
                {r.from}
              </code>
              <span className="text-gray-400">→</span>
              <code className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded-lg text-xs border border-green-200">
                {r.to}
              </code>
            </div>
          ))}
          {onlyRenameNoVisual && (
            <p className="text-xs text-muted mt-1">
              Aucun changement visuel — seuls les noms de propriétés ont changé.
            </p>
          )}
        </div>
      );
    }

    const oldCount = oldVal?.variantCount as number | undefined;
    const newCount = newVal?.variantCount as number | undefined;
    if (oldCount != null && newCount != null && oldCount !== newCount) {
      const diff = newCount - oldCount;
      changes.push(
        <div key="count" className="text-xs text-muted">
          Variantes : {oldCount} → {newCount}
          <span className={`ml-1 font-medium ${diff > 0 ? 'text-success-text' : 'text-danger-text'}`}>
            ({diff > 0 ? '+' : ''}
            {diff})
          </span>
        </div>
      );
    }

    for (const prop of addedDetailed) {
      changes.push(
        <div key={`add-${prop.name}`} className="flex flex-wrap items-start gap-1.5">
          <span className="text-green-600 text-xs font-bold">+</span>
          <span className="text-xs font-medium text-green-700">{prop.name}</span>
          <div className="flex flex-wrap gap-1">
            {prop.options.map((opt) => (
              <span
                key={opt}
                className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"
              >
                {opt}
              </span>
            ))}
          </div>
        </div>
      );
    }

    for (const prop of removedDetailed) {
      changes.push(
        <div key={`rem-${prop.name}`} className="flex flex-wrap items-start gap-1.5">
          <span className="text-red-500 text-xs font-bold">−</span>
          <span className="text-xs font-medium text-red-700 line-through">{prop.name}</span>
          <div className="flex flex-wrap gap-1">
            {prop.options.map((opt) => (
              <span
                key={opt}
                className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 line-through"
              >
                {opt}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (addedVariants.length > 0) {
      const summary = summarizeVariants(addedVariants);
      changes.push(
        <div key="added-v" className="text-xs">
          <span className="text-success-text font-medium">+ {addedVariants.length} variantes ajoutées</span>
          {summary && <span className="text-muted ml-1">({summary})</span>}
        </div>
      );
    }

    if (removedVariants.length > 0) {
      const summary = summarizeVariants(removedVariants);
      changes.push(
        <div key="removed-v" className="text-xs">
          <span className="text-danger-text font-medium">− {removedVariants.length} variantes supprimées</span>
          {summary && <span className="text-muted ml-1">({summary})</span>}
        </div>
      );
    }

    if (changes.length === 0) return null;
    return <div className="mt-2 space-y-2">{changes}</div>;
  }

  if (item.change_type === 'removed') {
    return (
      <p className="mt-1.5 text-xs text-danger-text">
        Ce composant a été supprimé. Les développeurs doivent le retirer de leur code.
      </p>
    );
  }

  return null;
}

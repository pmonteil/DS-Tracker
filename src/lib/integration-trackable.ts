import type { DiffItem } from '@/lib/types';

export function isSubComponent(item: DiffItem): boolean {
  return item.item_name.startsWith('.') || item.is_internal;
}

function getParentName(item: DiffItem): string | null {
  return item.parent_component ?? null;
}

export type DiffItemCategoryKey =
  | 'breaking'
  | 'variable_mod'
  | 'component_new'
  | 'component_mod'
  | 'variable_new'
  | 'variable_removed'
  | 'effect_style'
  | 'page';

export const diffItemCategories: {
  key: DiffItemCategoryKey;
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

export interface DiffGroupedEntry {
  parent: DiffItem;
  children: DiffItem[];
}

export type DiffListEntry = DiffItem | DiffGroupedEntry;

export function isGrouped(e: DiffListEntry): e is DiffGroupedEntry {
  return 'parent' in e && 'children' in e;
}

export function buildGroups(items: DiffItem[]): DiffListEntry[] {
  const parents = items.filter((d) => !isSubComponent(d));
  const subs = [...items.filter((d) => isSubComponent(d))];
  const result: DiffListEntry[] = [];

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

/**
 * Nombre de blocs avec case d’intégration (même logique que DiffItemList).
 * Les sous-composants regroupés sous un parent ne comptent pas : une seule case par carte parent.
 */
export function countIntegratableDiffItems(items: DiffItem[]): number {
  const visible = items.filter((d) => !d.excluded);
  let n = 0;
  for (const cat of diffItemCategories) {
    const rawItems = visible.filter(cat.filter);
    if (rawItems.length === 0) continue;
    const grouped = buildGroups(rawItems);
    for (const entry of grouped) {
      if (isGrouped(entry)) {
        if (entry.parent.id) n += 1;
      } else {
        const item = entry as DiffItem;
        if (item.id) n += 1;
      }
    }
  }
  return n;
}

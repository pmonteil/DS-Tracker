import type { DiffItem } from './types';

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
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
    if (obj.hex) return String(obj.hex);
  }
  return null;
}

function displayValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '—';
  if (typeof raw === 'number') return `${raw}`;
  if (typeof raw === 'string') return raw.startsWith('#') ? `\`${raw}\`` : raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const hex = extractHex(raw);
    if (hex) return `\`${hex}\``;
    if (obj.valuesByMode && typeof obj.valuesByMode === 'object') {
      const modes = Object.values(obj.valuesByMode as Record<string, unknown>);
      if (modes.length === 1) return displayValue(modes[0]);
      return modes.map((v) => displayValue(v)).join(' / ');
    }
    return JSON.stringify(raw);
  }
  return String(raw);
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

function lh(raw: unknown): string {
  if (typeof raw === 'number') return `${raw}px`;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.value !== undefined) return `${obj.value}px`;
  }
  return String(raw ?? '—');
}

function formatBreaking(item: DiffItem): string {
  if (item.change_type === 'removed') {
    return `> ⚠️ **\`${item.item_name}\` supprimée** — ${item.description || `Ce ${item.category === 'component' ? 'composant' : item.category} a été supprimé.`}\n\n`;
  }
  const nv = item.new_value as Record<string, unknown> | null;
  const parts: string[] = [];
  const removedProps = (nv?.removedProps as string[]) ?? [];
  const removedVariants = (nv?.removedVariants as string[]) ?? [];
  if (removedProps.length > 0) parts.push(`Propriété${removedProps.length > 1 ? 's' : ''} \`${removedProps.join('`, `')}\` supprimée${removedProps.length > 1 ? 's' : ''}`);
  if (removedVariants.length > 0) parts.push(`${removedVariants.length} variantes supprimées`);
  const detail = parts.length > 0 ? parts.join('. ') : (item.description || 'Changement cassant');
  return `> ⚠️ **\`${item.item_name}\`** — ${detail}\n\n`;
}

function formatNewComponent(item: DiffItem): string {
  const nv = item.new_value as Record<string, unknown> | null;
  const properties = (nv?.properties as { name: string; options: string[] }[]) ?? [];
  const variantCount = (nv?.variantCount as number) ?? 0;

  let md = `### ${item.item_name} (nouveau)\n\n`;
  if (item.description?.trim()) {
    md += `${item.description.trim()}\n\n`;
  } else if (variantCount > 0) {
    md += `${variantCount} variantes disponibles :\n`;
    for (const prop of properties) {
      md += `- **${prop.name}** : ${prop.options?.join(', ') || '—'}\n`;
    }
    md += '\n';
  }
  if (item.screenshot_after) {
    md += `![${item.item_name}](${item.screenshot_after})\n\n`;
  }
  return md;
}

function formatModifiedComponent(item: DiffItem): string {
  const ov = item.old_value as Record<string, unknown> | null;
  const nv = item.new_value as Record<string, unknown> | null;

  let md = `### ${item.item_name}\n\n`;
  if (item.description?.trim()) {
    md += `${item.description.trim()}\n\n`;
    if (item.screenshot_before) md += `![${item.item_name} — Avant](${item.screenshot_before})\n`;
    if (item.screenshot_after) md += `![${item.item_name} — Après](${item.screenshot_after})\n`;
    if (item.screenshot_before || item.screenshot_after) md += '\n';
    return md;
  }

  const lines: string[] = [];

  const oldName = ov?.name as string | undefined;
  const newName = nv?.name as string | undefined;
  if (oldName && newName && oldName !== newName) {
    lines.push(`Renommé de \`${oldName}\` → \`${newName}\``);
  }

  const renamedProps = (nv?.renamedProps as { from: string; to: string }[]) ?? [];
  for (const r of renamedProps) {
    lines.push(`Propriété \`${r.from}\` renommée en \`${r.to}\` (breaking pour le code)`);
  }

  const removedProps = (nv?.removedProps as string[]) ?? [];
  for (const p of removedProps) {
    lines.push(`Propriété \`${p}\` supprimée`);
  }
  const addedProps = (nv?.addedProps as string[]) ?? [];
  for (const p of addedProps) {
    lines.push(`Propriété \`${p}\` ajoutée`);
  }

  const oldCount = ov?.variantCount as number | undefined;
  const newCount = nv?.variantCount as number | undefined;
  if (oldCount != null && newCount != null && oldCount !== newCount) {
    const diff = newCount - oldCount;
    lines.push(`Variantes : ${oldCount} → ${newCount} (${diff > 0 ? '+' : ''}${diff})`);
  }

  const addedVariants = (nv?.addedVariants as string[]) ?? [];
  if (addedVariants.length > 0) {
    const summary = summarizeVariants(addedVariants);
    lines.push(`${addedVariants.length} variantes ajoutées${summary ? ` (${summary})` : ''}`);
  }
  const removedVariants = (nv?.removedVariants as string[]) ?? [];
  if (removedVariants.length > 0) {
    const summary = summarizeVariants(removedVariants);
    lines.push(`${removedVariants.length} variantes supprimées${summary ? ` (${summary})` : ''}`);
  }

  for (const l of lines) md += `- ${l}\n`;
  md += '\n';

  if (item.screenshot_before) md += `![${item.item_name} — Avant](${item.screenshot_before})\n`;
  if (item.screenshot_after) md += `![${item.item_name} — Après](${item.screenshot_after})\n`;
  if (item.screenshot_before || item.screenshot_after) md += '\n';
  return md;
}

function formatTextStyleModified(item: DiffItem): string {
  if (item.description?.trim()) {
    return `- **${item.item_name}** : ${item.description.trim()}\n`;
  }
  const ov = item.old_value as Record<string, unknown> | null;
  const nv = item.new_value as Record<string, unknown> | null;
  const parts: string[] = [];
  if (ov?.fontSize !== nv?.fontSize) parts.push(`taille ${ov?.fontSize}px → ${nv?.fontSize}px`);
  if (ov?.fontStyle !== nv?.fontStyle) parts.push(`weight ${ov?.fontStyle} → ${nv?.fontStyle}`);
  if (JSON.stringify(ov?.lineHeight) !== JSON.stringify(nv?.lineHeight)) {
    parts.push(`line-height ${lh(ov?.lineHeight)} → ${lh(nv?.lineHeight)}`);
  }
  const detail = parts.length > 0 ? parts.join(', ') : 'modification';
  return `- **${item.item_name}** : ${detail}\n`;
}

function formatTextStyleAdded(item: DiffItem): string {
  const nv = item.new_value as Record<string, unknown> | null;
  const info = [nv?.fontFamily, nv?.fontStyle, nv?.fontSize ? `${nv.fontSize}px` : null, nv?.lineHeight ? lh(nv.lineHeight) : null]
    .filter(Boolean).join(' ');
  return `- **${item.item_name}** (nouveau) — ${info}\n`;
}

function formatVariable(item: DiffItem): string {
  if (item.description?.trim()) {
    return `- \`${item.item_name}\` : ${item.description.trim()}\n`;
  }
  if (item.change_type === 'added') {
    return `- \`${item.item_name}\` (nouveau) — ${displayValue(item.new_value)}\n`;
  }
  if (item.change_type === 'modified') {
    return `- \`${item.item_name}\` : ${displayValue(item.old_value)} → ${displayValue(item.new_value)}\n`;
  }
  return `- \`${item.item_name}\` (supprimée)\n`;
}

export function formatPatchnoteFromDiff(diffItems: DiffItem[]): string {
  const items = diffItems.filter((d) => !d.excluded);
  let md = '';

  const breakingItems = items.filter((d) => d.is_breaking);
  if (breakingItems.length > 0) {
    md += '## Breaking changes ⚠️\n\n';
    for (const item of breakingItems) md += formatBreaking(item);
  }

  const varMods = items.filter(
    (d) => d.category === 'variable' && d.change_type === 'modified' && !d.is_breaking
  );
  if (varMods.length > 0) {
    md += '## Variables modifiées\n\n';
    const byCollection = groupBy(varMods, (d) => d.family_page || 'Autre');
    for (const [collection, group] of Object.entries(byCollection)) {
      md += `### ${collection}\n\n`;
      for (const item of group) md += formatVariable(item);
      md += '\n';
    }
  }

  const newComps = items.filter(
    (d) => d.category === 'component' && d.change_type === 'added' && !d.is_internal && !d.is_breaking
  );
  if (newComps.length > 0) {
    md += '## Nouveaux composants\n\n';
    for (const item of newComps) md += formatNewComponent(item);
  }

  const newCompsInternal = items.filter(
    (d) => d.category === 'component' && d.change_type === 'added' && d.is_internal && !d.is_breaking
  );
  if (newCompsInternal.length > 0) {
    md += '### Sous-composants internes ajoutés\n\n';
    for (const item of newCompsInternal) md += formatNewComponent(item);
  }

  const modComps = items.filter(
    (d) => d.category === 'component' && d.change_type === 'modified' && !d.is_breaking
  );
  if (modComps.length > 0) {
    md += '## Composants modifiés\n\n';
    const byFamily = groupBy(modComps, (d) => d.family_page || 'Autre');
    for (const [family, group] of Object.entries(byFamily)) {
      if (Object.keys(byFamily).length > 1) md += `#### ${family}\n\n`;
      for (const item of group) md += formatModifiedComponent(item);
    }
  }

  const removedComps = items.filter(
    (d) => d.category === 'component' && d.change_type === 'removed' && !d.is_breaking
  );
  if (removedComps.length > 0) {
    md += '## Composants supprimés\n\n';
    for (const item of removedComps) {
      md += `- ~~${item.item_name}~~\n`;
    }
    md += '\n';
  }

  const newVars = items.filter(
    (d) => d.category === 'variable' && d.change_type === 'added' && !d.is_breaking
  );
  if (newVars.length > 0) {
    md += '## Nouvelles variables\n\n';
    const byCollection = groupBy(newVars, (d) => d.family_page || 'Autre');
    for (const [collection, group] of Object.entries(byCollection)) {
      md += `### ${collection}\n\n`;
      for (const item of group) md += formatVariable(item);
      md += '\n';
    }
  }

  const removedVars = items.filter(
    (d) => d.category === 'variable' && d.change_type === 'removed' && !d.is_breaking
  );
  if (removedVars.length > 0) {
    md += '## Variables supprimées\n\n';
    for (const item of removedVars) md += formatVariable(item);
    md += '\n';
  }

  const effectItems = items.filter(
    (d) => d.category === 'effect_style' && !d.is_breaking
  );
  if (effectItems.length > 0) {
    md += '## Styles d\'effets\n\n';
    for (const item of effectItems) {
      if (item.change_type === 'added') {
        md += `- \`${item.item_name}\` (nouveau) — ${item.description || 'Nouveau style d\'effet'}\n`;
      } else if (item.change_type === 'modified') {
        md += `- \`${item.item_name}\` modifié — ${item.description || 'Style d\'effet modifié'}\n`;
      } else {
        md += `- ~~\`${item.item_name}\`~~ supprimé\n`;
      }
    }
    md += '\n';
  }

  const pageChanges = items.filter((d) => d.category === 'page');
  if (pageChanges.length > 0) {
    md += '## Structure du fichier\n\n';
    for (const item of pageChanges) {
      const icon = item.change_type === 'added' ? '+' : item.change_type === 'removed' ? '−' : '~';
      md += `- ${icon} Page « ${item.item_name} »\n`;
    }
    md += '\n';
  }

  return md.trim();
}

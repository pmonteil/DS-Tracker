import type { DiffItem, Version, CustomBlock } from './types';

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

function formatValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '(vide)';
  if (typeof raw === 'number') return `${raw}`;
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.r !== undefined && obj.g !== undefined && obj.b !== undefined) {
      const r = Math.round((obj.r as number) * 255).toString(16).padStart(2, '0');
      const g = Math.round((obj.g as number) * 255).toString(16).padStart(2, '0');
      const b = Math.round((obj.b as number) * 255).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`.toUpperCase();
    }
    if (obj.valuesByMode && typeof obj.valuesByMode === 'object') {
      const modes = obj.valuesByMode as Record<string, unknown>;
      const entries = Object.entries(modes);
      if (entries.length === 1) return formatValue(entries[0][1]);
      return entries.map(([mode, val]) => `mode "${mode}": ${formatValue(val)}`).join(', ');
    }
    return JSON.stringify(raw);
  }
  return String(raw);
}

function formatModeValues(data: Record<string, unknown> | null, label: string): string {
  if (!data) return '';
  const vbm = data.valuesByMode as Record<string, unknown> | undefined;
  if (!vbm) return '';
  const modeNames = (data.modeNames as Record<string, string>) || {};
  const entries = Object.entries(vbm);
  if (entries.length === 0) return '';
  if (entries.length === 1) {
    const modeName = modeNames[entries[0][0]];
    const modeLabel = modeName ? ` (${modeName})` : '';
    return `${label}${modeLabel}: \`${formatValue(entries[0][1])}\``;
  }
  return `${label}:\n` + entries.map(([modeId, val]) => {
    const name = modeNames[modeId] || modeId;
    return `  - **${name}** : \`${formatValue(val)}\``;
  }).join('\n');
}

function formatComponentDetails(item: DiffItem): string {
  const lines: string[] = [];
  const nv = item.new_value as Record<string, unknown> | null;
  const ov = item.old_value as Record<string, unknown> | null;

  if (item.change_type === 'added') {
    const variantCount = (nv?.variantCount as number) ?? 0;
    const variants = (nv?.variants as string[]) ?? [];
    const properties = (nv?.properties as { name: string; options: string[] }[]) ?? [];

    if (variantCount > 0) lines.push(`- Nombre de variantes : ${variantCount}`);
    if (properties.length > 0) {
      lines.push('- Propriétés de variante :');
      for (const prop of properties) {
        lines.push(`  - **${prop.name}** : ${prop.options?.join(', ') || '(aucune option)'}`);
      }
    }
    if (variants.length > 0 && variants.length <= 30) {
      lines.push('- Liste complète des variantes :');
      for (const v of variants) lines.push(`  - \`${v}\``);
    }
  }

  if (item.change_type === 'modified') {
    const oldName = ov?.name as string | undefined;
    const newName = nv?.name as string | undefined;
    if (oldName && newName && oldName !== newName) {
      lines.push(`- **Renommage** : \`${oldName}\` → \`${newName}\``);
    }

    const visualOnly = nv?.visualOnly as boolean | undefined;
    if (visualOnly) {
      lines.push('- **Type de changement** : Modification visuelle uniquement (couleurs, opacité, effets, styles). La structure des variantes et propriétés n\'a pas changé.');
    }

    const renamedProps = (nv?.renamedProps as { from: string; to: string }[]) ?? [];
    if (renamedProps.length > 0) {
      lines.push('- **Propriétés renommées** (BREAKING — les noms dans le code doivent être mis à jour) :');
      for (const r of renamedProps) lines.push(`  - \`${r.from}\` → \`${r.to}\``);
    }

    const removedPropsDetailed = (nv?.removedPropsDetailed as { name: string; options: string[] }[]) ?? [];
    if (removedPropsDetailed.length > 0) {
      lines.push('- **Propriétés supprimées** (BREAKING — ces propriétés n\'existent plus) :');
      for (const p of removedPropsDetailed) {
        lines.push(`  - \`${p.name}\` (avait les options : ${p.options.join(', ')})`);
      }
    }

    const addedPropsDetailed = (nv?.addedPropsDetailed as { name: string; options: string[] }[]) ?? [];
    if (addedPropsDetailed.length > 0) {
      lines.push('- **Nouvelles propriétés** :');
      for (const p of addedPropsDetailed) {
        lines.push(`  - \`${p.name}\` avec options : ${p.options.join(', ')}`);
      }
    }

    const oldCount = ov?.variantCount as number | undefined;
    const newCount = nv?.variantCount as number | undefined;
    if (oldCount != null && newCount != null && oldCount !== newCount) {
      const diff = newCount - oldCount;
      lines.push(`- Nombre de variantes : ${oldCount} → ${newCount} (${diff > 0 ? '+' : ''}${diff})`);
    }

    const addedVariants = (nv?.addedVariants as string[]) ?? [];
    if (addedVariants.length > 0) {
      lines.push(`- **Variantes ajoutées** (${addedVariants.length}) :`);
      for (const v of addedVariants) lines.push(`  - \`${v}\``);
    }

    const removedVariants = (nv?.removedVariants as string[]) ?? [];
    if (removedVariants.length > 0) {
      lines.push(`- **Variantes supprimées** (${removedVariants.length}) — BREAKING :`);
      for (const v of removedVariants) lines.push(`  - ~~\`${v}\`~~`);
    }

    const oldProps = (ov?.properties as { name: string; options: string[] }[]) ?? [];
    const newProps = (nv?.properties as { name: string; options: string[] }[]) ?? [];
    if (newProps.length > 0) {
      lines.push('- État actuel des propriétés de variante :');
      for (const prop of newProps) {
        const oldProp = oldProps.find((p) => p.name === prop.name);
        const addedOpts = prop.options.filter((o) => !oldProp?.options.includes(o));
        const removedOpts = oldProp?.options.filter((o) => !prop.options.includes(o)) ?? [];
        let detail = `  - **${prop.name}** : ${prop.options.join(', ')}`;
        if (addedOpts.length > 0) detail += ` *(nouvelles : ${addedOpts.join(', ')})*`;
        if (removedOpts.length > 0) detail += ` *(supprimées : ${removedOpts.join(', ')})*`;
        lines.push(detail);
      }
    }
  }

  if (item.change_type === 'removed') {
    const variantCount = (ov?.variantCount as number) ?? 0;
    const properties = (ov?.properties as { name: string; options: string[] }[]) ?? [];
    lines.push(`- **SUPPRIMÉ** — Ce composant n'existe plus dans le design system.`);
    if (variantCount > 0) lines.push(`- Avait ${variantCount} variantes`);
    if (properties.length > 0) {
      lines.push('- Avait les propriétés :');
      for (const prop of properties) {
        lines.push(`  - \`${prop.name}\` : ${prop.options?.join(', ')}`);
      }
    }
    lines.push('- **Action requise** : Retirer toute utilisation de ce composant du code.');
  }

  return lines.join('\n');
}

function formatVariableDetails(item: DiffItem): string {
  const lines: string[] = [];
  const ov = item.old_value as Record<string, unknown> | null;
  const nv = item.new_value as Record<string, unknown> | null;

  const collection = (nv?.collection || ov?.collection) as string | undefined;
  if (collection) lines.push(`- Collection : \`${collection}\``);

  const resolvedType = (nv?.resolvedType || ov?.resolvedType) as string | undefined;
  if (resolvedType) lines.push(`- Type : ${resolvedType}`);

  if (item.change_type === 'added') {
    const valStr = formatModeValues(nv, 'Valeur');
    if (valStr) lines.push(`- ${valStr}`);
  }

  if (item.change_type === 'modified') {
    const modeNames = (nv?.modeNames || ov?.modeNames) as Record<string, string> | undefined;
    const oldModes = (ov?.valuesByMode as Record<string, unknown>) || {};
    const newModes = (nv?.valuesByMode as Record<string, unknown>) || {};
    const allKeys = new Set([...Object.keys(oldModes), ...Object.keys(newModes)]);

    if (allKeys.size <= 1) {
      const oldStr = formatModeValues(ov, 'Ancienne valeur');
      const newStr = formatModeValues(nv, 'Nouvelle valeur');
      if (oldStr) lines.push(`- ${oldStr}`);
      if (newStr) lines.push(`- ${newStr}`);
    } else {
      lines.push('- Changements par mode :');
      for (const modeKey of allKeys) {
        const oldVal = oldModes[modeKey];
        const newVal = newModes[modeKey];
        const modeName = modeNames?.[modeKey] || modeKey;
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          lines.push(`  - **${modeName}** : \`${formatValue(oldVal)}\` → \`${formatValue(newVal)}\``);
        }
      }
    }
  }

  if (item.change_type === 'removed') {
    lines.push('- **SUPPRIMEE** — Cette variable n\'existe plus dans le design system.');
    const valStr = formatModeValues(ov, 'Dernière valeur connue');
    if (valStr) lines.push(`- ${valStr}`);
    lines.push('- **Action requise** : Retirer toute référence à cette variable.');
  }

  return lines.join('\n');
}

function formatEffectDetails(item: DiffItem): string {
  const lines: string[] = [];
  const nv = item.new_value as Record<string, unknown> | null;
  const ov = item.old_value as Record<string, unknown> | null;
  const data = nv || ov;
  const effects = (data?.effects as { type: string; color: string | null; offset: { x: number; y: number }; radius: number; spread: number }[]) ?? [];

  if (effects.length > 0) {
    lines.push('- Effets :');
    for (const e of effects) {
      lines.push(`  - Type : ${e.type}, Couleur : ${e.color || 'n/a'}, Offset : (${e.offset.x}, ${e.offset.y}), Rayon : ${e.radius}, Spread : ${e.spread}`);
    }
  }

  return lines.join('\n');
}

function formatCustomBlocks(blocks: CustomBlock[], sectionTitle: string): string {
  const validBlocks = blocks.filter((b) => b.title || b.text || b.images.length > 0);
  if (validBlocks.length === 0) return '';

  let md = `## ${sectionTitle}\n\n`;
  for (const block of validBlocks) {
    if (block.title) md += `### ${block.title}\n\n`;
    if (block.text) md += `${block.text}\n\n`;
    if (block.images.length > 0) {
      for (const url of block.images) {
        md += `![${block.title || sectionTitle}](${url})\n\n`;
      }
    }
  }
  return md;
}

export function generateDownloadMarkdown(version: Version, diffItems: DiffItem[]): string {
  const items = diffItems.filter((d) => !d.excluded);
  const lines: string[] = [];

  lines.push(`# ${version.version_number} — ${version.title}`);
  lines.push('');
  if (version.published_at) {
    lines.push(`> Publié le ${new Date(version.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('> Ce document est destiné à être lu par une IA pour mettre à jour automatiquement les applications utilisant ce design system. Chaque section détaille précisément les changements à appliquer.');
  lines.push('');

  if (version.summary) {
    lines.push('## Résumé');
    lines.push('');
    lines.push(version.summary);
    lines.push('');
  }

  // Variable screenshots (legacy)
  const hasVarScreenshots = Array.isArray(version.variable_screenshots) && version.variable_screenshots.length > 0;
  const hasVarBlocks = Array.isArray(version.variable_blocks) && version.variable_blocks.some((b: CustomBlock) => b.title || b.text || b.images.length > 0);

  if (hasVarScreenshots || hasVarBlocks) {
    lines.push('## Section Variables (captures et annotations)');
    lines.push('');
    lines.push('> Les captures ci-dessous montrent les changements dans les collections de variables Figma. Les annotations décrivent les modifications à appliquer.');
    lines.push('');
    if (hasVarScreenshots) {
      for (const url of version.variable_screenshots) {
        lines.push(`![Capture variables](${url})`);
        lines.push('');
      }
    }
    if (hasVarBlocks) {
      for (const block of version.variable_blocks) {
        if (!block.title && !block.text && block.images.length === 0) continue;
        if (block.title) lines.push(`### ${block.title}`);
        if (block.text) {
          lines.push('');
          lines.push(block.text);
        }
        for (const url of block.images) {
          lines.push('');
          lines.push(`![${block.title || 'Variables'}](${url})`);
        }
        lines.push('');
      }
    }
  }

  // Breaking changes
  const breakingItems = items.filter((d) => d.is_breaking);
  if (breakingItems.length > 0) {
    lines.push('## ⚠️ Breaking Changes (ATTENTION — Changements non rétro-compatibles)');
    lines.push('');
    lines.push('> Ces changements nécessitent une mise à jour du code. Toute référence aux éléments ci-dessous doit être modifiée ou supprimée.');
    lines.push('');

    for (const item of breakingItems) {
      lines.push(`### ${item.is_internal ? '(interne) ' : ''}${item.item_name} — ${item.change_type === 'removed' ? 'SUPPRIMÉ' : 'MODIFIÉ (breaking)'}`);
      lines.push('');
      if (item.description) {
        lines.push(item.description);
        lines.push('');
      }
      if (item.category === 'component') {
        const details = formatComponentDetails(item);
        if (details) { lines.push(details); lines.push(''); }
      } else if (item.category === 'variable') {
        const details = formatVariableDetails(item);
        if (details) { lines.push(details); lines.push(''); }
      }
      if (item.screenshot_before) lines.push(`![${item.item_name} — Avant](${item.screenshot_before})`);
      if (item.screenshot_after) lines.push(`![${item.item_name} — Après](${item.screenshot_after})`);
      if (item.screenshot_before || item.screenshot_after) lines.push('');
    }
  }

  // Variables modifiées
  const varMods = items.filter((d) => d.category === 'variable' && d.change_type === 'modified' && !d.is_breaking);
  if (varMods.length > 0) {
    lines.push('## Variables modifiées');
    lines.push('');
    lines.push(`> ${varMods.length} variable(s) modifiée(s). Mettre à jour les valeurs correspondantes dans le code.`);
    lines.push('');
    const byCollection = groupBy(varMods, (d) => d.family_page || 'Autre');
    for (const [collection, group] of Object.entries(byCollection)) {
      lines.push(`### Collection : ${collection}`);
      lines.push('');
      for (const item of group) {
        lines.push(`#### \`${item.item_name}\``);
        lines.push('');
        if (item.description) { lines.push(item.description); lines.push(''); }
        const details = formatVariableDetails(item);
        if (details) { lines.push(details); lines.push(''); }
      }
    }
  }

  // Nouveaux composants
  const newComps = items.filter((d) => d.category === 'component' && d.change_type === 'added' && !d.is_breaking);
  if (newComps.length > 0) {
    lines.push('## Nouveaux composants');
    lines.push('');
    lines.push(`> ${newComps.length} nouveau(x) composant(s) ajouté(s) au design system.`);
    lines.push('');
    for (const item of newComps) {
      lines.push(`### ${item.is_internal ? '(sous-composant interne) ' : ''}${item.item_name}`);
      lines.push('');
      if (item.parent_component) lines.push(`- Composant parent : \`${item.parent_component}\``);
      if (item.family_page) lines.push(`- Page Figma : ${item.family_page}`);
      if (item.description) { lines.push(''); lines.push(item.description); lines.push(''); }
      const details = formatComponentDetails(item);
      if (details) { lines.push(details); lines.push(''); }
      if (item.screenshot_after) { lines.push(`![${item.item_name}](${item.screenshot_after})`); lines.push(''); }
    }
  }

  // Composants modifiés
  const modComps = items.filter((d) => d.category === 'component' && d.change_type === 'modified' && !d.is_breaking);
  if (modComps.length > 0) {
    lines.push('## Composants modifiés');
    lines.push('');
    lines.push(`> ${modComps.length} composant(s) modifié(s). Vérifier et mettre à jour les implémentations.`);
    lines.push('');
    const byFamily = groupBy(modComps, (d) => d.family_page || 'Autre');
    for (const [family, group] of Object.entries(byFamily)) {
      lines.push(`### Page : ${family}`);
      lines.push('');
      for (const item of group) {
        lines.push(`#### ${item.is_internal ? '(interne) ' : ''}\`${item.item_name}\``);
        lines.push('');
        if (item.parent_component) lines.push(`- Composant parent : \`${item.parent_component}\``);
        if (item.description) { lines.push(item.description); lines.push(''); }
        const details = formatComponentDetails(item);
        if (details) { lines.push(details); lines.push(''); }
        if (item.screenshot_before) lines.push(`![${item.item_name} — Avant](${item.screenshot_before})`);
        if (item.screenshot_after) lines.push(`![${item.item_name} — Après](${item.screenshot_after})`);
        if (item.screenshot_before || item.screenshot_after) lines.push('');
      }
    }
  }

  // Composants supprimés (non-breaking)
  const removedComps = items.filter((d) => d.category === 'component' && d.change_type === 'removed' && !d.is_breaking);
  if (removedComps.length > 0) {
    lines.push('## Composants supprimés');
    lines.push('');
    for (const item of removedComps) {
      lines.push(`### ~~${item.item_name}~~`);
      lines.push('');
      const details = formatComponentDetails(item);
      if (details) { lines.push(details); lines.push(''); }
    }
  }

  // Nouvelles variables
  const newVars = items.filter((d) => d.category === 'variable' && d.change_type === 'added' && !d.is_breaking);
  if (newVars.length > 0) {
    lines.push('## Nouvelles variables');
    lines.push('');
    lines.push(`> ${newVars.length} nouvelle(s) variable(s) ajoutée(s).`);
    lines.push('');
    const byCollection = groupBy(newVars, (d) => d.family_page || 'Autre');
    for (const [collection, group] of Object.entries(byCollection)) {
      lines.push(`### Collection : ${collection}`);
      lines.push('');
      for (const item of group) {
        lines.push(`#### \`${item.item_name}\``);
        lines.push('');
        if (item.description) { lines.push(item.description); lines.push(''); }
        const details = formatVariableDetails(item);
        if (details) { lines.push(details); lines.push(''); }
      }
    }
  }

  // Variables supprimées
  const removedVars = items.filter((d) => d.category === 'variable' && d.change_type === 'removed' && !d.is_breaking);
  if (removedVars.length > 0) {
    lines.push('## Variables supprimées');
    lines.push('');
    for (const item of removedVars) {
      lines.push(`#### ~~\`${item.item_name}\`~~`);
      lines.push('');
      const details = formatVariableDetails(item);
      if (details) { lines.push(details); lines.push(''); }
    }
  }

  // Styles d'effet
  const effectItems = items.filter((d) => d.category === 'effect_style' && !d.is_breaking);
  if (effectItems.length > 0) {
    lines.push('## Styles d\'effets');
    lines.push('');
    for (const item of effectItems) {
      const label = item.change_type === 'added' ? '(nouveau)' : item.change_type === 'modified' ? '(modifié)' : '(supprimé)';
      lines.push(`### \`${item.item_name}\` ${label}`);
      lines.push('');
      if (item.description) { lines.push(item.description); lines.push(''); }
      const details = formatEffectDetails(item);
      if (details) { lines.push(details); lines.push(''); }
    }
  }

  // Pages
  const pageChanges = items.filter((d) => d.category === 'page');
  if (pageChanges.length > 0) {
    lines.push('## Structure du fichier Figma');
    lines.push('');
    for (const item of pageChanges) {
      const icon = item.change_type === 'added' ? '+ (nouvelle)' : item.change_type === 'removed' ? '- (supprimée)' : '~ (modifiée)';
      lines.push(`- Page « ${item.item_name} » ${icon}`);
    }
    lines.push('');
  }

  // Custom blocks
  const validCustomBlocks = (version.custom_blocks ?? []).filter((b: CustomBlock) => b.title || b.text || b.images.length > 0);
  if (validCustomBlocks.length > 0) {
    lines.push(formatCustomBlocks(validCustomBlocks, 'Informations complémentaires'));
  }

  lines.push('---');
  lines.push(`*Généré depuis DS Tracker — ${version.version_number}*`);
  lines.push('');

  return lines.join('\n');
}

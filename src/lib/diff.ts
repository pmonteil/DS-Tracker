import type {
  FigmaSnapshot,
  DiffItem,
  ComponentSetSnapshot,
  StandaloneComponentSnapshot,
  VariableSnapshot,
  EffectStyleSnapshot,
  PageSnapshot,
} from './types';
import { rgbaToHex } from './figma';

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Ignore l'ordre des paires clé=valeur dans le nom d'une variante Figma */
function normalizeVariantKey(v: string): string {
  return v
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
}

function optionsSortedEqual(a: string[], b: string[]): boolean {
  return deepEqual([...a].sort((x, y) => x.localeCompare(y)), [...b].sort((x, y) => x.localeCompare(y)));
}

function sortPropertiesForCompare(
  props: { name: string; options: string[] }[]
): { name: string; options: string[] }[] {
  return [...props]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ name: p.name, options: [...p.options].sort((x, y) => x.localeCompare(y)) }));
}

function propertiesStructurallyEqual(
  a: { name: string; options: string[] }[],
  b: { name: string; options: string[] }[]
): boolean {
  return deepEqual(sortPropertiesForCompare(a), sortPropertiesForCompare(b));
}

function detectVariantDiff(
  branchVariants: string[],
  mainVariants: string[]
): { added: string[]; removed: string[] } {
  const mainNorm = new Map<string, string>();
  for (const v of mainVariants) {
    mainNorm.set(normalizeVariantKey(v), v);
  }
  const branchNorm = new Map<string, string>();
  for (const v of branchVariants) {
    branchNorm.set(normalizeVariantKey(v), v);
  }
  const mainKeys = new Set(mainNorm.keys());
  const branchKeys = new Set(branchNorm.keys());
  const added: string[] = [];
  for (const k of branchKeys) {
    if (!mainKeys.has(k)) added.push(branchNorm.get(k)!);
  }
  const removed: string[] = [];
  for (const k of mainKeys) {
    if (!branchKeys.has(k)) removed.push(mainNorm.get(k)!);
  }
  return { added, removed };
}

function detectPropertyRenames(
  removedProps: { name: string; options: string[] }[],
  addedProps: { name: string; options: string[] }[]
): {
  renamed: { from: string; to: string }[];
  removedFinal: { name: string; options: string[] }[];
  addedFinal: { name: string; options: string[] }[];
} {
  const usedR = new Set<number>();
  const usedA = new Set<number>();
  const renamed: { from: string; to: string }[] = [];

  for (let i = 0; i < removedProps.length; i++) {
    if (usedR.has(i)) continue;
    const rp = removedProps[i];
    for (let j = 0; j < addedProps.length; j++) {
      if (usedA.has(j)) continue;
      const ap = addedProps[j];
      if (optionsSortedEqual(rp.options, ap.options)) {
        renamed.push({ from: rp.name, to: ap.name });
        usedR.add(i);
        usedA.add(j);
        break;
      }
    }
  }

  return {
    renamed,
    removedFinal: removedProps.filter((_, i) => !usedR.has(i)),
    addedFinal: addedProps.filter((_, j) => !usedA.has(j)),
  };
}

function formatColorValue(val: unknown): string {
  if (
    val &&
    typeof val === 'object' &&
    'r' in (val as Record<string, unknown>) &&
    'g' in (val as Record<string, unknown>) &&
    'b' in (val as Record<string, unknown>)
  ) {
    return rgbaToHex(val as { r: number; g: number; b: number; a?: number });
  }
  return String(val);
}

function diffComponentSets(
  branchSets: ComponentSetSnapshot[],
  mainSets: ComponentSetSnapshot[]
): DiffItem[] {
  const items: DiffItem[] = [];
  const mainById = new Map(mainSets.map((s) => [s.id, s]));
  const mainByName = new Map(mainSets.map((s) => [s.name, s]));
  const matchedMainIds = new Set<string>();

  for (const branchSet of branchSets) {
    let mainSet = mainById.get(branchSet.id);
    if (mainSet) matchedMainIds.add(mainSet.id);

    if (!mainSet) {
      mainSet = mainByName.get(branchSet.name);
      if (mainSet) matchedMainIds.add(mainSet.id);
    }

    if (!mainSet) {
      items.push({
        category: 'component',
        change_type: 'added',
        item_name: branchSet.name,
        item_id: branchSet.id,
        old_value: null,
        new_value: {
          variantCount: branchSet.variantCount,
          variants: branchSet.variants,
          properties: branchSet.properties,
        },
        is_breaking: false,
        is_internal: branchSet.isInternal,
        parent_component: null,
        family_page: branchSet.pageName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
      continue;
    }

    const { added: addedVariants, removed: removedVariants } = detectVariantDiff(
      branchSet.variants,
      mainSet.variants
    );

    const mainPropNames = new Set(mainSet.properties.map((p) => p.name));
    const branchPropNames = new Set(branchSet.properties.map((p) => p.name));
    const addedPropsRaw = branchSet.properties.filter((p) => !mainPropNames.has(p.name));
    const removedPropsRaw = mainSet.properties.filter((p) => !branchPropNames.has(p.name));

    const { renamed: renamedProps, removedFinal, addedFinal } = detectPropertyRenames(
      removedPropsRaw,
      addedPropsRaw
    );

    let hasOptionChange = false;
    for (const bp of branchSet.properties) {
      const mp = mainSet.properties.find((p) => p.name === bp.name);
      if (mp && !optionsSortedEqual(mp.options, bp.options)) {
        hasOptionChange = true;
        break;
      }
    }

    const propsStructurallyEqual = propertiesStructurallyEqual(
      branchSet.properties,
      mainSet.properties
    );

    const structuralChange =
      mainSet.name !== branchSet.name ||
      addedVariants.length > 0 ||
      removedVariants.length > 0 ||
      addedFinal.length > 0 ||
      removedFinal.length > 0 ||
      renamedProps.length > 0 ||
      !propsStructurallyEqual;

    if (!structuralChange) {
      continue;
    }

    items.push({
      category: 'component',
      change_type: 'modified',
      item_name: branchSet.name,
      item_id: branchSet.id,
      old_value: {
        name: mainSet.name,
        variantCount: mainSet.variantCount,
        variants: mainSet.variants,
        properties: mainSet.properties,
      },
      new_value: {
        name: branchSet.name,
        variantCount: branchSet.variantCount,
        variants: branchSet.variants,
        properties: branchSet.properties,
        addedVariants,
        removedVariants,
        renamedProps,
        addedProps: addedFinal.map((p) => p.name),
        removedProps: removedFinal.map((p) => p.name),
        addedPropsDetailed: addedFinal,
        removedPropsDetailed: removedFinal,
      },
      is_breaking:
        removedVariants.length > 0 ||
        removedFinal.length > 0 ||
        renamedProps.length > 0,
      is_internal: branchSet.isInternal,
      parent_component: null,
      family_page: branchSet.pageName,
      description: null,
      screenshot_before: null,
      screenshot_after: null,
      sort_order: 0,
    });
  }

  for (const mainSet of mainSets) {
    if (!matchedMainIds.has(mainSet.id)) {
      items.push({
        category: 'component',
        change_type: 'removed',
        item_name: mainSet.name,
        item_id: mainSet.id,
        old_value: {
          variantCount: mainSet.variantCount,
          variants: mainSet.variants,
          properties: mainSet.properties,
        },
        new_value: null,
        is_breaking: true,
        is_internal: mainSet.isInternal,
        parent_component: null,
        family_page: mainSet.pageName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  return items;
}

function diffStandaloneComponents(
  branchComps: StandaloneComponentSnapshot[],
  mainComps: StandaloneComponentSnapshot[]
): DiffItem[] {
  const items: DiffItem[] = [];
  const mainById = new Map(mainComps.map((c) => [c.id, c]));
  const mainByName = new Map(mainComps.map((c) => [c.name, c]));
  const matchedMainIds = new Set<string>();

  for (const bc of branchComps) {
    let mc = mainById.get(bc.id);
    if (mc) matchedMainIds.add(mc.id);

    if (!mc) {
      mc = mainByName.get(bc.name);
      if (mc) matchedMainIds.add(mc.id);
    }

    if (!mc) {
      items.push({
        category: 'component',
        change_type: 'added',
        item_name: bc.name,
        item_id: bc.id,
        old_value: null,
        new_value: { width: bc.width, height: bc.height },
        is_breaking: false,
        is_internal: bc.isInternal,
        parent_component: null,
        family_page: bc.pageName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
      continue;
    }

    const changes: string[] = [];
    if (mc.name !== bc.name) {
      changes.push(`Renommé de "${mc.name}" → "${bc.name}"`);
    }

    /* Position / taille du cadre sur le canvas ignorés (faux positifs) — V1.3 */

    if (changes.length > 0) {
      items.push({
        category: 'component',
        change_type: 'modified',
        item_name: bc.name,
        item_id: bc.id,
        old_value: { name: mc.name, width: mc.width, height: mc.height },
        new_value: { name: bc.name, width: bc.width, height: bc.height },
        is_breaking: false,
        is_internal: bc.isInternal,
        parent_component: null,
        family_page: bc.pageName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  for (const mc of mainComps) {
    if (!matchedMainIds.has(mc.id)) {
      items.push({
        category: 'component',
        change_type: 'removed',
        item_name: mc.name,
        item_id: mc.id,
        old_value: { width: mc.width, height: mc.height },
        new_value: null,
        is_breaking: true,
        is_internal: mc.isInternal,
        parent_component: null,
        family_page: mc.pageName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  return items;
}

function getVariableKey(v: VariableSnapshot): string {
  return `${v.collectionName}/${v.name}`;
}

function variableValuesChanged(
  mainModes: Record<string, unknown>,
  branchModes: Record<string, unknown>
): boolean {
  const mainVals = Object.values(mainModes);
  const branchVals = Object.values(branchModes);

  if (mainVals.length !== branchVals.length) return true;

  for (let i = 0; i < mainVals.length; i++) {
    if (JSON.stringify(mainVals[i]) !== JSON.stringify(branchVals[i])) return true;
  }

  return false;
}

function diffVariables(
  branchVars: VariableSnapshot[],
  mainVars: VariableSnapshot[]
): DiffItem[] {
  const items: DiffItem[] = [];
  const mainByKey = new Map(mainVars.map((v) => [getVariableKey(v), v]));
  const branchByKey = new Map(branchVars.map((v) => [getVariableKey(v), v]));

  console.log(`[diff] Variables: branch=${branchVars.length}, main=${mainVars.length}`);
  const collectionsBranch = new Set(branchVars.map((v) => v.collectionName));
  const collectionsMain = new Set(mainVars.map((v) => v.collectionName));
  console.log(`[diff] Collections branch: ${[...collectionsBranch].join(', ')}`);
  console.log(`[diff] Collections main: ${[...collectionsMain].join(', ')}`);

  for (const [key, bv] of branchByKey) {
    const mv = mainByKey.get(key);

    if (!mv) {
      items.push({
        category: 'variable',
        change_type: 'added',
        item_name: bv.name,
        item_id: bv.id,
        old_value: null,
        new_value: {
          collection: bv.collectionName,
          resolvedType: bv.resolvedType,
          valuesByMode: bv.valuesByMode,
        },
        is_breaking: false,
        is_internal: false,
        parent_component: null,
        family_page: bv.collectionName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
      continue;
    }

    if (variableValuesChanged(mv.valuesByMode, bv.valuesByMode)) {
      items.push({
        category: 'variable',
        change_type: 'modified',
        item_name: bv.name,
        item_id: bv.id,
        old_value: {
          name: mv.name,
          collection: mv.collectionName,
          valuesByMode: mv.valuesByMode,
        },
        new_value: {
          name: bv.name,
          collection: bv.collectionName,
          valuesByMode: bv.valuesByMode,
        },
        is_breaking: false,
        is_internal: false,
        parent_component: null,
        family_page: bv.collectionName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  for (const [key, mv] of mainByKey) {
    if (!branchByKey.has(key)) {
      items.push({
        category: 'variable',
        change_type: 'removed',
        item_name: mv.name,
        item_id: mv.id,
        old_value: {
          collection: mv.collectionName,
          resolvedType: mv.resolvedType,
          valuesByMode: mv.valuesByMode,
        },
        new_value: null,
        is_breaking: true,
        is_internal: false,
        parent_component: null,
        family_page: mv.collectionName,
        description: null,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  return items;
}

function diffEffectStyles(
  branchStyles: EffectStyleSnapshot[],
  mainStyles: EffectStyleSnapshot[]
): DiffItem[] {
  const items: DiffItem[] = [];
  const mainByName = new Map(mainStyles.map((s) => [s.name, s]));
  const branchByName = new Map(branchStyles.map((s) => [s.name, s]));

  for (const [name, bs] of branchByName) {
    const ms = mainByName.get(name);

    if (!ms) {
      const desc = bs.effects
        .map((e) => `${e.type} ${e.color ?? ''} offset(${e.offset.x},${e.offset.y}) blur ${e.radius} spread ${e.spread}`)
        .join(', ');
      items.push({
        category: 'effect_style',
        change_type: 'added',
        item_name: bs.name,
        item_id: bs.id,
        old_value: null,
        new_value: { effects: bs.effects },
        is_breaking: false,
        is_internal: false,
        parent_component: null,
        family_page: 'Effects',
        description: `Nouveau style d'effet "${bs.name}" (${desc})`,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
      continue;
    }

    if (!deepEqual(ms.effects, bs.effects)) {
      items.push({
        category: 'effect_style',
        change_type: 'modified',
        item_name: bs.name,
        item_id: bs.id,
        old_value: { effects: ms.effects },
        new_value: { effects: bs.effects },
        is_breaking: false,
        is_internal: false,
        parent_component: null,
        family_page: 'Effects',
        description: `Style d'effet "${bs.name}" modifié`,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  for (const [name, ms] of mainByName) {
    if (!branchByName.has(name)) {
      items.push({
        category: 'effect_style',
        change_type: 'removed',
        item_name: ms.name,
        item_id: ms.id,
        old_value: { effects: ms.effects },
        new_value: null,
        is_breaking: true,
        is_internal: false,
        parent_component: null,
        family_page: 'Effects',
        description: `Style d'effet "${ms.name}" supprimé`,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  return items;
}

function diffPages(branchPages: PageSnapshot[], mainPages: PageSnapshot[]): DiffItem[] {
  const items: DiffItem[] = [];
  const mainById = new Map(mainPages.map((p) => [p.id, p]));
  const matchedIds = new Set<string>();

  for (const bp of branchPages) {
    const mp = mainById.get(bp.id);
    if (mp) {
      matchedIds.add(mp.id);
      continue;
    }
    items.push({
      category: 'page',
      change_type: 'added',
      item_name: bp.name,
      item_id: bp.id,
      old_value: null,
      new_value: { childCount: bp.childCount },
      is_breaking: false,
      is_internal: false,
      parent_component: null,
      family_page: null,
      description: `Nouvelle page "${bp.name}"`,
      screenshot_before: null,
      screenshot_after: null,
      sort_order: 0,
    });
  }

  for (const mp of mainPages) {
    if (!matchedIds.has(mp.id)) {
      items.push({
        category: 'page',
        change_type: 'removed',
        item_name: mp.name,
        item_id: mp.id,
        old_value: { childCount: mp.childCount },
        new_value: null,
        is_breaking: false,
        is_internal: false,
        parent_component: null,
        family_page: null,
        description: `Page "${mp.name}" supprimée`,
        screenshot_before: null,
        screenshot_after: null,
        sort_order: 0,
      });
    }
  }

  return items;
}

function sortDiffItems(items: DiffItem[]): DiffItem[] {
  const priority = (item: DiffItem): number => {
    if (item.is_breaking && item.change_type === 'removed') return 0;
    if (item.category === 'variable' && item.change_type === 'modified') return 1;
    if (item.category === 'component' && item.change_type === 'added') return 2;
    if (item.category === 'component' && item.change_type === 'modified') return 3;
    if (item.category === 'variable' && item.change_type === 'added') return 4;
    if (item.category === 'effect_style') return 5;
    if (item.category === 'page') return 6;
    return 7;
  };

  return items
    .map((item, i) => ({ ...item, sort_order: i }))
    .sort((a, b) => priority(a) - priority(b))
    .map((item, i) => ({ ...item, sort_order: i }));
}

function mergePageWithComponent(items: DiffItem[]): DiffItem[] {
  const newPages = items.filter(
    (d) => d.category === 'page' && d.change_type === 'added'
  );
  const newComps = items.filter(
    (d) => d.category === 'component' && d.change_type === 'added'
  );

  const excludedPageNames = new Set<string>();

  for (const page of newPages) {
    const clean = page.item_name
      .replace(/^\s*↳\s*/, '')
      .trim()
      .toLowerCase();
    const match = newComps.find(
      (c) =>
        c.item_name.toLowerCase().includes(clean) ||
        clean.includes(c.item_name.toLowerCase())
    );
    if (match) {
      match.description =
        (match.description || '') +
        ` Nouvelle page "${page.item_name}" créée dans Figma.`;
      excludedPageNames.add(page.item_name);
    }
  }

  if (excludedPageNames.size === 0) return items;

  return items.filter(
    (d) =>
      !(
        d.category === 'page' &&
        d.change_type === 'added' &&
        excludedPageNames.has(d.item_name)
      )
  );
}

function attachSubComponents(items: DiffItem[]): DiffItem[] {
  const parentItems = items.filter(
    (d) => d.category === 'component' && !d.item_name.startsWith('.')
  );
  const subItems = items.filter(
    (d) => d.category === 'component' && d.item_name.startsWith('.')
  );

  for (const sub of subItems) {
    sub.is_internal = true;
    const dotName = sub.item_name;
    const familyPage = sub.family_page?.toLowerCase() ?? '';

    const parent = parentItems.find((p) => {
      const pName = p.item_name.toLowerCase();
      return (
        pName === familyPage ||
        familyPage.includes(pName) ||
        pName.includes(familyPage)
      );
    });

    if (parent) {
      sub.parent_component = parent.item_name;
    } else {
      sub.parent_component = dotName.replace(/^\./, '').split(' ')[0] || null;
    }
  }

  return items;
}

export function generateDiff(
  branchSnapshot: FigmaSnapshot,
  mainSnapshot: FigmaSnapshot
): DiffItem[] {
  console.log(`[diff] Snapshot branch: ${branchSnapshot.variables.length} vars, ${branchSnapshot.effectStyles?.length ?? 0} effects`);
  console.log(`[diff] Snapshot main: ${mainSnapshot.variables.length} vars, ${mainSnapshot.effectStyles?.length ?? 0} effects`);

  const compSetItems = diffComponentSets(branchSnapshot.componentSets, mainSnapshot.componentSets);
  const standaloneItems = diffStandaloneComponents(
    branchSnapshot.standaloneComponents,
    mainSnapshot.standaloneComponents
  );
  const varItems = diffVariables(branchSnapshot.variables, mainSnapshot.variables);
  const effectItems = diffEffectStyles(branchSnapshot.effectStyles ?? [], mainSnapshot.effectStyles ?? []);
  const pageItems = diffPages(branchSnapshot.pages, mainSnapshot.pages);

  console.log(`[diff] Results: compSets=${compSetItems.length}, standalone=${standaloneItems.length}, vars=${varItems.length}, effects=${effectItems.length}, pages=${pageItems.length}`);

  if (varItems.length > 0) {
    const sample = varItems.slice(0, 3);
    for (const v of sample) {
      console.log(`[diff] Var "${v.item_name}": ${v.change_type}, old=${JSON.stringify(v.old_value?.valuesByMode).slice(0, 80)}, new=${JSON.stringify(v.new_value?.valuesByMode).slice(0, 80)}`);
    }
  }

  const items = [...compSetItems, ...standaloneItems, ...varItems, ...effectItems, ...pageItems];
  return sortDiffItems(mergePageWithComponent(attachSubComponents(items)));
}

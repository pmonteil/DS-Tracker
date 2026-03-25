import type {
  FigmaBranch,
  FigmaSnapshot,
  ComponentSetSnapshot,
  StandaloneComponentSnapshot,
  VariableSnapshot,
  TextStyleSnapshot,
  EffectStyleSnapshot,
  PageSnapshot,
} from './types';

const FIGMA_BASE = 'https://api.figma.com/v1';

const SEPARATOR_EMOJIS = ['🌇', '📐', '🧭', '💠', '🤖', '📕', '🔥'];

function figmaHeaders() {
  return {
    'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN!,
  };
}

async function figmaGet<T>(path: string): Promise<T> {
  const res = await fetch(`${FIGMA_BASE}${path}`, {
    headers: figmaHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Liste les branches d'un fichier principal.
 * L’API Figma n’expose pas `/files/:key/branches` — il faut utiliser
 * `GET /v1/files/:key?branch_data=true` (voir rest-api-spec Figma).
 * `depth=1` limite le JSON au document (pages) pour éviter de tout télécharger.
 */
export async function getBranches(fileKey: string): Promise<FigmaBranch[]> {
  const data = await figmaGet<{
    branches?: {
      key: string;
      name: string;
      thumbnail_url?: string;
      last_modified?: string;
    }[];
  }>(
    `/files/${encodeURIComponent(fileKey)}?branch_data=true&depth=1`
  );
  return (data.branches ?? []).map((b) => ({
    key: b.key,
    name: b.name,
    thumbnail_url: b.thumbnail_url,
    last_modified: b.last_modified,
  }));
}

function isIgnoredPage(name: string): boolean {
  return SEPARATOR_EMOJIS.some((emoji) => name.startsWith(emoji));
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { width: number; height: number };
  componentPropertyDefinitions?: Record<string, { type: string; defaultValue: string; variantOptions?: string[] }>;
}

interface FigmaFileResponse {
  document: { children: FigmaNode[] };
  styles?: Record<string, { key: string; name: string; styleType: string; node_id: string }>;
}

function extractComponentSets(
  node: FigmaNode,
  pageName: string,
  results: ComponentSetSnapshot[]
) {
  if (node.type === 'COMPONENT_SET') {
    const variants = (node.children || [])
      .filter((c) => c.type === 'COMPONENT')
      .map((c) => c.name);

    const properties: { name: string; options: string[] }[] = [];
    if (node.componentPropertyDefinitions) {
      for (const [propName, propDef] of Object.entries(node.componentPropertyDefinitions)) {
        if (propDef.variantOptions) {
          properties.push({ name: propName, options: propDef.variantOptions });
        }
      }
    }

    results.push({
      id: node.id,
      name: node.name,
      variantCount: variants.length,
      variants,
      properties,
      isInternal: node.name.startsWith('.'),
      pageName,
    });
    return;
  }

  if (node.children) {
    for (const child of node.children) {
      extractComponentSets(child, pageName, results);
    }
  }
}

function extractStandaloneComponents(
  node: FigmaNode,
  pageName: string,
  parentType: string,
  results: StandaloneComponentSnapshot[]
) {
  if (node.type === 'COMPONENT' && parentType !== 'COMPONENT_SET') {
    results.push({
      id: node.id,
      name: node.name,
      isInternal: node.name.startsWith('.'),
      pageName,
      width: node.absoluteBoundingBox?.width ?? 0,
      height: node.absoluteBoundingBox?.height ?? 0,
    });
  }

  if (node.children) {
    for (const child of node.children) {
      extractStandaloneComponents(child, pageName, node.type, results);
    }
  }
}

export async function takeSnapshot(fileKey: string): Promise<FigmaSnapshot> {
  const [fileData, variablesData] = await Promise.all([
    figmaGet<FigmaFileResponse>(`/files/${fileKey}?depth=3`),
    figmaGet<{
      meta?: {
        variables?: Record<string, {
          id: string;
          name: string;
          resolvedType: string;
          valuesByMode: Record<string, unknown>;
          variableCollectionId: string;
        }>;
        variableCollections?: Record<string, {
          id: string;
          name: string;
        }>;
      };
    }>(`/files/${fileKey}/variables/local`).catch((err) => {
      console.error(`[Figma] Failed to fetch variables for ${fileKey}:`, err);
      return {
        meta: {
          variables: {} as Record<string, { id: string; name: string; resolvedType: string; valuesByMode: Record<string, unknown>; variableCollectionId: string }>,
          variableCollections: {} as Record<string, { id: string; name: string }>,
        },
      };
    }),
  ]);

  const pages: PageSnapshot[] = [];
  const componentSets: ComponentSetSnapshot[] = [];
  const standaloneComponents: StandaloneComponentSnapshot[] = [];

  for (const page of fileData.document.children) {
    if (page.type !== 'CANVAS') continue;
    if (isIgnoredPage(page.name)) continue;

    pages.push({
      id: page.id,
      name: page.name,
      childCount: page.children?.length ?? 0,
    });

    extractComponentSets(page, page.name, componentSets);
    extractStandaloneComponents(page, page.name, 'CANVAS', standaloneComponents);
  }

  const variables: VariableSnapshot[] = [];
  const rawVars = variablesData.meta?.variables ?? {};
  const rawCollections = variablesData.meta?.variableCollections ?? {};

  console.log(`[figma] ${fileKey}: ${Object.keys(rawVars).length} raw variables, ${Object.keys(rawCollections).length} collections`);
  for (const [colId, col] of Object.entries(rawCollections)) {
    const count = Object.values(rawVars).filter((v) => v.variableCollectionId === colId).length;
    console.log(`[figma]   Collection "${col.name}": ${count} variables`);
  }

  function resolveVarValue(val: unknown): unknown {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      if (obj.type === 'VARIABLE_ALIAS' && typeof obj.id === 'string') {
        const aliased = rawVars[obj.id];
        return aliased ? aliased.name : `ref:${obj.id}`;
      }
      if (obj.r !== undefined && obj.g !== undefined && obj.b !== undefined) {
        return rgbaToHex(obj as { r: number; g: number; b: number; a?: number });
      }
    }
    return val;
  }

  let resolvedAliasCount = 0;
  let unresolvedAliasCount = 0;

  for (const [, v] of Object.entries(rawVars)) {
    const col = rawCollections[v.variableCollectionId];
    const resolved: Record<string, unknown> = {};
    for (const [mode, val] of Object.entries(v.valuesByMode)) {
      const r = resolveVarValue(val);
      resolved[mode] = r;
      if (typeof r === 'string' && r.startsWith('ref:')) unresolvedAliasCount++;
      else if (val && typeof val === 'object' && (val as Record<string, unknown>).type === 'VARIABLE_ALIAS') resolvedAliasCount++;
    }
    variables.push({
      id: v.id,
      name: v.name,
      collection: v.variableCollectionId,
      collectionName: col?.name ?? 'Unknown',
      resolvedType: v.resolvedType,
      valuesByMode: resolved,
    });
  }

  console.log(`[figma] ${fileKey}: Alias resolution: ${resolvedAliasCount} resolved, ${unresolvedAliasCount} unresolved`);

  const textStyles: TextStyleSnapshot[] = [];

  const effectStyles: EffectStyleSnapshot[] = [];
  const effectStyleEntries = Object.entries(fileData.styles ?? {})
    .filter(([, s]) => s.styleType === 'EFFECT');

  if (effectStyleEntries.length > 0) {
    const effectNodeIds = effectStyleEntries.map(([nodeId]) => nodeId);
    const nodeData = await figmaGet<{
      nodes: Record<string, { document: { effects?: Array<{ type: string; color?: { r: number; g: number; b: number; a?: number }; offset?: { x: number; y: number }; radius?: number; spread?: number; visible?: boolean }> } }>;
    }>(`/files/${fileKey}/nodes?ids=${encodeURIComponent(effectNodeIds.join(','))}`).catch(() => null);

    for (const [nodeId, styleMeta] of effectStyleEntries) {
      const doc = nodeData?.nodes?.[nodeId]?.document;
      const effects = (doc?.effects ?? [])
        .filter((e) => e.visible !== false)
        .map((e) => ({
          type: e.type,
          color: e.color ? rgbaToHex(e.color) : null,
          offset: e.offset ?? { x: 0, y: 0 },
          radius: e.radius ?? 0,
          spread: e.spread ?? 0,
        }));
      effectStyles.push({
        id: nodeId,
        name: styleMeta.name,
        effects,
      });
    }
  }

  return {
    componentSets,
    standaloneComponents,
    variables,
    textStyles,
    effectStyles,
    pages: pages.filter((p) => p.childCount > 0),
  };
}

export async function exportImages(
  fileKey: string,
  nodeIds: string[]
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};

  const ids = nodeIds.join(',');
  const data = await figmaGet<{ images: Record<string, string | null> }>(
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`
  );

  const result: Record<string, string> = {};
  for (const [id, url] of Object.entries(data.images)) {
    if (url) result[id] = url;
  }
  return result;
}

export function rgbaToHex(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

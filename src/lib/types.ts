export interface CustomBlock {
  title: string;
  text: string;
  images: string[];
}

export interface Version {
  id: string;
  version_number: string;
  title: string;
  branch_name: string | null;
  branch_key: string | null;
  status: 'draft' | 'published';
  patchnote_md: string | null;
  summary: string | null;
  diff_json: DiffItem[] | null;
  figma_file_key: string;
  created_at: string;
  published_at: string | null;
  created_by: string | null;
  variable_screenshots: string[];
  custom_blocks: CustomBlock[];
}

export interface DiffItem {
  id?: string;
  version_id?: string;
  category: 'component' | 'variable' | 'text_style' | 'effect_style' | 'page';
  change_type: 'added' | 'modified' | 'removed';
  item_name: string;
  item_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  is_breaking: boolean;
  is_internal: boolean;
  parent_component: string | null;
  family_page: string | null;
  description: string | null;
  screenshot_before: string | null;
  screenshot_after: string | null;
  sort_order: number;
  /** Masqué du patchnote mais conservé en base */
  excluded?: boolean;
}

export interface FigmaBranch {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified?: string;
  description?: string;
}

export interface ComponentSetSnapshot {
  id: string;
  name: string;
  variantCount: number;
  variants: string[];
  properties: { name: string; options: string[] }[];
  isInternal: boolean;
  pageName: string;
}

export interface StandaloneComponentSnapshot {
  id: string;
  name: string;
  isInternal: boolean;
  pageName: string;
  width: number;
  height: number;
}

export interface VariableSnapshot {
  id: string;
  name: string;
  collection: string;
  collectionName: string;
  resolvedType: string;
  valuesByMode: Record<string, unknown>;
}

export interface TextStyleSnapshot {
  id: string;
  name: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  lineHeight: number;
  letterSpacing: number;
}

export interface EffectStyleSnapshot {
  id: string;
  name: string;
  effects: {
    type: string;
    color: string | null;
    offset: { x: number; y: number };
    radius: number;
    spread: number;
  }[];
}

export interface PageSnapshot {
  id: string;
  name: string;
  childCount: number;
}

export interface FigmaSnapshot {
  componentSets: ComponentSetSnapshot[];
  standaloneComponents: StandaloneComponentSnapshot[];
  variables: VariableSnapshot[];
  textStyles: TextStyleSnapshot[];
  effectStyles: EffectStyleSnapshot[];
  pages: PageSnapshot[];
}

export interface AIProvider {
  generatePatchnote(diffJson: string, context: string): Promise<string>;
  analyzeScreenshots?(beforeUrl: string | null, afterUrl: string | null, componentName: string): Promise<string>;
}

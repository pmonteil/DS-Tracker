# DS Tracker — Corrections V1.1

> Ce document contient les corrections et améliorations à appliquer sur l'app DS Tracker existante. Donne ce fichier à Cursor comme contexte pour qu'il applique les modifications.

---

## Bug critique : Faux positifs sur les Text Styles

### Problème

Le diff affiche toutes les typographies comme "supprimées" alors qu'elles existent sur la branche et sur main avec les mêmes noms et les mêmes valeurs. La cause : Figma génère des **IDs différents** pour les text styles entre une branche et le fichier principal. L'algorithme compare par ID, ne trouve aucun match, et traite tout comme supprimé + ajouté.

Preuve :
- `h1` sur main → `S:2a43c6206f34952319f3aa2896d497368353e9d7,`
- `h1` sur branche → `S:68c146cbd3bf47bbcbf14a15d15c5c16731602f4,`
- Même nom, même font-size (40px), même font-weight (Bold), même line-height (50px)

### Correction

Dans `lib/diff.ts` (ou l'équivalent), pour les **text styles uniquement**, comparer par **NOM** au lieu de par ID :

```typescript
// AVANT (bugué)
// const mainStyle = mainStyles.find(s => s.id === branchStyle.id);

// APRÈS (corrigé)
const mainStyle = mainStyles.find(s => s.name === branchStyle.name);
```

Ensuite comparer les propriétés : `fontSize`, `fontFamily`, `fontStyle`, `lineHeight`, `letterSpacing`. Si tout est identique → aucun changement. Si une propriété diffère → MODIFIED.

Ne marquer un text style comme REMOVED que si son **nom** n'existe pas du tout dans la branche (pas son ID).

> Note : ce problème d'IDs différents entre branche et main peut aussi affecter les **composants** et les **variables**. Vérifier si le diff des composants et variables utilise les IDs Figma ou les noms. Si IDs : implémenter un fallback par nom quand le match par ID échoue. L'ordre de matching doit être : (1) match par ID, (2) si pas trouvé, match par nom exact, (3) si pas trouvé non plus → c'est un vrai ajout/suppression.

---

## Amélioration majeure : Formatage lisible sans IA

### Problème

Sans clé API IA (Anthropic ou OpenAI), l'app affiche le diff brut en JSON, ce qui est indigeste et inutilisable.

### Solution

Implémenter un **formateur côté code** (pas d'IA) dans `lib/patchnote-formatter.ts` qui transforme le tableau de `DiffItem[]` en markdown structuré. L'IA devient optionnelle : elle améliore le texte si dispo, sinon le formateur produit un patchnote correct et lisible.

```typescript
// lib/patchnote-formatter.ts

export function formatPatchnoteFromDiff(diffItems: DiffItem[]): string {
  let md = '';
  
  // 1. Breaking changes
  const breakingItems = diffItems.filter(d => d.is_breaking);
  if (breakingItems.length > 0) {
    md += '## Breaking changes ⚠️\n\n';
    for (const item of breakingItems) {
      md += formatBreakingItem(item);
    }
    md += '\n';
  }
  
  // 2. Text styles modifiés
  const textStyleMods = diffItems.filter(d => d.category === 'text_style' && d.change_type === 'modified');
  if (textStyleMods.length > 0) {
    md += '## Typographie\n\n';
    for (const item of textStyleMods) {
      md += `- **${item.item_name}** : ${formatChange(item.old_value, item.new_value)}\n`;
    }
    md += '\n';
  }
  
  // 3. Variables modifiées (groupées par collection)
  const varMods = diffItems.filter(d => d.category === 'variable' && d.change_type === 'modified');
  if (varMods.length > 0) {
    md += '## Variables modifiées\n\n';
    const byCollection = groupBy(varMods, 'collection_name');
    for (const [collection, items] of Object.entries(byCollection)) {
      md += `### ${collection}\n\n`;
      for (const item of items) {
        md += `- \`${item.item_name}\` : ${formatColorOrValue(item.old_value)} → ${formatColorOrValue(item.new_value)}\n`;
      }
      md += '\n';
    }
  }
  
  // 4. Nouveaux composants
  const newComps = diffItems.filter(d => d.category === 'component' && d.change_type === 'added' && !d.is_internal);
  if (newComps.length > 0) {
    md += '## Nouveaux composants\n\n';
    for (const item of newComps) {
      md += formatNewComponent(item);
    }
  }
  
  // 5. Composants modifiés (groupés par famille/page)
  const modComps = diffItems.filter(d => d.category === 'component' && d.change_type === 'modified');
  if (modComps.length > 0) {
    md += '## Composants modifiés\n\n';
    const byFamily = groupBy(modComps, 'family_page');
    for (const [family, items] of Object.entries(byFamily)) {
      md += `### ${family}\n\n`;
      for (const item of items) {
        const prefix = item.is_internal ? `_(interne)_ \`${item.item_name}\`` : `**${item.item_name}**`;
        md += `- ${prefix} : ${item.description}\n`;
      }
      md += '\n';
    }
  }
  
  // 6. Nouvelles variables (groupées par collection)
  const newVars = diffItems.filter(d => d.category === 'variable' && d.change_type === 'added');
  if (newVars.length > 0) {
    md += '## Nouvelles variables\n\n';
    const byCollection = groupBy(newVars, 'collection_name');
    for (const [collection, items] of Object.entries(byCollection)) {
      md += `### ${collection}\n\n`;
      for (const item of items) {
        md += `- \`${item.item_name}\` — ${formatColorOrValue(item.new_value)}\n`;
      }
      md += '\n';
    }
  }
  
  // 7. Nouveaux text styles
  const newStyles = diffItems.filter(d => d.category === 'text_style' && d.change_type === 'added');
  if (newStyles.length > 0) {
    md += '## Nouveaux text styles\n\n';
    for (const item of newStyles) {
      md += `- **${item.item_name}** : ${item.description}\n`;
    }
    md += '\n';
  }
  
  // 8. Structure du fichier
  const pageChanges = diffItems.filter(d => d.category === 'page');
  if (pageChanges.length > 0) {
    md += '## Structure du fichier\n\n';
    for (const item of pageChanges) {
      const icon = item.change_type === 'added' ? '+' : '−';
      md += `- ${icon} Page "${item.item_name}"\n`;
    }
    md += '\n';
  }
  
  return md;
}
```

### Flux révisé pour `/api/diff/generate`

```
1. Faire le diff (snapshots branche vs main)
2. Générer les DiffItem[]
3. SI une clé API IA est configurée (AI_PROVIDER + clé) :
   → Envoyer le diff JSON à l'IA pour un patchnote enrichi
4. SINON :
   → Utiliser formatPatchnoteFromDiff() pour un patchnote structuré sans IA
5. Dans les deux cas : sauvegarder en draft dans Supabase
```

---

## Amélioration UX : Screenshots dans les bonnes sections (pas en bas)

### Problème

Les screenshots des composants sont tous regroupés en bas de la page, séparés du contexte. Le développeur doit scroller pour faire le lien entre un changement et son screenshot.

### Correction

Les screenshots doivent être **inline dans chaque section de composant**, pas dans une section séparée. Dans l'éditeur de patchnote (`/versions/[id]/edit`), pour chaque diff_item de catégorie `component` qui a un `screenshot_before` ou `screenshot_after` :

**Pour le composant DiffItemList** (la section "Changements détectés") :

```tsx
{/* Pour chaque diff item de type component */}
<div className="diff-item">
  <div className="diff-item-header">
    <Badge type={item.change_type} />
    <span className="font-medium">{item.item_name}</span>
    <span className="text-gray-500 text-sm">{item.description}</span>
  </div>
  
  {/* Screenshots INLINE — directement sous le composant concerné */}
  {(item.screenshot_before || item.screenshot_after) && (
    <div className="mt-3 flex gap-4">
      {item.screenshot_before && (
        <div className="flex-1">
          <span className="text-xs text-gray-400 uppercase">Avant</span>
          <img src={item.screenshot_before} alt="Avant" className="mt-1 rounded border border-gray-200" />
        </div>
      )}
      {item.screenshot_after && (
        <div className="flex-1">
          <span className="text-xs text-gray-400 uppercase">
            {item.change_type === 'added' ? 'Nouveau' : 'Après'}
          </span>
          <img src={item.screenshot_after} alt="Après" className="mt-1 rounded border border-gray-200" />
        </div>
      )}
    </div>
  )}
</div>
```

**Pour la vue publique du patchnote** (`/changelog/[versionNumber]`) :

Dans le markdown généré, insérer les images directement dans la section du composant concerné :

```markdown
### Filter (nouveau)

Variantes : Default, Hover, Active × Default, XS
Props : Property 1, Size

![Filter](https://xxx.supabase.co/storage/v1/object/public/screenshots/version-id/Filter_after.png)
```

**Supprimer complètement** la section "Screenshots" en bas de page. Elle ne doit pas exister.

---

## Amélioration UX : Pouvoir supprimer des blocs individuellement

### Problème

Le designer ne peut pas retirer un changement du patchnote s'il veut le bypasser (par exemple, un faux positif ou un changement non pertinent).

### Solution

Ajouter un **bouton de suppression** (icône poubelle ou X) sur chaque diff_item dans la section "Changements détectés" de l'éditeur.

Au clic :
1. Le diff_item est retiré de l'affichage (état local React)
2. Le patchnote markdown est regénéré automatiquement en excluant cet item
3. Le diff_item est marqué `excluded: true` dans la base (ou supprimé de la table diff_items)

```tsx
// Dans DiffItemList.tsx
const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

const handleExclude = (itemId: string) => {
  setExcludedIds(prev => new Set([...prev, itemId]));
  // Regénérer le patchnote sans cet item
  const remainingItems = diffItems.filter(d => !excludedIds.has(d.id) && d.id !== itemId);
  const newMarkdown = formatPatchnoteFromDiff(remainingItems);
  onPatchnoteUpdate(newMarkdown);
};

// Rendu
{diffItems
  .filter(item => !excludedIds.has(item.id))
  .map(item => (
    <div key={item.id} className="diff-item group">
      {/* ... contenu du diff item ... */}
      <button
        onClick={() => handleExclude(item.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
        title="Exclure du patchnote"
      >
        <X size={16} />
      </button>
    </div>
  ))
}
```

### Modification de la table diff_items (SQL)

Ajouter une colonne pour marquer les items exclus :

```sql
ALTER TABLE diff_items ADD COLUMN excluded BOOLEAN DEFAULT FALSE;
```

Les items exclus ne sont pas supprimés (on garde l'historique), mais ils sont filtrés dans l'affichage et exclus du patchnote markdown.

---

## Amélioration UX : Regrouper les diff items par catégorie

### Problème

Actuellement les changements détectés sont affichés en vrac, mélangés entre variables, composants et text styles.

### Solution

Dans la section "Changements détectés" de l'éditeur, regrouper les items par catégorie, dans le même ordre que le patchnote :

```tsx
const categories = [
  { key: 'breaking', label: 'Breaking changes ⚠️', filter: (d) => d.is_breaking },
  { key: 'text_style', label: 'Typographie', filter: (d) => d.category === 'text_style' && !d.is_breaking },
  { key: 'variable_mod', label: 'Variables modifiées', filter: (d) => d.category === 'variable' && d.change_type === 'modified' && !d.is_breaking },
  { key: 'component_new', label: 'Nouveaux composants', filter: (d) => d.category === 'component' && d.change_type === 'added' },
  { key: 'component_mod', label: 'Composants modifiés', filter: (d) => d.category === 'component' && d.change_type === 'modified' },
  { key: 'variable_new', label: 'Nouvelles variables', filter: (d) => d.category === 'variable' && d.change_type === 'added' },
  { key: 'page', label: 'Structure du fichier', filter: (d) => d.category === 'page' },
];

{categories.map(cat => {
  const items = diffItems.filter(cat.filter).filter(d => !excludedIds.has(d.id));
  if (items.length === 0) return null;
  return (
    <div key={cat.key} className="mb-6">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
        {cat.label} <span className="text-gray-400">({items.length})</span>
      </h3>
      {items.map(item => (
        <DiffItem key={item.id} item={item} onExclude={handleExclude} />
      ))}
    </div>
  );
})}
```

Chaque catégorie a son header avec le nombre d'items. Les catégories vides sont masquées. Les screenshots restent inline dans chaque item de composant.

---

## Amélioration design : Respecter la direction artistique

### Rappel du style cible

L'app doit ressembler à Vercel / Notion / Linear. Vérifier et corriger si nécessaire :

- **Fond de page** : `#FAFAFA` (pas blanc pur)
- **Cartes** : fond blanc `#FFFFFF`, border `1px solid #E5E7EB`, border-radius `8px`
- **Bouton primaire** : fond noir `#0A0A0A`, texte blanc, border-radius `6px`
- **Bouton secondaire** : fond transparent, border `1px solid #E5E7EB`, texte `#0A0A0A`
- **Les badges de statut** sont les SEULES touches de couleur (vert, bleu, rouge, orange, gris)
- **Pas de gradient**, pas de fond coloré sur les sections
- **Pas d'ombres portées** sauf léger hover : `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`
- **Police** : Inter, weights 400 et 500 uniquement
- **Icônes** : Lucide React, stroke-width 1.5

### Couleurs de badges (les SEULES couleurs autorisées)

```css
/* Ajout / succès */
.badge-added { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }

/* Modification / info */
.badge-modified { background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; }

/* Suppression / danger */
.badge-removed { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }

/* Breaking / warning */
.badge-breaking { background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; }

/* Draft / neutre */
.badge-draft { background: #F3F4F6; color: #374151; border: 1px solid #D1D5DB; }
```

---

## Checklist de corrections (ordre d'implémentation)

- [ ] **Bug fix** : Text styles — comparer par nom, pas par ID (lib/diff.ts)
- [ ] **Bug fix** : Vérifier si le même problème d'IDs existe pour les composants et variables entre branche et main. Si oui, implémenter le fallback : match par ID → puis match par nom → sinon c'est un vrai ajout/suppression
- [ ] **Feature** : Créer `lib/patchnote-formatter.ts` — formateur markdown sans IA
- [ ] **Feature** : Modifier `/api/diff/generate` pour utiliser le formateur quand pas de clé API
- [ ] **UX** : Déplacer les screenshots inline dans chaque diff item (pas en section séparée)
- [ ] **UX** : Ajouter bouton "exclure" (X) sur chaque diff item + colonne `excluded` en BDD
- [ ] **UX** : Regrouper les diff items par catégorie dans l'éditeur (avec headers et compteurs)
- [ ] **UX** : Regénérer automatiquement le markdown quand un item est exclu
- [ ] **Design** : Vérifier/corriger la direction artistique (fond, boutons, badges, pas de gradients)
- [ ] **SQL** : `ALTER TABLE diff_items ADD COLUMN excluded BOOLEAN DEFAULT FALSE;`

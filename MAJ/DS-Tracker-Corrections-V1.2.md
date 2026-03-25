# DS Tracker — Corrections V1.2 : Formatage lisible

> Ce document corrige le problème de lisibilité des changements détectés et du patchnote. À donner à Cursor APRÈS avoir appliqué les corrections V1.1.

---

## 1. URGENT — Le bug des Text Styles persiste

Le fix de la V1.1 (comparer par nom au lieu de par ID) n'a pas été appliqué correctement ou pas du tout. Les text styles h1, h2, h3, body/normal, etc. apparaissent toujours comme "Supprimés" alors qu'ils existent à l'identique sur la branche et sur main.

### Le problème exact

Les IDs des text styles sont **différents** entre branche et main dans Figma. C'est un comportement normal de Figma pour les branches. Exemples :

```
Style "h1" :
  - ID sur main :    S:2a43c6206f34952319f3aa2896d497368353e9d7,
  - ID sur branche : S:68c146cbd3bf47bbcbf14a15d15c5c16731602f4,
  → Même nom, même fontSize (40), même fontStyle (Bold), même lineHeight (50px)
  → Ce n'est PAS une suppression, c'est le même style avec un ID différent

Style "h2" :
  - ID sur main :    S:1900178cb2a17efb029a69daae977192ba996954,
  - ID sur branche : S:a7c0b91d7d13acbde581b23688a22c25192aa902,
  → Même nom, même fontSize (20), même fontStyle (Bold), même lineHeight (24px)
```

### Fix obligatoire

Trouver dans le code le fichier qui fait le diff des text styles (probablement `lib/diff.ts` ou similaire). Chercher la comparaison par ID et la remplacer :

```typescript
// CHERCHER quelque chose comme :
const mainStyle = mainTextStyles.find(s => s.id === branchStyle.id);
// ou
const match = mainStyles.find(s => s.key === branchStyle.key);
// ou toute comparaison qui utilise un identifiant unique

// REMPLACER PAR :
const mainStyle = mainTextStyles.find(s => s.name === branchStyle.name);
```

Faire la même vérification pour les **composants** et les **variables** : est-ce que le diff utilise des IDs qui peuvent différer entre branche et main ? Si oui, ajouter un fallback par nom.

L'ordre de matching doit être :
1. Match par ID exact
2. Si pas trouvé → match par nom exact 
3. Si pas trouvé non plus → c'est un vrai ajout ou une vraie suppression

Le composant "Variable" (anciennement "Balise dynamique") dans le screenshot illustre que le match par nom fonctionne pour les composants renommés — mais il faut que le fallback existe pour les IDs qui changent entre branches.

---

## 2. Reformater l'affichage des diff items — Composants

### Problème actuel

Les variantes sont affichées en texte brut dans un seul paragraphe, ce qui donne :

```
Variantes ajoutées : Status=Default, State=Not filled, Status=Default, State=filled,
Status=disabled, State=Not filled, Status=disabled, State=filled, Status=focus,
State=Not filled, Status=focus, State=filled, Status=hover, State=Not filled...
```

C'est illisible. Un dev ne peut pas comprendre ce qui a changé.

### Solution : affichage structuré des changements de composants

Remplacer le bloc texte par un affichage structuré. Créer un composant React `ComponentDiffDetail` :

```tsx
// components/versions/ComponentDiffDetail.tsx

interface ComponentDiffDetailProps {
  item: DiffItem;
}

export function ComponentDiffDetail({ item }: ComponentDiffDetailProps) {
  const oldValue = item.old_value as any;
  const newValue = item.new_value as any;

  // Cas 1 : Composant AJOUTÉ
  if (item.change_type === 'added') {
    return (
      <div className="mt-2 space-y-2">
        {newValue?.variantCount && (
          <p className="text-sm text-gray-600">
            {newValue.variantCount} variantes
          </p>
        )}
        {newValue?.properties && (
          <div className="flex flex-wrap gap-2">
            {newValue.properties.map((prop: any) => (
              <div key={prop.name} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1">
                <span className="font-medium text-gray-700">{prop.name}</span>
                <span className="text-gray-400 mx-1">:</span>
                <span className="text-gray-500">{prop.options?.join(', ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Cas 2 : Composant MODIFIÉ — afficher un résumé clair
  if (item.change_type === 'modified') {
    const changes: JSX.Element[] = [];

    // Renommage
    if (oldValue?.name && newValue?.name && oldValue.name !== newValue.name) {
      changes.push(
        <div key="rename" className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Renommé :</span>
          <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs line-through">{oldValue.name}</code>
          <span className="text-gray-400">→</span>
          <code className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs">{newValue.name}</code>
        </div>
      );
    }

    // Nombre de variantes
    if (oldValue?.variantCount !== undefined && newValue?.variantCount !== undefined && oldValue.variantCount !== newValue.variantCount) {
      const diff = newValue.variantCount - oldValue.variantCount;
      changes.push(
        <div key="variants-count" className="text-sm text-gray-600">
          Variantes : {oldValue.variantCount} → {newValue.variantCount}
          <span className={diff > 0 ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
            ({diff > 0 ? '+' : ''}{diff})
          </span>
        </div>
      );
    }

    // Props ajoutées
    if (newValue?.addedProps?.length > 0) {
      changes.push(
        <div key="added-props" className="text-sm">
          <span className="text-green-600 font-medium">+ Props ajoutées :</span>{' '}
          {newValue.addedProps.map((p: string) => (
            <code key={p} className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs mr-1">{p}</code>
          ))}
        </div>
      );
    }

    // Props supprimées
    if (newValue?.removedProps?.length > 0) {
      changes.push(
        <div key="removed-props" className="text-sm">
          <span className="text-red-600 font-medium">− Props supprimées :</span>{' '}
          {newValue.removedProps.map((p: string) => (
            <code key={p} className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs mr-1">{p}</code>
          ))}
        </div>
      );
    }

    // Variantes ajoutées — RÉSUMÉ, pas la liste complète
    if (newValue?.addedVariants?.length > 0) {
      // Au lieu de lister chaque variante, résumer par propriété
      const summary = summarizeVariants(newValue.addedVariants);
      changes.push(
        <div key="added-variants" className="text-sm">
          <span className="text-green-600 font-medium">+ {newValue.addedVariants.length} variantes ajoutées</span>
          {summary && <span className="text-gray-500 ml-1">({summary})</span>}
        </div>
      );
    }

    // Variantes supprimées — RÉSUMÉ
    if (newValue?.removedVariants?.length > 0) {
      const summary = summarizeVariants(newValue.removedVariants);
      changes.push(
        <div key="removed-variants" className="text-sm">
          <span className="text-red-600 font-medium">− {newValue.removedVariants.length} variantes supprimées</span>
          {summary && <span className="text-gray-500 ml-1">({summary})</span>}
        </div>
      );
    }

    return <div className="mt-2 space-y-1.5">{changes}</div>;
  }

  // Cas 3 : Composant SUPPRIMÉ
  if (item.change_type === 'removed') {
    return (
      <p className="mt-1 text-sm text-red-600">
        Ce composant a été supprimé. Les développeurs doivent le retirer de leur code.
      </p>
    );
  }

  return null;
}

// Fonction utilitaire : résumer les variantes par propriété
// Au lieu de "Status=Default, State=filled, Status=hover, State=filled"
// Retourne "nouvelles combinaisons Status × State"
function summarizeVariants(variants: string[]): string {
  if (!variants || variants.length === 0) return '';
  
  // Extraire les propriétés uniques mentionnées
  const props = new Set<string>();
  for (const v of variants) {
    const parts = v.split(',').map(p => p.trim());
    for (const part of parts) {
      const [propName] = part.split('=');
      if (propName) props.add(propName.trim());
    }
  }
  
  if (props.size === 0) return '';
  if (props.size === 1) return `nouvelles valeurs de ${[...props][0]}`;
  return `nouvelles combinaisons ${[...props].join(' × ')}`;
}
```

### Utilisation dans DiffItemList

```tsx
// Dans le rendu de chaque diff item, remplacer le paragraphe texte par :
<div className="diff-item">
  <div className="flex items-center gap-2">
    <DiffIcon type={item.change_type} />
    <span className="font-medium">{item.item_name}</span>
    <Badge type={item.change_type} />
    <Badge type={item.category} />
    {item.is_breaking && <Badge type="breaking" />}
  </div>
  
  {/* NOUVEAU : affichage structuré au lieu du texte brut */}
  {item.category === 'component' && <ComponentDiffDetail item={item} />}
  {item.category === 'variable' && <VariableDiffDetail item={item} />}
  {item.category === 'text_style' && <TextStyleDiffDetail item={item} />}
  
  {/* Screenshots inline */}
  {(item.screenshot_before || item.screenshot_after) && (
    <ScreenshotComparison before={item.screenshot_before} after={item.screenshot_after} type={item.change_type} />
  )}
</div>
```

---

## 3. Reformater l'affichage des diff items — Variables

### Problème actuel

Les variables sont affichées comme du texte brut. Pour les couleurs, on ne voit que des valeurs hex sans aperçu visuel.

### Solution : affichage avec aperçu couleur

```tsx
// components/versions/VariableDiffDetail.tsx

export function VariableDiffDetail({ item }: { item: DiffItem }) {
  const oldValue = item.old_value as any;
  const newValue = item.new_value as any;

  if (item.change_type === 'added') {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-gray-500">Valeur :</span>
        <ColorOrValue value={newValue} />
      </div>
    );
  }

  if (item.change_type === 'modified') {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm">
        <ColorOrValue value={oldValue} />
        <span className="text-gray-400">→</span>
        <ColorOrValue value={newValue} />
      </div>
    );
  }

  if (item.change_type === 'removed') {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
        Variable supprimée
        {oldValue && (
          <>
            <span className="text-gray-400 ml-1">— ancienne valeur :</span>
            <ColorOrValue value={oldValue} />
          </>
        )}
      </div>
    );
  }

  return null;
}

// Composant pour afficher une couleur avec preview ou une valeur brute
function ColorOrValue({ value }: { value: any }) {
  // Si c'est une couleur (objet {r, g, b, a} ou string hex)
  const hex = extractHex(value);
  if (hex) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-4 h-4 rounded border border-gray-200 inline-block flex-shrink-0"
          style={{ backgroundColor: hex }}
        />
        <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">{hex}</code>
      </span>
    );
  }

  // Si c'est une valeur numérique (padding, font-size, etc.)
  if (typeof value === 'number') {
    return <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">{value}px</code>;
  }

  // Sinon afficher tel quel
  return <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">{JSON.stringify(value)}</code>;
}

function extractHex(value: any): string | null {
  if (!value) return null;
  
  // Si c'est déjà un hex string
  if (typeof value === 'string' && value.startsWith('#')) return value;
  
  // Si c'est un objet RGBA Figma (valeurs 0-1)
  if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
    const r = Math.round(value.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(value.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(value.b * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }
  
  // Si c'est un objet avec un champ color ou hex
  if (value.color) return extractHex(value.color);
  if (value.hex) return value.hex;
  
  return null;
}
```

---

## 4. Reformater l'affichage des diff items — Text Styles

```tsx
// components/versions/TextStyleDiffDetail.tsx

export function TextStyleDiffDetail({ item }: { item: DiffItem }) {
  const oldValue = item.old_value as any;
  const newValue = item.new_value as any;

  if (item.change_type === 'modified') {
    const changes: string[] = [];
    if (oldValue?.fontSize !== newValue?.fontSize) {
      changes.push(`Taille : ${oldValue?.fontSize}px → ${newValue?.fontSize}px`);
    }
    if (oldValue?.fontStyle !== newValue?.fontStyle) {
      changes.push(`Weight : ${oldValue?.fontStyle} → ${newValue?.fontStyle}`);
    }
    if (JSON.stringify(oldValue?.lineHeight) !== JSON.stringify(newValue?.lineHeight)) {
      const oldLH = oldValue?.lineHeight?.value || oldValue?.lineHeight;
      const newLH = newValue?.lineHeight?.value || newValue?.lineHeight;
      changes.push(`Line height : ${oldLH}px → ${newLH}px`);
    }
    
    return (
      <div className="mt-2 space-y-1">
        {changes.map((change, i) => (
          <p key={i} className="text-sm text-gray-600">{change}</p>
        ))}
      </div>
    );
  }

  if (item.change_type === 'added') {
    return (
      <div className="mt-2 text-sm text-gray-600">
        {newValue?.fontFamily} {newValue?.fontStyle} — {newValue?.fontSize}px / {newValue?.lineHeight?.value || newValue?.lineHeight}px
      </div>
    );
  }

  return null;
}
```

---

## 5. Améliorer le diff engine — stocker des données structurées

### Problème racine

Le formateur ne peut pas faire un bon travail si le diff_json ne contient pas des données structurées. Il faut que `lib/diff.ts` stocke dans `old_value` et `new_value` des objets bien typés, pas du texte concaténé.

### Structure attendue pour les diff items

Pour les **composants modifiés**, le `new_value` doit contenir :

```typescript
interface ComponentDiffValue {
  name: string;
  variantCount: number;
  properties: Array<{ name: string; options: string[] }>;
  // Calculés par le diff :
  addedVariants?: string[];      // Variantes présentes dans branche mais pas dans main
  removedVariants?: string[];    // Variantes présentes dans main mais pas dans branche
  addedProps?: string[];         // Noms des propriétés ajoutées
  removedProps?: string[];       // Noms des propriétés supprimées
}
```

Pour les **variables modifiées** :

```typescript
interface VariableDiffValue {
  name: string;
  collection: string;
  resolvedType: string;  // "COLOR", "FLOAT", etc.
  valuesByMode: Record<string, any>;  // La valeur par mode
}
```

Pour les **text styles modifiés** :

```typescript
interface TextStyleDiffValue {
  name: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  lineHeight: { unit: string; value: number };
  letterSpacing: { unit: string; value: number };
}
```

Vérifier que `lib/diff.ts` stocke bien ces structures dans `old_value` et `new_value`, et pas une concaténation de texte.

---

## 6. Améliorer le patchnote markdown généré (formateur sans IA)

Le formateur `lib/patchnote-formatter.ts` doit produire un markdown propre. Voici le template exact attendu pour chaque type de changement :

### Composant modifié (exemple: field)

```markdown
### field

- Propriété `Theme` supprimée
- Variantes : 10 → 8 (−2)
- 2 variantes supprimées (combinaisons avec Theme=Default)

![field — Avant](url_before)
![field — Après](url_after)
```

### Composant ajouté (exemple: Dropdown)

```markdown
### Dropdown (nouveau)

6 variantes disponibles :
- **Type** : Default, Outlined
- **Status** : Default, Hover, Disabled

![Dropdown](url_after)
```

### Variable modifiée (exemple: couleur)

```markdown
- `brand/accent-500` : `#3B82F6` → `#2563EB`
```

### Variable ajoutée

```markdown
- `mapped/dropdown-bg` (nouveau) — `#FFFFFF`
```

### Breaking change

```markdown
> ⚠️ **`alias/old-accent` supprimée** — Remplacez par `alias/accent-500`
```

Le formateur ne doit JAMAIS lister les variantes individuelles en texte brut. Il doit résumer par propriété.

---

## Résumé : brut vs IA

| Aspect | Formateur code (sans clé API) | Avec IA (clé OpenAI/Anthropic) |
|--------|-------------------------------|-------------------------------|
| Structure des sections | ✅ Identique (template fixe) | ✅ Identique |
| Résumé des variantes | ✅ "Propriété Theme supprimée, −2 variantes" | ✅ "Le composant field a été simplifié en retirant la propriété Theme, désormais inutile" |
| Guide de migration | ✅ "Remplacez X par Y" (si détectable) | ✅ + contexte ("cette variable était utilisée pour... remplacez par...") |
| Regroupement intelligent | ❌ Groupé par catégorie uniquement | ✅ Peut regrouper par intention ("refonte du module formulaire") |
| Lisibilité | 🟡 Correcte, technique | ✅ Naturelle, comme écrite par un humain |
| Coût | Gratuit | ~$0.01-0.03 par patchnote |

**Recommandation** : implémenter le formateur code maintenant (gratuit, 80% du résultat). Ajouter l'IA plus tard quand tu auras une clé API — elle viendra enrichir le texte sans changer la structure.

---

## Checklist (ordre d'implémentation)

- [ ] **CRITIQUE** : Fix comparaison text styles par nom au lieu de par ID dans lib/diff.ts
- [ ] **CRITIQUE** : Vérifier et fixer le même problème d'IDs pour composants et variables
- [ ] Restructurer old_value/new_value dans le diff pour stocker des objets typés (pas du texte)
- [ ] Créer `ComponentDiffDetail.tsx` — affichage structuré des changements de composants
- [ ] Créer `VariableDiffDetail.tsx` — affichage avec aperçu couleur
- [ ] Créer `TextStyleDiffDetail.tsx` — affichage des changements typo
- [ ] Intégrer ces 3 composants dans `DiffItemList.tsx`
- [ ] Améliorer `patchnote-formatter.ts` pour produire du markdown lisible (pas de dump de variantes)

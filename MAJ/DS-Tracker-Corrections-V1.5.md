# DS Tracker — Corrections V1.5

---

## 1. SUPPRIMER les text styles du diff — solution définitive

Puisque les corrections précédentes pour fixer la comparaison par nom n'ont pas été appliquées par Cursor malgré 4 tentatives, voici la solution la plus simple et la plus fiable :

**SUPPRIMER ENTIÈREMENT le tracking des text styles du diff pour la V1.**

Les text styles ne changent quasiment jamais dans ce DS (c'est la même liste de 14 styles depuis le début). Les IDs entre branche et main sont toujours différents dans Figma, ce qui rend le diff impossible sans un fix complexe. Si un text style change un jour, le designer l'ajoutera manuellement dans le patchnote.

### Action

Trouver le code qui collecte les text styles dans le snapshot et le désactiver :

```typescript
// CHERCHER dans lib/diff.ts ou lib/figma.ts :
// Tout code qui fetch les text styles, les compare, ou crée des diff items
// avec category === 'text_style'

// SOLUTION : 
// 1. Ne plus fetcher les text styles dans le snapshot
// 2. Ou filtrer les diff items pour exclure text_style :
const filteredDiffItems = diffItems.filter(item => item.category !== 'text_style');
```

Chercher avec grep :
```bash
grep -rn "text.style\|textStyle\|text_style\|TextStyle" --include="*.ts" --include="*.tsx" .
```

Et commenter/supprimer tout ce qui concerne les text styles dans le diff.

---

## 2. Variables manquantes — 3 nouvelles variables Mapped non détectées

### Problème

La branche a 122 variables Mapped, le main en a 119. Il y a 3 nouvelles variables qui ne remontent PAS dans le diff :
- `Surface/light accent hover` (NOUVEAU)
- `Surface/unselected` (NOUVEAU)
- `Surface/unselected hover` (NOUVEAU)

### Cause probable

Le même bug que les text styles : les IDs des variables sont probablement différents entre branche et main, et le diff compare par ID au lieu de par nom.

### Fix

Appliquer la même logique que pour les composants : comparer les variables par NOM (pas par ID), en groupant par collection.

```typescript
// Pour les variables : comparer par "collection/name" comme clé unique
function getVariableKey(variable: any): string {
  return `${variable.collectionName}/${variable.name}`;
}

// Construire les maps par nom au lieu de par ID
const mainVarsMap = new Map(mainVariables.map(v => [getVariableKey(v), v]));
const branchVarsMap = new Map(branchVariables.map(v => [getVariableKey(v), v]));

// Trouver les ajouts (dans branche, pas dans main)
for (const [key, branchVar] of branchVarsMap) {
  if (!mainVarsMap.has(key)) {
    diffItems.push({
      category: 'variable',
      change_type: 'added',
      item_name: branchVar.name,
      collection_name: branchVar.collectionName,
      new_value: branchVar.valuesByMode,
      // ...
    });
  }
}

// Trouver les suppressions (dans main, pas dans branche)
for (const [key, mainVar] of mainVarsMap) {
  if (!branchVarsMap.has(key)) {
    diffItems.push({
      category: 'variable',
      change_type: 'removed',
      is_breaking: true,
      // ...
    });
  }
}

// Trouver les modifications (même nom, valeur différente)
for (const [key, branchVar] of branchVarsMap) {
  const mainVar = mainVarsMap.get(key);
  if (mainVar) {
    if (JSON.stringify(branchVar.valuesByMode) !== JSON.stringify(mainVar.valuesByMode)) {
      diffItems.push({
        category: 'variable',
        change_type: 'modified',
        // ...
      });
    }
  }
}
```

### Test de vérification

Après le fix, le diff de la branche `[NC] Dropdown` DOIT afficher :
- 3 nouvelles variables dans la section "Nouvelles variables" > collection Mapped :
  - `Surface/light accent hover`
  - `Surface/unselected`
  - `Surface/unselected hover`

---

## 3. Supprimer le textarea du patchnote — pour de bon

Le textarea markdown en bas de page DOIT être supprimé. Il est redondant, indigeste, et les devs ne savent pas écrire du markdown.

### Ce qu'il faut supprimer

Supprimer de la page d'édition (`/versions/[id]/edit`) :
- Le champ "Titre de la version"
- Le champ "Numéro de version"
- Le textarea "Contenu du patchnote"
- Le bouton "Prévisualiser" qui ouvre la modale

### Ce qu'il faut garder/ajouter à la place

Le titre et la version sont éditables directement dans le header de la page :

```tsx
<div className="flex items-center gap-3 mb-6">
  <input
    value={versionNumber}
    onChange={(e) => setVersionNumber(e.target.value)}
    className="font-mono text-sm text-gray-400 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-gray-800 focus:outline-none w-14 transition-colors"
    placeholder="v1.0"
  />
  <span className="text-gray-300 text-lg">—</span>
  <input
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    className="text-xl font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-gray-800 focus:outline-none flex-1 transition-colors"
    placeholder="Titre du patchnote..."
  />
</div>
```

Le résumé IA est affiché SANS scroll, hauteur auto :

```tsx
{summary && (
  <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
    {summary}
  </div>
)}
```

**IMPORTANT** : ne pas mettre `overflow: auto`, `overflow: hidden`, `max-height`, ou `overflow-y: scroll` sur le résumé. Il doit s'afficher en entier, à sa hauteur naturelle.

Le bouton "Prévisualiser" est remplacé par un lien vers la vue publique `/changelog/{versionNumber}` (visible seulement si publié).

---

## 4. Textarea de description par item — auto-resize, pas de scroll

Les descriptions éditables sur chaque diff item ne doivent JAMAIS avoir de scrollbar. Elles grandissent automatiquement avec le contenu.

```tsx
<textarea
  ref={(el) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }}
  value={descriptions[item.id] || item.description || ''}
  onChange={(e) => {
    updateDesc(item.id, e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }}
  className="w-full text-sm text-gray-500 bg-transparent resize-none border-0 p-0 focus:ring-0 focus:outline-none leading-relaxed"
  style={{ overflow: 'hidden' }}
  rows={1}
  placeholder="Note pour les devs..."
/>
```

Points clés :
- `resize-none` : pas de poignée de resize
- `overflow: hidden` : pas de scroll
- `rows={1}` : commence petit
- Auto-resize au onChange ET au mount (via ref)

---

## 5. Badges simplifiés — une seule pastille par item

### Problème

Chaque item a trop de badges : "Supprimé" + "Composant" + "Breaking". C'est du bruit visuel.

### Solution

**Un seul badge de type de changement par item** : Ajouté (vert), Modifié (bleu), Supprimé (rouge). C'est tout.

Supprimer :
- Le badge "Composant" / "Variable" / "Text Style" / "Page" → l'info est déjà visible par la catégorie dans laquelle l'item est groupé
- Le badge "Breaking" → le remplacer par une petite icône ⚠️ à côté du badge existant si l'item est un breaking change

```tsx
<div className="flex items-center gap-2">
  <span className="text-[15px] font-semibold text-gray-900">{item.item_name}</span>
  
  {/* UN SEUL badge */}
  {item.change_type === 'added' && (
    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Ajouté</span>
  )}
  {item.change_type === 'modified' && (
    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Modifié</span>
  )}
  {item.change_type === 'removed' && (
    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Supprimé</span>
  )}
  
  {/* Indicateur breaking discret */}
  {item.is_breaking && (
    <span className="text-amber-500 text-sm" title="Breaking change">⚠️</span>
  )}
  
  {/* Composant interne */}
  {item.is_internal && (
    <span className="text-[11px] text-gray-400 italic">interne</span>
  )}
</div>
```

---

## 6. Sous-composants — mentionner le parent

Quand un composant interne (préfixé par ".") apparaît dans le diff, ajouter automatiquement une mention de son composant parent.

La table de correspondance est fixe :

```typescript
const INTERNAL_TO_PARENT: Record<string, string[]> = {
  '.suffix': ['field'],
  '.toggle-item': ['Toggle'],
  '.toggle-form-item': ['Toggle form'],
  '.menuItem': ['menu'],
  '.notifications alert': ['menu'],
  '.checkbox': ['Checkbox', 'CheckboxCard'],
  '.radio button': ['Radio button', 'RadioCard'],
  '.switchItem': ['switch'],
  '.tab item': ['tab container'],
  '.cell item': ['Table'],
  '.cell': ['Table'],
  '.popupIcon': ['Popup'],
  '.item-dropdown': ['Dropdown'],  // Nouveau
  '.line background': ['slider'],
  '.line selected': ['slider'],
  '.legend': ['slider'],
  '.dot': ['slider'],
  '.column': ['Table'],
  '.Column table': ['Table'],
  '.row': ['Table'],
};
```

Dans l'affichage :

```tsx
{item.is_internal && INTERNAL_TO_PARENT[item.item_name] && (
  <p className="text-xs text-gray-400 mt-1">
    Sous-composant de {INTERNAL_TO_PARENT[item.item_name].map(p => (
      <span key={p} className="font-medium text-gray-500">{p}</span>
    )).reduce((a, b) => [a, ', ', b])}
  </p>
)}
```

---

## 7. Refonte design — fond bleu marine

### Nouveau thème

Remplacer le fond `#FAFAFA` par un fond bleu marine foncé. Les cartes blanches ressortiront bien.

```css
/* Layout principal */
body, .app-layout {
  background-color: #0F172A;  /* slate-900 — bleu marine foncé */
}

/* Header */
header {
  background-color: rgba(15, 23, 42, 0.85); /* slate-900 semi-transparent */
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

header .logo, header nav a {
  color: #E2E8F0; /* slate-200 */
}
header nav a:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.06);
}

/* Cartes (diff items, résumé, etc.) */
.card {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* Titres de catégories */
.category-label {
  color: #94A3B8; /* slate-400 */
}
.category-line {
  background: rgba(255, 255, 255, 0.06);
}

/* Boutons d'action (en bas sticky) */
.action-bar {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* Bouton Publier */
.btn-publish {
  background: #3B82F6;  /* bleu vif */
  color: white;
  border-radius: 12px;
}
.btn-publish:hover {
  background: #2563EB;
}

/* Bouton Sauvegarder */
.btn-draft {
  background: rgba(255, 255, 255, 0.08);
  color: #E2E8F0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
.btn-draft:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* Bouton Supprimer */
.btn-delete {
  color: #F87171;
}

/* Badge status Draft/Publié dans le header */
.badge-draft {
  background: rgba(255, 255, 255, 0.08);
  color: #94A3B8;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.badge-published {
  background: rgba(16, 185, 129, 0.1);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

/* Titre de la page (éditable) */
.page-title input {
  color: #F8FAFC; /* slate-50 */
}
.version-number input {
  color: #64748B; /* slate-500 */
}

/* Le résumé IA */
.summary-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  color: #CBD5E1; /* slate-300 */
}
```

### Avec Tailwind

```tsx
{/* Layout */}
<div className="min-h-screen bg-slate-900">
  
  {/* Header */}
  <header className="sticky top-0 z-10 bg-slate-900/85 backdrop-blur-xl border-b border-white/[0.06]">
    <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-200">DS Tracker</span>
    </div>
  </header>
  
  {/* Contenu */}
  <main className="max-w-5xl mx-auto px-6 py-8">
    
    {/* Titre éditable */}
    <div className="flex items-center gap-3 mb-6">
      <input className="font-mono text-sm text-slate-500 bg-transparent ..." />
      <span className="text-slate-600">—</span>
      <input className="text-xl font-semibold text-slate-50 bg-transparent ..." />
      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.08] text-slate-400 border border-white/10">
        Draft
      </span>
    </div>
    
    {/* Résumé IA */}
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-8 text-sm text-slate-300 leading-relaxed">
      {summary}
    </div>
    
    {/* Header de catégorie */}
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-2 h-2 rounded-full bg-amber-400" />
      <span className="text-[13px] font-medium text-slate-400">Breaking changes</span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-500">{count}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
    
    {/* Diff item card — RESTE BLANCHE */}
    <div className="bg-white rounded-2xl p-5 shadow-sm mb-2">
      {/* Contenu de l'item */}
    </div>
    
  </main>
  
  {/* Barre d'action sticky en bas */}
  <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/[0.06] px-6 py-3">
    <div className="max-w-5xl mx-auto flex items-center justify-between">
      <button className="text-red-400 text-sm hover:text-red-300">Supprimer</button>
      <div className="flex gap-3">
        <button className="px-5 py-2.5 bg-white/[0.08] text-slate-200 rounded-xl text-sm border border-white/10 hover:bg-white/[0.12]">
          Sauvegarder le draft
        </button>
        <button className="px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600">
          Publier
        </button>
      </div>
    </div>
  </div>
</div>
```

**Note** : seule la partie admin (édition des patchnotes) utilise le fond bleu marine. La partie publique (`/changelog`) reste avec un fond clair pour la lisibilité des devs.

---

## Checklist

- [ ] **Supprimer** les text styles du diff entièrement (filtrer les items `category === 'text_style'`)
- [ ] **Fixer** la comparaison des variables par nom au lieu de par ID (3 variables manquantes)
- [ ] **Supprimer** le textarea markdown + champs titre/version en bas de page
- [ ] **Ajouter** titre + version éditables dans le header
- [ ] **Résumé IA** : pas de scroll, hauteur auto (`overflow: hidden`, pas de `max-height`)
- [ ] **Descriptions** : auto-resize textarea (`overflow: hidden` + auto height sur change et mount)
- [ ] **Badges** : un seul par item (Ajouté/Modifié/Supprimé), supprimer Composant/Variable/Breaking. Icône ⚠️ discrète si breaking.
- [ ] **Sous-composants** : afficher le parent (`Sous-composant de Toggle, Toggle form`)
- [ ] **Design** : fond bleu marine `#0F172A` (slate-900) pour l'admin, cartes blanches, header blur, bouton Publier bleu vif
- [ ] **Page publique** : reste en fond clair

# DS Tracker — Corrections V1.3 : UX, faux positifs, design

> Ce document contient les corrections V1.3. À donner à Cursor APRÈS les corrections V1.1 et V1.2.

---

## 1. CRITIQUE — Le bug Text Styles n'est TOUJOURS PAS corrigé

Les text styles h1, h2, h3, body/normal, etc. apparaissent ENCORE comme "Supprimés". Le fix des V1.1 et V1.2 n'a pas été appliqué.

**Rappel du problème** : Figma donne des IDs différents aux text styles entre branche et main. La comparaison par ID échoue et traite tout comme supprimé.

**Action exacte** : chercher dans TOUT le code (probablement `lib/diff.ts` ou un fichier similaire) l'endroit où les text styles sont comparés. La recherche textuelle suivante devrait aider :

```
Chercher dans tout le projet :
- "textStyle" 
- "text_style"
- "getLocalTextStyles"
- "styles"
- "style.id"
- "style.key"
```

Trouver la ligne de comparaison et forcer le match par nom :

```typescript
// La ligne problématique ressemble probablement à :
const matchInMain = mainStyles.find(s => s.id === branchStyle.id);
// ou
const matchInMain = mainStyles.find(s => s.key === branchStyle.key);
// ou
const matchInMain = mainStyles.find(s => s.style_key === branchStyle.style_key);

// REMPLACER PAR :
const matchInMain = mainStyles.find(s => s.name === branchStyle.name);
```

Si le code utilise un objet Map indexé par ID, le convertir en Map indexé par nom pour les text styles.

---

## 2. Supprimer le textarea de patchnote — édition inline à la place

### Problème

Le textarea markdown en bas de page est inutilisable. Le designer ne peut pas facilement modifier le contenu car il faut écrire du markdown brut. De plus, le contenu est dupliqué (les diff items EN HAUT + le markdown EN BAS disent la même chose).

### Solution : édition inline directement sur les éléments

Supprimer complètement la section "Patchnote" avec le textarea et les champs titre/version. À la place :

**Le titre et le numéro de version** deviennent éditables en haut de la page :

```tsx
<div className="flex items-center gap-4 mb-8">
  <input
    value={versionNumber}
    onChange={(e) => setVersionNumber(e.target.value)}
    className="text-sm font-mono bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-900 focus:outline-none w-16 transition-colors"
    placeholder="v1.0"
  />
  <span className="text-gray-300">—</span>
  <input
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    className="text-2xl font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-900 focus:outline-none flex-1 transition-colors"
    placeholder="Titre du patchnote"
  />
</div>
```

**Chaque diff item** a un champ de description éditable :

```tsx
<div className="diff-item">
  {/* Header avec badges */}
  <div className="flex items-center gap-2">
    <DiffIcon type={item.change_type} />
    <span className="font-medium">{item.item_name}</span>
    <Badge type={item.change_type} />
    {item.is_breaking && <Badge type="breaking" />}
  </div>
  
  {/* Description auto-générée, éditable au clic */}
  <div className="mt-2">
    <textarea
      value={itemDescriptions[item.id] || item.description}
      onChange={(e) => updateDescription(item.id, e.target.value)}
      className="w-full text-sm text-gray-600 bg-transparent resize-none border border-transparent rounded-md px-2 py-1 hover:border-gray-200 focus:border-gray-300 focus:outline-none focus:bg-white transition-colors"
      rows={2}
      placeholder="Ajouter une description pour les devs..."
    />
  </div>
  
  {/* Contenu structuré (ComponentDiffDetail, etc.) */}
  {/* Screenshots si applicable */}
</div>
```

**Le markdown est généré automatiquement** à partir des diff items visibles (non exclus) et de leurs descriptions. Pas besoin de l'écrire à la main. Le bouton "Prévisualiser" ouvre une modale avec le rendu HTML du markdown généré.

**Le flux devient** :
1. Le designer voit les changements détectés, chacun avec sa description auto-générée
2. Il peut éditer chaque description individuellement (au clic, le champ devient un textarea)
3. Il peut exclure des items (bouton X)
4. Il peut réordonner les items (drag & drop, optionnel V2)
5. Quand il clique "Publier", le markdown est généré à partir des items restants et leurs descriptions

---

## 3. Éviter les faux positifs — changements de position uniquement

### Problème

Le diff détecte un changement quand un composant a bougé sur le canvas (position x/y différente) même si rien n'a changé dans sa structure. Le screenshot avant/après montre la même chose visuellement, ce qui est confus.

### Solution

**Ne PAS comparer les propriétés suivantes** dans le diff des composants :
- `x`, `y` (position sur le canvas)
- `width`, `height` du component set lui-même (le cadre qui contient les variantes — sa taille change quand on réorganise les variantes sur le canvas, sans impact sur le composant)

**Comparer UNIQUEMENT** :
- Nom du composant
- Nombre de variantes
- Noms des variantes (les combinaisons Type=X, Status=Y)
- Propriétés de variante (noms et options)
- Propriétés booléennes, texte, instance swap

```typescript
// Dans lib/diff.ts, lors de la comparaison d'un composant :

function isComponentChanged(branchComp: any, mainComp: any): boolean {
  // NE PAS comparer : x, y, width, height, absoluteTransform
  
  // Comparer le nom
  if (branchComp.name !== mainComp.name) return true;
  
  // Comparer le nombre de variantes
  if (branchComp.variantCount !== mainComp.variantCount) return true;
  
  // Comparer les noms de variantes (triés pour ignorer l'ordre)
  const branchVariants = [...branchComp.variants].sort();
  const mainVariants = [...mainComp.variants].sort();
  if (JSON.stringify(branchVariants) !== JSON.stringify(mainVariants)) return true;
  
  // Comparer les propriétés (triées par nom)
  const branchProps = [...branchComp.properties].sort((a, b) => a.name.localeCompare(b.name));
  const mainProps = [...mainComp.properties].sort((a, b) => a.name.localeCompare(b.name));
  if (JSON.stringify(branchProps) !== JSON.stringify(mainProps)) return true;
  
  return false; // Aucun changement structurel
}
```

### Pour les screenshots

Ne montrer le screenshot avant/après QUE si le changement est visuel (variantes ajoutées/supprimées, pas juste un renommage de propriété). Logique :

```typescript
function shouldShowScreenshot(item: DiffItem): boolean {
  if (item.change_type === 'added') return true;  // Toujours montrer les nouveaux
  if (item.change_type === 'removed') return true; // Toujours montrer les supprimés
  
  if (item.change_type === 'modified') {
    const newVal = item.new_value as any;
    // Montrer le screenshot SI des variantes ont été ajoutées ou supprimées
    if (newVal?.addedVariants?.length > 0) return true;
    if (newVal?.removedVariants?.length > 0) return true;
    // NE PAS montrer si c'est juste un renommage de propriété
    if (newVal?.addedProps || newVal?.removedProps) {
      // Vérifier si c'est un renommage (même options, nom différent)
      // Dans ce cas, pas de screenshot
      if (newVal?.addedVariants?.length === 0 && newVal?.removedVariants?.length === 0) return false;
    }
    return false;
  }
  
  return false;
}
```

---

## 4. Cas CheckboxCard — un vrai changement, mais mal présenté

Le diff détecte que CheckboxCard a changé. C'est un vrai changement :

**Sur main** : propriétés `Status` (Selected/Unselected) et `State` (Default/Hover/Disabled)
**Sur branche** : propriétés renommées en `Type` (Selected/Unselected) et `Status` (Default/Hover/Disabled)

Les noms de propriétés ont changé → c'est un breaking change pour les devs. Mais le screenshot avant/après est identique visuellement → confus.

**Comment présenter ça** :

```tsx
// Quand le changement est un renommage de propriétés, afficher :
<div className="mt-2 space-y-1">
  <p className="text-sm font-medium text-amber-700">Propriétés renommées :</p>
  <div className="flex items-center gap-2 text-sm">
    <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs">Status</code>
    <span className="text-gray-400">→</span>
    <code className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs">Type</code>
  </div>
  <div className="flex items-center gap-2 text-sm">
    <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs">State</code>
    <span className="text-gray-400">→</span>
    <code className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs">Status</code>
  </div>
  <p className="text-xs text-gray-500 mt-1">Aucun changement visuel — seuls les noms de propriétés ont changé.</p>
</div>
```

Et PAS de screenshot dans ce cas.

---

## 5. Affichage des propriétés — plus visuel, avec couleurs ajout/suppression

### Problème actuel

Les propriétés d'un composant ajouté sont affichées dans des badges gris sans distinction. Quand des propriétés sont ajoutées ou supprimées sur un composant modifié, il n'y a pas de distinction visuelle.

### Solution

Pour les composants **ajoutés** — afficher les propriétés dans des "pills" avec les options :

```tsx
<div className="mt-3 space-y-2">
  {properties.map(prop => (
    <div key={prop.name} className="flex items-start gap-2">
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-gray-400">
          {/* Icône settings/sliders pour les variant props */}
          <path d="M2 4h4m4 0h4M2 8h8m2 0h2M2 12h2m4 0h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-xs font-medium text-gray-700">{prop.name}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {prop.options.map(opt => (
          <span key={opt} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {opt}
          </span>
        ))}
      </div>
    </div>
  ))}
</div>
```

Pour les composants **modifiés** — les props/options ajoutées en vert, supprimées en rouge :

```tsx
{/* Props ajoutées */}
{addedProps.map(prop => (
  <div key={prop.name} className="flex items-center gap-1.5">
    <span className="text-green-500 text-xs">+</span>
    <span className="text-xs font-medium text-green-700">{prop.name}</span>
    <div className="flex flex-wrap gap-1">
      {prop.options.map(opt => (
        <span key={opt} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
          {opt}
        </span>
      ))}
    </div>
  </div>
))}

{/* Props supprimées */}
{removedProps.map(prop => (
  <div key={prop.name} className="flex items-center gap-1.5">
    <span className="text-red-500 text-xs">−</span>
    <span className="text-xs font-medium text-red-700 line-through">{prop.name}</span>
    <div className="flex flex-wrap gap-1">
      {prop.options.map(opt => (
        <span key={opt} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 line-through">
          {opt}
        </span>
      ))}
    </div>
  </div>
))}

{/* Props inchangées */}
{unchangedProps.map(prop => (
  <div key={prop.name} className="flex items-center gap-1.5">
    <span className="text-gray-300 text-xs">·</span>
    <span className="text-xs text-gray-500">{prop.name}</span>
    <div className="flex flex-wrap gap-1">
      {prop.options.map(opt => (
        <span key={opt} className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">
          {opt}
        </span>
      ))}
    </div>
  </div>
))}
```

---

## 6. Refonte design — direction "rounded mignon" style Taskfly/Linear

### Nouvelle direction

L'app doit être plus douce, plus rounded, plus "friendly" que le style Vercel strict. Inspiration : Taskfly (kanban), Linear, les apps modernes à coins arrondis généreux.

### Tokens design mis à jour

```css
/* Coins arrondis — plus généreux */
--radius-sm: 8px;      /* boutons, badges, inputs */
--radius-md: 12px;     /* cartes, conteneurs */
--radius-lg: 16px;     /* modales, sections */
--radius-xl: 20px;     /* conteneurs principaux */
--radius-pill: 999px;  /* pills, tags, badges arrondis */

/* Ombres — subtiles et douces */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08);

/* Bordures */
--border-default: 1px solid #F0F0F0;     /* plus subtile qu'avant */
--border-hover: 1px solid #E0E0E0;

/* Couleurs de fond */
--bg-page: #FAFAFA;
--bg-card: #FFFFFF;
--bg-elevated: #FFFFFF;
--bg-muted: #F7F7F7;           /* fond des sections secondaires */
--bg-interactive: #F3F4F6;     /* hover sur les éléments cliquables */
```

### Cartes des diff items — nouveau style

```tsx
<div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all duration-200">
  {/* Contenu */}
</div>
```

### Badges — arrondis en pills

```tsx
<span className="text-xs px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
  Ajouté
</span>
<span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
  Modifié
</span>
<span className="text-xs px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
  Supprimé
</span>
<span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
  Breaking
</span>
```

### Boutons — plus doux

```tsx
{/* Primaire */}
<button className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
  Publier
</button>

{/* Secondaire */}
<button className="px-5 py-2.5 bg-white text-gray-700 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
  Sauvegarder le draft
</button>

{/* Danger */}
<button className="px-5 py-2.5 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
  Supprimer
</button>
```

### Headers de catégorie — style Taskfly

Au lieu du header texte MAJUSCULE actuel, utiliser un style plus doux :

```tsx
<div className="flex items-center gap-2 mb-3">
  <div className="w-2 h-2 rounded-full bg-amber-400" /> {/* Point coloré */}
  <span className="text-sm font-medium text-gray-500">Breaking changes</span>
  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{count}</span>
</div>
```

Les points de couleur par catégorie :
- Breaking changes : `bg-amber-400`
- Typographie : `bg-purple-400`
- Variables modifiées : `bg-blue-400`
- Nouveaux composants : `bg-green-400`
- Composants modifiés : `bg-sky-400`
- Nouvelles variables : `bg-teal-400`
- Structure : `bg-gray-400`

### Screenshots — dans des conteneurs arrondis

```tsx
<div className="mt-4 grid grid-cols-2 gap-4">
  <div>
    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Avant</span>
    <div className="mt-1.5 rounded-xl border border-gray-100 overflow-hidden bg-gray-50/50 p-3">
      <img src={beforeUrl} alt="Avant" className="w-full rounded-lg" />
    </div>
  </div>
  <div>
    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Après</span>
    <div className="mt-1.5 rounded-xl border border-gray-100 overflow-hidden bg-gray-50/50 p-3">
      <img src={afterUrl} alt="Après" className="w-full rounded-lg" />
    </div>
  </div>
</div>
```

### Navigation / Header

```tsx
<header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
  <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-gray-900">DS Tracker</span>
      <span className="text-gray-300">/</span>
      <span className="text-sm text-gray-500">Real Estate UI</span>
    </div>
    <nav className="flex items-center gap-1">
      {/* Nav items avec hover arrondi */}
      <a className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
        Accueil
      </a>
      <a className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
        Changelog
      </a>
    </nav>
  </div>
</header>
```

---

## 7. Le conteneur de catégorie global (la bordure pointillée) — à revoir

Le conteneur actuel avec la bordure jaune pointillée autour de "BREAKING CHANGES" est trop agressif visuellement. Le remplacer par une séparation plus légère :

```tsx
{/* AVANT : bordure pointillée jaune */}
{/* APRÈS : simple séparation avec point coloré */}
<div className="space-y-3">
  <div className="flex items-center gap-2 pt-6 first:pt-0">
    <div className="w-2 h-2 rounded-full bg-amber-400" />
    <span className="text-sm font-medium text-gray-500">Breaking changes</span>
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{count}</span>
    <div className="flex-1 h-px bg-gray-100" /> {/* Ligne horizontale subtile */}
  </div>
  
  <div className="space-y-2 pl-4"> {/* Items avec léger indent */}
    {items.map(item => (
      <DiffItemCard key={item.id} item={item} />
    ))}
  </div>
</div>
```

---

## Checklist (ordre d'implémentation)

- [ ] **CRITIQUE** : Fixer le bug text styles (chercher la comparaison par ID dans tout le code et la remplacer par nom). Tester en relançant le diff — les text styles ne doivent plus apparaître.
- [ ] Supprimer le textarea de patchnote markdown + les champs titre/version en bas
- [ ] Ajouter le titre et numéro de version éditables EN HAUT de la page
- [ ] Rendre la description de chaque diff item éditable inline
- [ ] Implémenter la logique anti-faux-positifs (ignorer x/y/width/height du component set)
- [ ] Masquer les screenshots quand le changement est structurel uniquement (renommage props)
- [ ] Afficher les props ajoutées en vert et supprimées en rouge (style pills)
- [ ] Refonte du design : border-radius 16-20px, ombres douces, badges pills arrondis
- [ ] Remplacer les conteneurs à bordure pointillée par des séparations légères avec point coloré
- [ ] Header avec backdrop blur et navigation arrondie

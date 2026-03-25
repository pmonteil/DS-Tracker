# DS Tracker — Corrections V1.4 : Fix text styles, prompt IA, récap

---

## 1. FIX TEXT STYLES — Instructions chirurgicales

Le bug des text styles persiste après 3 versions de corrections. Voici exactement ce qu'il faut faire.

### Étape 1 : Trouver le code responsable

Exécuter cette commande dans le terminal du projet pour trouver TOUS les fichiers qui mentionnent les text styles :

```bash
grep -rn "text.style\|textStyle\|text_style\|getLocalTextStyles\|TextStyle\|style_key\|styleKey" --include="*.ts" --include="*.tsx" .
```

### Étape 2 : Comprendre le bug

Le problème est que Figma génère des IDs DIFFÉRENTS pour les text styles entre une branche et le fichier main. Les 14 text styles existent à l'identique sur la branche et sur main (mêmes noms, mêmes valeurs), mais avec des IDs différents.

Quand le diff compare les text styles de la branche avec ceux de main par ID, il ne trouve aucun match → il traite les 14 styles de main comme "supprimés" et les 14 de la branche comme "ajoutés". C'est un faux positif total.

### Étape 3 : Le fix exact

Il y a probablement un endroit dans le code qui fait quelque chose comme ça :

```typescript
// PATTERN BUGUÉ — chercher quelque chose qui ressemble à ça :
for (const mainStyle of mainTextStyles) {
  const branchMatch = branchTextStyles.find(s => s.id === mainStyle.id);
  // ou : s.key === mainStyle.key
  // ou : s.node_id === mainStyle.node_id
  if (!branchMatch) {
    // → Marqué comme "supprimé" ← C'EST LE BUG
  }
}
```

Le fix est de remplacer TOUTE comparaison par ID par une comparaison par NOM pour les text styles :

```typescript
// FIX — comparer par nom
for (const mainStyle of mainTextStyles) {
  const branchMatch = branchTextStyles.find(s => s.name === mainStyle.name);
  if (!branchMatch) {
    // Vraiment supprimé (le nom n'existe plus)
    diffItems.push({ ... change_type: 'removed' ... });
  } else {
    // Comparer les propriétés (fontSize, fontStyle, lineHeight)
    if (mainStyle.fontSize !== branchMatch.fontSize || 
        mainStyle.fontStyle !== branchMatch.fontStyle ||
        JSON.stringify(mainStyle.lineHeight) !== JSON.stringify(branchMatch.lineHeight)) {
      diffItems.push({ ... change_type: 'modified' ... });
    }
    // Sinon : identique → pas de diff item
  }
}

// Vérifier les ajouts (dans branche mais pas dans main)
for (const branchStyle of branchTextStyles) {
  const mainMatch = mainTextStyles.find(s => s.name === branchStyle.name);
  if (!mainMatch) {
    diffItems.push({ ... change_type: 'added' ... });
  }
}
```

### Étape 4 : Vérification alternative

Si le code utilise l'API REST Figma pour récupérer les styles (GET /v1/files/:key/styles), les IDs retournés sont aussi différents entre branche et main. La seule propriété stable est le `name`.

Si le code utilise une Map ou un objet indexé par ID :

```typescript
// BUGUÉ
const mainStylesMap = new Map(mainStyles.map(s => [s.id, s]));
// ou
const mainStylesMap = Object.fromEntries(mainStyles.map(s => [s.key, s]));

// FIX
const mainStylesMap = new Map(mainStyles.map(s => [s.name, s]));
```

### Étape 5 : Tester

Après le fix, relancer le diff sur la branche `[NC] Dropdown`. Le résultat DOIT :
- Ne contenir AUCUN text style dans les changements (car aucun text style n'a changé entre la branche et main)
- Le compteur de changements doit diminuer de ~14 (les faux positifs supprimés)

---

## 2. Supprimer le textarea du patchnote en bas de page

Le textarea markdown en bas de page est redondant avec l'édition inline sur chaque diff item. Le supprimer entièrement.

Le patchnote markdown sera généré automatiquement à la publication à partir de :
- Le titre et numéro de version (éditables en haut)
- Les diff items restants (non exclus) avec leurs descriptions (éditables inline)
- Le tout formaté par le template + l'IA si disponible

L'éditeur de patchnote devient :
```
[Titre éditable] [N° version éditable]
[Boutons : Sauvegarder draft | Publier]

[Résumé IA — voir section 3]

[Diff items groupés par catégorie, chacun avec description éditable et bouton X]
```

Pas de textarea markdown. Le markdown est un output, pas un input.

---

## 3. Ajouter un résumé IA en haut du patchnote

Quand l'IA est disponible (clé API configurée), générer un **court paragraphe de résumé** qui apparaît en haut de la page d'édition ET du patchnote publié. Ce résumé doit :

- Faire 2-3 phrases maximum
- Dire en langage naturel ce que cette version apporte
- Mentionner s'il y a des breaking changes

Exemple :
> Cette version introduit le composant **Dropdown** avec 15 variantes, et renomme les propriétés de CheckboxCard et RadioCard pour plus de cohérence. Attention : 1 breaking change lié à la suppression du composant `.notifications alert`.

### Implémentation

Ajouter dans le prompt IA une demande de résumé :

```
En plus du patchnote détaillé, génère un résumé en 2-3 phrases qui apparaîtra en haut de la page. Ce résumé doit être en français, concis, et dire à un développeur ce qui est important dans cette version. Commence par les nouveautés, puis mentionne les breaking changes s'il y en a.

Format de retour attendu :
---RESUME---
[le résumé ici]
---PATCHNOTE---
[le patchnote détaillé ici]
```

Côté code, parser la réponse pour extraire le résumé et le patchnote séparément. Stocker le résumé dans un nouveau champ de la table `versions` :

```sql
ALTER TABLE versions ADD COLUMN summary TEXT;
```

Afficher le résumé dans un encadré sobre en haut :

```tsx
{version.summary && (
  <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-600 leading-relaxed">
    {version.summary}
  </div>
)}
```

---

## 4. Regroupement intelligent : page + composant associé

### Problème

Quand une nouvelle page `↳ Dropdown` est détectée dans "Structure du fichier", c'est forcément lié au nouveau composant Dropdown détecté dans "Nouveaux composants". Actuellement ils apparaissent dans deux sections séparées, ce qui est redondant.

### Solution

Si une page est ajoutée ET qu'un composant du même nom (ou similaire) est aussi ajouté, **fusionner les deux** dans la section "Nouveaux composants" et ne PAS afficher la page dans "Structure du fichier".

Logique :

```typescript
// Après avoir calculé tous les diff items :
const newPages = diffItems.filter(d => d.category === 'page' && d.change_type === 'added');
const newComponents = diffItems.filter(d => d.category === 'component' && d.change_type === 'added');

for (const page of newPages) {
  // Nettoyer le nom de la page (retirer "↳ " et les espaces)
  const cleanPageName = page.item_name.replace(/^\s*↳\s*/, '').trim().toLowerCase();
  
  // Chercher un composant ajouté avec un nom similaire
  const matchingComponent = newComponents.find(c => 
    c.item_name.toLowerCase().includes(cleanPageName) || 
    cleanPageName.includes(c.item_name.toLowerCase())
  );
  
  if (matchingComponent) {
    // Fusionner : ajouter l'info de la page dans le composant
    matchingComponent.description = (matchingComponent.description || '') + 
      ` Nouvelle page "${page.item_name}" créée dans Figma.`;
    // Marquer la page comme exclue du diff
    page.excluded = true;
  }
}
```

### Règle générale pour les pages

Les pages préfixées par `↳` sont toujours liées à un composant. Si :
- La page est ajoutée et le composant aussi → fusionner, ne montrer que le composant
- La page est ajoutée mais pas le composant → montrer dans "Structure du fichier"
- Le composant est ajouté mais pas la page → montrer normalement

---

## 5. Améliorer le prompt IA pour un patchnote templatisé

### Nouveau prompt système

Remplacer l'ancien prompt IA par celui-ci :

```
Tu es un rédacteur technique pour le design system "Real Estate UI". Tu reçois un diff JSON entre une branche Figma et le fichier principal. Ce design system est utilisé par des développeurs multi-stack (Quasar, React, Flutter).

OBJECTIF : Produire un patchnote clair, structuré et immédiatement actionnable par les développeurs.

FORMAT OBLIGATOIRE :

---RESUME---
[2-3 phrases en français résumant les changements clés de cette version. Commencer par les nouveautés, finir par les breaking changes s'il y en a.]
---PATCHNOTE---

[Suivre EXACTEMENT la structure ci-dessous. Omettre les sections vides.]

## Breaking changes ⚠️

Pour chaque breaking change, utiliser ce format :
> ⚠️ **[Nom]** — [Description courte du changement et pourquoi c'est un breaking change]
> 
> **Migration** : [Instructions concrètes pour les devs — quoi remplacer par quoi]

## Nouveaux composants

Pour chaque nouveau composant, utiliser ce format :
### [Nom du composant]
[1 phrase de description : à quoi sert ce composant et dans quel contexte l'utiliser]

| Propriété | Options |
|-----------|---------|
| [Nom]     | [Option1, Option2, ...] |

[Si une nouvelle page Figma est associée, mentionner : "Disponible dans Figma : page ↳ [Nom]"]

## Composants modifiés

Pour chaque composant modifié :
### [Nom du composant]
[1 phrase résumant le changement]
- [Détail 1 : ce qui a été ajouté/supprimé/modifié, en étant spécifique]
- [Détail 2 si nécessaire]

Si des propriétés ont été renommées, utiliser :
- Propriété `[ancien nom]` → `[nouveau nom]`

## Variables modifiées

Grouper par collection (Brand, Alias, Mapped, Responsive).
Pour chaque variable, format : `[nom]` : `[ancienne valeur]` → `[nouvelle valeur]`

## Nouvelles variables

Grouper par collection. Format : `[nom]` — `[valeur]`

RÈGLES :
- Langue : français
- Ton : technique, concis, direct. Pas de formules de politesse, pas de "dans cette version nous avons..."
- Les composants internes (préfixés par ".") sont des sous-composants. Les mentionner en lien avec leur parent : "Le sous-composant interne `.checkbox` a été modifié, ce qui impacte CheckboxCard."
- Ne JAMAIS lister les variantes individuelles (Status=Default, State=filled, ...). Résumer par propriétés : "5 variantes combinant Status (3 options) × State (2 options)"
- Pour les tableaux de propriétés, toujours utiliser le format markdown table
- Les breaking changes nécessitent TOUJOURS un guide de migration, même court
- Si un composant est renommé (ex: "Balise dynamique" → "Variable"), expliquer clairement aux devs qu'ils doivent mettre à jour leurs références
```

---

## 6. Améliorer le design des catégories dans le diff

Les catégories dans la section "Changements détectés" doivent utiliser le nouveau style rounded avec des points de couleur. Le design actuel avec des items trop espacés peut être compacté :

```tsx
{/* Conteneur de catégorie */}
<div className="mb-8">
  {/* Header de catégorie */}
  <div className="flex items-center gap-2.5 mb-3">
    <div className={`w-2 h-2 rounded-full ${categoryColor}`} />
    <span className="text-[13px] font-medium text-gray-500">{categoryLabel}</span>
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">{count}</span>
    <div className="flex-1 h-px bg-gray-100 ml-1" />
  </div>
  
  {/* Items — espace réduit entre eux */}
  <div className="space-y-2 pl-4">
    {items.map(item => (
      <div key={item.id} className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-all relative">
        {/* Bouton exclure */}
        <button 
          onClick={() => exclude(item.id)}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
        >
          ×
        </button>
        
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-semibold text-gray-900">{item.item_name}</span>
          <Badge type={item.change_type} />
          {item.is_internal && (
            <span className="text-[11px] text-gray-400 italic">composant interne</span>
          )}
          {item.is_breaking && <Badge type="breaking" />}
        </div>
        
        {/* Description éditable */}
        <textarea
          value={descriptions[item.id] || item.description}
          onChange={(e) => updateDesc(item.id, e.target.value)}
          className="mt-2 w-full text-sm text-gray-500 bg-transparent resize-none border-0 p-0 focus:ring-0 focus:outline-none placeholder-gray-300 leading-relaxed"
          rows={1}
          placeholder="Ajouter une note pour les devs..."
          onInput={(e) => {
            // Auto-resize textarea
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
          }}
        />
        
        {/* Contenu structuré */}
        {item.category === 'component' && <ComponentDiffDetail item={item} />}
        {item.category === 'variable' && <VariableDiffDetail item={item} />}
        
        {/* Screenshots inline */}
        {shouldShowScreenshot(item) && <ScreenshotComparison item={item} />}
      </div>
    ))}
  </div>
</div>
```

---

## 7. La page du patchnote publié doit aussi être améliorée

La page publique `/changelog/[version]` que les devs voient doit :

- Afficher le résumé en haut dans un encadré gris clair
- Avoir le patchnote rendu en HTML propre (pas du markdown brut)
- Les breaking changes dans des callouts orange/amber
- Les tableaux de propriétés bien stylisés
- Les screenshots intégrés dans les sections des composants
- Un lien "Voir dans Figma" en haut

---

## Checklist (ordre d'implémentation)

- [ ] **CRITIQUE** : Suivre les étapes 1 à 5 de la section 1 pour fixer le bug text styles. Exécuter le grep, trouver la ligne, la corriger, tester.
- [ ] Supprimer le textarea markdown et les champs titre/version en bas de page
- [ ] Titre et version éditables en haut de la page
- [ ] Ajouter le champ `summary` dans la table versions (`ALTER TABLE versions ADD COLUMN summary TEXT`)
- [ ] Mettre à jour le prompt IA avec le nouveau prompt (section 5)
- [ ] Parser la réponse IA pour séparer résumé et patchnote
- [ ] Afficher le résumé en haut de la page d'édition et de la page publique
- [ ] Implémenter la fusion page + composant associé (section 4)
- [ ] Améliorer le design des catégories et diff items (section 6)
- [ ] Améliorer la page publique du changelog (section 7)

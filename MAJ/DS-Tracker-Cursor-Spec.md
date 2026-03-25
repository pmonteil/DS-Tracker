# DS Tracker — Spec complète pour implémentation

> Ce document est le plan d'exécution complet de l'application **DS Tracker**, conçu pour être donné à Cursor comme contexte de projet. Il contient toutes les informations nécessaires pour implémenter l'application de A à Z, y compris la connexion Supabase via MCP.

---

## 1. Vision produit

DS Tracker est une application web qui permet au designer d'un Design System Figma de **tracker automatiquement les changements** entre une branche et le fichier principal, de **générer un patchnote structuré via IA**, de l'éditer, puis de le publier pour que les développeurs puissent suivre l'évolution du DS.

### Utilisateurs

- **Designer (admin)** : une seule personne (moi). Accès protégé par login. Peut générer des diffs, éditer et publier les patchnotes.
- **Développeurs (lecteurs)** : plusieurs équipes utilisant Quasar, React, Flutter. Accès public sans auth à la section changelog et documentation.

### Fichier Figma source

- **Nom** : Real Estate UI
- **File key** : `9ZjzJGJ07zCiTHMpbXB2j2`
- **Plan Figma** : Organization (accès aux webhooks et branches via API)
- **Workflow** : branches par batch de modifications, merge dans main après publication du patchnote

---

## 2. Stack technique

| Brique | Technologie | Rôle |
|--------|-------------|------|
| Frontend | **Next.js 14+ (App Router)** | Interface, SSR, API routes |
| Styling | **Tailwind CSS** | Utilitaire, minimaliste |
| Backend | **Next.js API Routes** | Logique serveur, appels APIs externes |
| Base de données | **Supabase** (free tier, piloté via MCP) | Stockage patchnotes, versions, images |
| Stockage images | **Supabase Storage** | Screenshots des composants |
| Auth | **Supabase Auth** | Login admin (email/password) |
| IA - Patchnote | **Multi-provider (adapter pattern)** | Génération du patchnote |
| Design source | **Figma REST API v1** | Branches, composants, variables, export images |
| Déploiement | **Vercel** | Hébergement, CI/CD |

### Variables d'environnement

```env
# Figma
FIGMA_ACCESS_TOKEN=           # Token personnel Figma (scope: file_read)
FIGMA_FILE_KEY=9ZjzJGJ07zCiTHMpbXB2j2

# IA Provider (switch entre anthropic et openai)
AI_PROVIDER=openai            # "anthropic" ou "openai"
ANTHROPIC_API_KEY=            # Si provider = anthropic
OPENAI_API_KEY=               # Si provider = openai
AI_MODEL=gpt-4o-mini          # Ou "claude-haiku-4.5", "claude-sonnet-4.6", etc.

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Adapter pattern IA

Créer un fichier `lib/ai.ts` avec une interface commune :

```typescript
interface AIProvider {
  generatePatchnote(diffJson: string, context: string): Promise<string>;
}
```

Deux implémentations : `AnthropicProvider` et `OpenAIProvider`. La sélection se fait via `AI_PROVIDER` dans l'env. Le prompt système est identique pour les deux providers (voir section 7).

---

## 3. Design et direction artistique

### Style visuel : Vercel / Notion / Linear

L'application DOIT avoir un design **minimaliste, clean, light-only** inspiré de Vercel, Notion et Linear :

- **Fond** : blanc pur `#FFFFFF` pour les surfaces principales, `#FAFAFA` pour le fond de page
- **Texte** : `#0A0A0A` primaire, `#6B7280` secondaire, `#9CA3AF` tertiaire
- **Bordures** : `#E5E7EB` subtiles, 1px, pas de box-shadow sauf focus rings
- **Accent** : une seule couleur d'accent, noir `#0A0A0A` pour les boutons primaires (style Vercel). Texte blanc sur bouton noir.
- **Typographie** : Inter (via Google Fonts) en 400 et 500 uniquement. Pas de 600, 700 ou bold agressif.
- **Border-radius** : 8px pour les cartes et inputs, 6px pour les boutons et badges
- **Espacement** : généreux, aéré. Minimum 16px entre les éléments, 24px entre les sections.

### Ce qu'il ne faut PAS faire

- Pas de gradient (nulle part)
- Pas de couleurs vives saturées pour la structure (réservées uniquement aux badges de statut)
- Pas d'ombres portées (box-shadow) sauf léger hover sur les cartes au survol : `0 1px 3px rgba(0,0,0,0.04)`
- Pas de background coloré sur les sections
- Pas de police décorative
- Pas de dark mode (light only)
- Pas d'icônes fancy — utiliser Lucide React avec des traits fins (stroke-width: 1.5)

### Couleurs de statut (les seules couleurs autorisées)

```
Vert (success/ajout)    : bg #ECFDF5, text #065F46, border #A7F3D0
Bleu (info/modif)       : bg #EFF6FF, text #1E40AF, border #BFDBFE
Rouge (danger/supprimé) : bg #FEF2F2, text #991B1B, border #FECACA
Orange (warning/break)  : bg #FFFBEB, text #92400E, border #FDE68A
Gris (neutre/draft)     : bg #F3F4F6, text #374151, border #D1D5DB
```

---

## 4. Structure du projet

```
app/
  layout.tsx                          # Layout global (Inter font, Tailwind)
  page.tsx                            # Accueil admin (protected)
  login/page.tsx                      # Page de login admin
  changelog/
    page.tsx                          # Liste publique des patchnotes (public)
    [versionNumber]/page.tsx          # Détail d'un patchnote (public)
  versions/
    [id]/edit/page.tsx                # Édition d'un patchnote (protected)
  docs/                               # (V2) Section documentation
    page.tsx                          # Index du storybook / composants
    [componentName]/page.tsx          # Fiche d'un composant
    download/page.tsx                 # Téléchargement des règles (.md / .cursorrules repo)
  api/
    figma/
      branches/route.ts              # GET - Liste des branches actives
      snapshot/route.ts              # POST - Snapshot d'un fichier (branche ou main)
      images/route.ts                # POST - Export images de composants
    diff/
      generate/route.ts             # POST - Génère diff + patchnote IA + screenshots
    versions/
      route.ts                       # GET (list) + POST (create)
      [id]/route.ts                  # GET + PATCH + DELETE
    auth/
      [...supabase]/route.ts        # Supabase auth handlers
lib/
  figma.ts                           # Client API Figma
  diff.ts                            # Algorithme de diff
  ai.ts                              # Adapter IA multi-provider
  ai-providers/
    anthropic.ts                     # Provider Claude
    openai.ts                        # Provider OpenAI
  supabase/
    server.ts                        # Client Supabase côté serveur
    client.ts                        # Client Supabase côté client
    middleware.ts                     # Middleware auth
  patchnote-template.ts             # Template structuré du patchnote
  types.ts                           # Types TypeScript partagés
components/
  layout/
    Header.tsx                       # Navigation
    AdminGuard.tsx                   # Protection des routes admin
  branches/
    BranchList.tsx                   # Liste des branches avec sélection
    BranchCard.tsx                   # Carte d'une branche
  versions/
    VersionList.tsx                  # Liste des versions publiées
    VersionCard.tsx                  # Carte d'une version
    PatchnoteEditor.tsx             # Éditeur markdown du patchnote
    DiffItemList.tsx                # Affichage des changements détectés
    ScreenshotComparison.tsx        # Avant/après d'un composant
  changelog/
    PatchnoteView.tsx               # Vue publique d'un patchnote rendu en HTML
    VersionSidebar.tsx              # Sidebar navigation versions
  ui/                                # Composants UI réutilisables
    Button.tsx
    Badge.tsx
    Card.tsx
    Input.tsx
    Loader.tsx
middleware.ts                        # Middleware Supabase Auth (protection routes /versions/*)
```

---

## 5. Base de données Supabase

### Créer les tables via MCP Supabase ou SQL :

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: versions
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_number TEXT NOT NULL,
  title TEXT NOT NULL,
  branch_name TEXT,
  branch_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  patchnote_md TEXT,
  diff_json JSONB,
  figma_file_key TEXT DEFAULT '9ZjzJGJ07zCiTHMpbXB2j2',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Table: diff_items
CREATE TABLE diff_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('component', 'variable', 'text_style', 'page')),
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'modified', 'removed')),
  item_name TEXT NOT NULL,
  item_id TEXT,
  old_value JSONB,
  new_value JSONB,
  is_breaking BOOLEAN DEFAULT FALSE,
  is_internal BOOLEAN DEFAULT FALSE,
  parent_component TEXT,
  family_page TEXT,
  description TEXT,
  screenshot_before TEXT,
  screenshot_after TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Table: snapshots (cache)
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_key TEXT NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('components', 'variables', 'pages')),
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_versions_status ON versions(status);
CREATE INDEX idx_versions_created ON versions(created_at DESC);
CREATE INDEX idx_diff_items_version ON diff_items(version_id);
CREATE INDEX idx_snapshots_file_key ON snapshots(file_key);

-- RLS policies
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diff_items ENABLE ROW LEVEL SECURITY;

-- Public read for published versions
CREATE POLICY "Published versions are visible to everyone"
  ON versions FOR SELECT
  USING (status = 'published');

-- Admin full access (authenticated users)
CREATE POLICY "Admin can do everything on versions"
  ON versions FOR ALL
  USING (auth.role() = 'authenticated');

-- Public read diff_items linked to published versions
CREATE POLICY "Diff items of published versions are visible"
  ON diff_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM versions
      WHERE versions.id = diff_items.version_id
      AND versions.status = 'published'
    )
  );

-- Admin full access on diff_items
CREATE POLICY "Admin can do everything on diff_items"
  ON diff_items FOR ALL
  USING (auth.role() = 'authenticated');
```

### Supabase Storage

Créer un bucket `screenshots` avec les policies suivantes :
- Public read (les devs doivent voir les images dans les patchnotes)
- Authenticated write (seul l'admin peut uploader)

Structure des fichiers dans le bucket :
```
screenshots/
  {version_id}/
    {component_name}_before.png
    {component_name}_after.png
```

---

## 6. API Figma — Endpoints utilisés

### 6.1 Lister les branches

```
GET https://api.figma.com/v1/files/{file_key}/branches
Headers: X-Figma-Token: {FIGMA_ACCESS_TOKEN}
```

Retourne un tableau de branches avec `key` (file_key de la branche) et `name`.

### 6.2 Récupérer les composants d'un fichier

```
GET https://api.figma.com/v1/files/{file_key}/components
Headers: X-Figma-Token: {FIGMA_ACCESS_TOKEN}
```

Retourne tous les composants publiés avec leurs metadata. Mais pour avoir les component sets et variantes, il vaut mieux utiliser :

```
GET https://api.figma.com/v1/files/{file_key}?depth=2
```

Puis parcourir l'arbre pour trouver les `COMPONENT_SET` nodes.

### 6.3 Récupérer les variables

```
GET https://api.figma.com/v1/files/{file_key}/variables/local
Headers: X-Figma-Token: {FIGMA_ACCESS_TOKEN}
```

> Note : cet endpoint est en beta. Il retourne toutes les collections et variables locales avec leurs valeurs par mode.

### 6.4 Récupérer les text styles

```
GET https://api.figma.com/v1/files/{file_key}/styles
Headers: X-Figma-Token: {FIGMA_ACCESS_TOKEN}
```

Retourne les styles publiés. Pour les détails (fontSize, fontFamily, etc.), il faut les extraire des nodes via `GET /v1/files/{file_key}?depth=2` en cherchant les nodes de type TEXT qui portent les styles, ou via `GET /v1/files/{file_key}/styles` combiné avec les données du file tree.

Alternative plus fiable : lors du snapshot, parcourir le file tree et extraire les text styles directement depuis les metadata de l'API `/files/:key` qui expose `styles` dans la réponse.

### 6.5 Exporter des images (screenshots)

```
GET https://api.figma.com/v1/images/{file_key}?ids={node_id}&format=png&scale=2
Headers: X-Figma-Token: {FIGMA_ACCESS_TOKEN}
```

Retourne une URL temporaire (14 jours) vers le PNG exporté. L'app doit télécharger l'image et la stocker dans Supabase Storage immédiatement.

Pour un **avant/après**, on exporte le même `node_id` depuis deux `file_key` différents (main et branche). Attention : le `node_id` peut ne pas exister dans main si c'est un nouveau composant — gérer le cas gracefully.

---

## 7. Algorithme de diff (`lib/diff.ts`)

### Entrées

Deux snapshots JSON : un de la branche, un de main. Chaque snapshot contient :
- `componentSets`: array de `{ id, name, variantCount, variants: string[], properties: { name, options }[], isInternal: boolean, pageName: string }`
- `standaloneComponents`: array de `{ id, name, isInternal: boolean, pageName: string, width: number, height: number }` — composants de type COMPONENT à la racine d'une page, PAS dans un COMPONENT_SET. Exclure les icônes (page Icons).
- `variables`: array de `{ id, name, collection, collectionName, resolvedType, valuesByMode }`
- `textStyles`: array de `{ id, name, fontSize, fontFamily, fontStyle, lineHeight, letterSpacing }`
- `pages`: array de `{ id, name, childCount }`

### Logique de diff

#### Composants (Component Sets ET Standalone Components) — parents ET enfants

Le diff opère sur DEUX listes combinées : les component sets (avec variantes) et les standalone components (sans variantes). La logique est la même pour les deux :

```
Pour chaque composant (set ou standalone) de la branche :
  - Chercher un match dans main par ID
  - Si pas trouvé par ID, chercher par nom (renommage possible)
  - Pas trouvé du tout → ADDED
  - Trouvé par ID mais nom différent → MODIFIED (renommage)
  - Trouvé, même nom :
    - Pour les component sets :
      - variantCount différent → MODIFIED (variantes ajoutées/supprimées)
      - variants[] différents → MODIFIED (détailler quelles variantes)
      - properties[] différentes → MODIFIED (props ajoutées/supprimées)
    - Pour les standalone components :
      - dimensions (width/height) significativement différentes → MODIFIED (optionnel, informatif)
    - Tout identique → pas de changement

Pour chaque composant de main absent de la branche :
  → REMOVED (breaking change)
```

**Composants standalone publics à tracker** (type COMPONENT, pas dans un COMPONENT_SET) :
- `Checkbox` (77:1471) — parent de `.checkbox`, page Checkbox
- `Radio button` (78:287) — parent de `.radio button`, page Radio
- `switch` (101:515) — parent de `.switchItem`, page Switch
- `breadcrum` (108:866) — seul composant de sa page
- `Overlay` (129:14263) — seul composant de sa page

**Composants standalone internes à tracker** :
- `.line background`, `.line selected`, `.legend`, `.dot` — enfants du slider
- `.column`, `.Column table`, `.row` — enfants de Table

**Convention important pour les composants internes** :
- Les composants dont le nom commence par `.` sont des sous-composants internes (enfants).
- Ils sont INCLUS dans le diff et marqués `isInternal: true`.
- Dans le patchnote, les enfants internes sont regroupés sous leur famille (la page Figma). Exemple : un changement sur `.checkbox` apparaît sous "Checkbox (famille)" avec la mention "sous-composant interne `.checkbox`".
- Le champ `pageName` de chaque component set permet de regrouper les composants par famille.

#### Variables

```
Pour chaque variable de la branche :
  - Chercher un match dans main par ID
  - Pas trouvé → ADDED
  - Trouvé :
    - nom différent → MODIFIED (renommage)
    - valeur différente (comparer valuesByMode) → MODIFIED
      - Stocker old_value et new_value pour afficher le changement
    - Tout identique → pas de changement

Pour chaque variable de main absente de la branche :
  → REMOVED (breaking change)
```

Pour les couleurs, convertir les valeurs RGBA en hex pour l'affichage : `{ r: 0.24, g: 0.39, b: 0.93, a: 1 }` → `#3D64ED`.

#### Text Styles (typographie)

```
Pour chaque text style de la branche :
  - Chercher un match dans main par ID
  - Pas trouvé → ADDED
  - Trouvé :
    - nom différent → MODIFIED (renommage)
    - fontSize, fontFamily, fontStyle, lineHeight ou letterSpacing différent → MODIFIED
      - Stocker les propriétés changées dans old_value/new_value
    - Tout identique → pas de changement

Pour chaque text style de main absent de la branche :
  → REMOVED (breaking change)
```

Les text styles trackés sont : h1, h2, h3, body/normal, body/link, body/semibold, body/medium, body small/normal, body small/semibold, body small/medium, caption/normal, caption/link, caption/semibold, mention.

#### Pages

```
Comparer les listes de pages par ID.
Ignorer les pages dont le nom commence par un emoji (🌇, 📐, 🧭, 💠, 🤖, 📕, 🔥) — ce sont des séparateurs.
Ignorer les pages vides (childCount === 0).
Pages nouvelles → ADDED
Pages disparues → REMOVED
```

### Sortie

Un tableau de `DiffItem[]` trié par priorité :
1. Breaking changes (removals) en premier
2. Text style modifications
3. Variable modifications
4. Nouveaux composants
5. Composants modifiés (groupés par famille/page, enfants internes sous leur parent)
6. Nouvelles variables
7. Changements de pages

---

## 8. Template de patchnote et prompt IA

### Ordre des sections du patchnote (strict)

Le patchnote est TOUJOURS structuré dans cet ordre. Les sections vides sont omises :

1. **Breaking changes** — Variables supprimées, composants supprimés, text styles supprimés, renommages qui cassent le code. Chaque breaking change inclut un guide de migration.
2. **Typographie** — Text styles modifiés (font-size, weight, line-height). Impact global sur tout le DS.
3. **Variables modifiées** — Groupées par collection (Brand → Alias → Mapped → Responsive). Ancienne valeur → nouvelle valeur.
4. **Nouveaux composants** — Description, variantes, propriétés, tokens utilisés. Screenshot inclus. Si un composant interne (enfant) a changé, le mentionner sous la famille parente.
5. **Composants modifiés** — Ce qui a changé (variantes, props). Groupés par famille (page). Les changements sur les enfants internes sont des sous-items de leur parent. Screenshot avant/après si pertinent.
6. **Nouvelles variables** — Variables ajoutées, groupées par collection.
7. **Nouveaux text styles** — Styles typographiques ajoutés.
8. **Structure du fichier** — Pages ajoutées/supprimées.

### Prompt système pour l'IA

```
Tu es un rédacteur technique spécialisé dans les design systems. Tu reçois un diff JSON entre une branche Figma et le fichier principal d'un design system nommé "Real Estate UI", utilisé par des équipes de développement multi-stack (Quasar, React, Flutter).

Génère un patchnote en markdown structuré à partir du diff fourni.

RÈGLES :
- Suis EXACTEMENT cet ordre de sections (omets les sections vides) :
  1. ## Breaking changes ⚠️
  2. ## Typographie
  3. ## Variables modifiées
  4. ## Nouveaux composants
  5. ## Composants modifiés
  6. ## Nouvelles variables
  7. ## Nouveaux text styles
  8. ## Structure du fichier
  3. ## Nouveaux composants
  4. ## Composants modifiés
  5. ## Nouvelles variables
  6. ## Structure du fichier

- Pour les breaking changes : inclus un guide de migration concis (quoi remplacer par quoi)
- Pour la typographie : indique le nom du style, ce qui a changé (ex: "h1 : font-size 40px → 36px")
- Pour les variables modifiées : indique l'ancienne et la nouvelle valeur, groupées par collection (Brand → Alias → Mapped → Responsive)
- Pour les nouveaux composants : liste les variantes et propriétés disponibles
- Pour les composants modifiés : détaille précisément ce qui a changé. GROUPE les changements par famille (= page Figma). Si un composant interne (préfixé par ".") a changé, mentionne-le comme sous-élément de sa famille. Exemple : "### Checkbox (famille)\n- Le sous-composant interne `.checkbox` a ajouté la variante X.\n- Impact : `Checkbox` et `CheckboxCard` utilisent `.checkbox` et seront visuellement impactés."
- Les pages vides et les pages dont le nom commence par un emoji (🌇, 📐, etc.) sont des séparateurs — ignore-les
- Ton : technique, concis, actionnable. Pas de formules de politesse.
- Format : markdown pur, pas de blocs de code sauf pour les noms de tokens/props
- Ne génère PAS de titre H1, le titre de la version sera ajouté par l'app
```

---

## 9. Screenshots des composants

### Flux pour les screenshots

Quand le diff détecte un composant ajouté ou modifié :

1. **Export depuis la branche** : appeler `GET /v1/images/{branch_key}?ids={component_set_id}&format=png&scale=2`
2. **Export depuis main** (si le composant existait) : appeler `GET /v1/images/{main_file_key}?ids={component_set_id}&format=png&scale=2`
3. **Télécharger** les PNGs depuis les URLs temporaires retournées par Figma
4. **Uploader** dans Supabase Storage : `screenshots/{version_id}/{component_name}_after.png` et `_before.png`
5. **Stocker les URLs** dans les colonnes `screenshot_before` et `screenshot_after` de la table `diff_items`

### Affichage

Dans le patchnote publié, afficher les screenshots en mode comparaison :
- Composant **ajouté** : uniquement le screenshot "après" avec un badge "Nouveau"
- Composant **modifié** : deux images côte à côte, "Avant" et "Après"
- Composant **supprimé** : uniquement le screenshot "avant" avec un badge "Supprimé"

---

## 10. Authentification

### Setup Supabase Auth

- Créer un seul compte admin via Supabase Dashboard (email/password)
- Pas de formulaire d'inscription dans l'app — on ne veut qu'un seul utilisateur admin
- Page `/login` avec un formulaire email/password simple (style Vercel login)
- Middleware Next.js qui protège les routes `/`, `/versions/*`
- Les routes `/changelog/*` et `/docs/*` sont publiques, pas de protection

### Middleware (`middleware.ts`)

```typescript
// Protéger ces routes :
const protectedPaths = ['/', '/versions'];
// Ces routes sont publiques :
const publicPaths = ['/login', '/changelog', '/docs', '/api/versions']; // GET public sur les versions publiées
```

---

## 11. Spécifications des écrans

### 11.1 Login (`/login`)

- Fond `#FAFAFA`, formulaire centré dans une carte blanche
- Logo "DS Tracker" en haut
- Champs email + password
- Bouton noir "Se connecter"
- Pas de lien "mot de passe oublié" ni "créer un compte"

### 11.2 Accueil admin (`/`)

Deux onglets en haut : **"Générer un diff"** | **"Mes patchnotes"**

**Onglet "Générer un diff"** :
- Titre de section : "Branches actives" avec un bouton refresh (icône Lucide `RefreshCw`)
- Liste des branches récupérées via API Figma, affichées en cartes cliquables
- Chaque carte : nom de la branche, description (si dispo), date relative
- La branche sélectionnée a une bordure noire `#0A0A0A` de 2px
- Bouton en bas : "Comparer avec main →" (noir, pleine largeur du conteneur)
- Au clic : loader avec texte progressif ("Récupération des données Figma...", "Calcul des différences...", "Génération du patchnote...")
- Quand terminé → redirection vers `/versions/{id}/edit`

**Onglet "Mes patchnotes"** :
- Liste de toutes les versions (drafts + publiées), triées par date desc
- Chaque ligne : numéro de version, titre, badge de statut (Draft gris / Publié vert), date
- Clic → `/versions/{id}/edit`

### 11.3 Éditeur de patchnote (`/versions/:id/edit`)

**Header** :
- Bouton retour "← Accueil"
- Titre : "Patchnote — {branch_name}"
- Badge de statut (Draft / Publié)

**Section "Changements détectés"** :
- Liste des diff_items avec icônes colorées :
  - `+` vert : ajout
  - `~` bleu : modification
  - `−` rouge : suppression
- Chaque item : nom du composant/variable, description courte du changement
- Cette section est en lecture seule (c'est le résultat du diff)

**Section "Screenshots"** (si des screenshots existent) :
- Grille de comparaisons avant/après pour chaque composant modifié
- Composants ajoutés : uniquement l'image "après"

**Séparateur**

**Section "Patchnote"** :
- Champ texte : "Titre de la version" (ex: "v1.5 — Composant Filter")
- Champ texte : "Numéro de version" (ex: "v1.5") — pré-rempli par incrémentation du dernier numéro
- Textarea large : contenu markdown du patchnote, pré-rempli par l'IA
- Un bouton "Prévisualiser" qui toggle entre l'éditeur markdown et le rendu HTML

**Boutons d'action** (en bas, sticky) :
- "Publier" (bouton noir) — change le status à `published`, set `published_at`
- "Sauvegarder le draft" (bouton outline)
- "Supprimer" (bouton texte rouge, avec confirmation)

### 11.4 Changelog public (`/changelog`)

- Header : "DS Tracker" + "Real Estate UI" + barre de recherche
- Liste chronologique des versions publiées
- Chaque carte : numéro de version, titre, date, badge "Breaking change" si au moins un diff_item est `is_breaking`
- Clic → `/changelog/{version_number}`

### 11.5 Détail d'un patchnote (`/changelog/:versionNumber`)

- Layout deux colonnes : contenu principal (large) + sidebar (étroite)
- **Contenu** :
  - Titre H1 : "{version_number} — {title}"
  - Metadata : date de publication, badge breaking si applicable
  - Lien "Voir dans Figma →" pointant vers `https://www.figma.com/design/9ZjzJGJ07zCiTHMpbXB2j2`
  - Rendu HTML du patchnote markdown (utiliser `react-markdown` avec `remark-gfm`)
  - Les breaking changes dans un encadré rouge/orange
  - Les screenshots intégrés entre les sections appropriées
- **Sidebar** :
  - "Toutes les versions" : liste des versions publiées, la version courante est mise en avant
  - Clic pour naviguer entre versions

---

## 12. Inventaire du Design System (référence)

Ce sont les données réelles du fichier Figma Real Estate UI au moment de la rédaction de ce document. Utile pour le contexte lors de la génération des patchnotes et pour la logique de diff.

### Structure des pages — annotations

Chaque page a un rôle précis. Le diff doit savoir quoi ignorer et quoi tracker.

```
🌇 Thumbnail              → IGNORER (couverture du fichier, pas un composant)
📐 Guidelines              → IGNORER (page vide, séparateur)
🧭 Token Setup             → IGNORER (specs internes pour les devs, récap des variables — les variables elles-mêmes sont trackées via les collections)
💠 CORE COMPONENTS         → IGNORER (page vide, séparateur de catégorie)
  ↳ Typography             → IGNORER en tant que page (vide, mais les text styles existent en tant que styles locaux, cf. section Text Styles ci-dessous)
  ↳ Icons                  → TRACKER : composant Icon
  ↳ Button                 → TRACKER : composant Button
  ↳ Label                  → TRACKER : composant label
  ↳ Field                  → TRACKER : composants field + .suffix (enfant)
  ↳ Input                  → TRACKER : composant Input
  ↳ Toggle                 → TRACKER : composants Toggle, Toggle form + .toggle-item, .toggle-form-item (enfants)
  ↳ Number Input           → TRACKER : composant NumberInput
  ↳ Dynamic Input          → TRACKER : composant Dynamic Input
  ↳ Balise dynamique       → TRACKER : composants Balise dynamique, balises dynamic list (2 publics sur cette page)
  ↳ Sliders                → TRACKER : composant slider (component set) + .line background, .line selected, .legend, .dot (4 enfants standalone)
  ↳ Select                 → TRACKER : composant select
  ↳ Menu                   → TRACKER : composant menu + .menuItem, .notifications alert (enfants)
  ↳ Checkbox               → TRACKER : composants Checkbox (standalone, parent), CheckboxCard (component set) + .checkbox (enfant component set)
  ↳ Radio                  → TRACKER : composants Radio button (standalone, parent), RadioCard (component set) + .radio button (enfant component set)
  ↳ Textarea               → TRACKER : composant textarea
  ↳ Switch                 → TRACKER : composant switch (standalone, parent) + .switchItem (enfant component set)
  ↳ Link                   → TRACKER : composant link
  ↳ Breadcrum              → TRACKER : composant breadcrum (standalone, sans variantes)
  ↳ Tab                    → TRACKER : composant tab container + .tab item (enfant)
  ↳ Avatar                 → TRACKER : composants Avatar, Avatar group (2 publics sur cette page)
  ↳ Tag                    → TRACKER : composant tag
  ↳ Badge                  → TRACKER : composant bage (note: typo dans le nom Figma, le vrai nom est "bage")
  ↳ Snackbar               → TRACKER : composant snackbar
  ↳ Progress bar           → TRACKER : composant progress bar
  ↳ Table                  → TRACKER : composant Table (component set) + .cell item, .cell (enfants component set) + .column, .Column table, .row (3 enfants standalone)
  ↳ Popup                  → TRACKER : composant Popup + .popupIcon (enfant)
  ↳ Overlay                → TRACKER : composant Overlay (standalone, sans variantes)
  ↳ Pills                  → TRACKER : composant pills
  ↳ Filter                 → TRACKER : composant Filter
🤖 AI COMPONENTS           → IGNORER (page vide, séparateur de catégorie)
  ↳ A venir !              → IGNORER (page vide)
📕 AI PATTERNS             → IGNORER (page vide, séparateur de catégorie)
  ↳ Container's header     → TRACKER : composant Containers header
🔥 DEMO                    → IGNORER (page vide, séparateur — contient des maquettes de démonstration, pas des composants)
```

**Règle pour le diff** : les pages dont le nom commence par un emoji de catégorie (🌇, 📐, 🧭, 💠, 🤖, 📕, 🔥) sont des séparateurs ou des pages spéciales à ignorer. Seules les pages préfixées par `↳` contiennent des composants à tracker.

### Relations parent / enfant par page (component set grouping)

Le diff DOIT tracker les composants parents ET enfants. Dans le patchnote, les changements sont groupés par "famille" (= la page Figma qui les contient). Un changement sur un enfant interne est affiché comme sous-élément de la famille.

| Page | Composants publics | Composants internes (enfants) |
|------|-------------------|-------------------------------|
| Field | `field` (set) | `.suffix` (set) |
| Toggle | `Toggle` (set), `Toggle form` (set) | `.toggle-item` (set), `.toggle-form-item` (set) |
| Balise dynamique | `Balise dynamique` (set), `balises dynamic list` (set) | — |
| Sliders | `slider` (set) | `.line background`, `.line selected`, `.legend`, `.dot` (4 standalone) |
| Menu | `menu` (set) | `.menuItem` (set), `.notifications alert` (set) |
| Checkbox | `Checkbox` (standalone, parent), `CheckboxCard` (set) | `.checkbox` (set) |
| Radio | `Radio button` (standalone, parent), `RadioCard` (set) | `.radio button` (set) |
| Switch | `switch` (standalone, parent) | `.switchItem` (set) |
| Tab | `tab container` (set) | `.tab item` (set) |
| Avatar | `Avatar` (set), `Avatar group` (set) | — |
| Table | `Table` (set) | `.cell item` (set), `.cell` (set), `.column`, `.Column table`, `.row` (3 standalone) |
| Popup | `Popup` (set) | `.popupIcon` (set) |

Les pages à composant unique sans enfant : Icons (`Icon`), Button (`Button`), Label (`label`), Input (`Input`), NumberInput (`NumberInput`), Dynamic Input (`Dynamic Input`), Select (`select`), Textarea (`textarea`), Link (`link`), Breadcrum (`breadcrum` — standalone), Tag (`tag`), Badge (`bage`), Snackbar (`snackbar`), Progress bar (`progress bar`), Overlay (`Overlay` — standalone), Pills (`pills`), Filter (`Filter`), Container's header (`Containers header`).

> **IMPORTANT pour le diff** : le fichier contient deux types de composants : des **component sets** (avec variantes, type `COMPONENT_SET`) et des **standalone components** (sans variantes, type `COMPONENT` à la racine d'une page). L'algorithme de diff DOIT scanner les deux types. Les component sets sont trouvés en cherchant `type === 'COMPONENT_SET'`. Les standalone components sont trouvés en cherchant `type === 'COMPONENT'` dont le parent N'EST PAS un `COMPONENT_SET`.

**Logique dans le patchnote** : quand un enfant interne change (ex: `.checkbox` ajoute une variante), le patchnote doit dire : "**Checkbox** (famille) — le sous-composant interne `.checkbox` a ajouté la variante X. Cela impacte `CheckboxCard` qui l'utilise."

### Text Styles (typographie) — trackables

Le fichier contient **14 text styles locaux** qui sont trackables via l'API Figma (`getLocalTextStyles` ou `GET /v1/files/:key/styles`). Ce sont les styles typographiques du DS. Tout changement (font-size, font-weight, line-height) doit être tracké dans le diff.

| Style | Font | Weight | Size | Line Height |
|-------|------|--------|------|-------------|
| `h1` | Inter | Bold | 40px | 50px |
| `h2` | Inter | Bold | 20px | 24px |
| `h3` | Inter | SemiBold | 16px | 20px |
| `body/normal` | Inter | Regular | 14px | 20px |
| `body/link` | Inter | Regular | 14px | 20px |
| `body/semibold` | Inter | SemiBold | 14px | 20px |
| `body/medium` | Inter | Medium | 14px | 20px |
| `body small/normal` | Inter | Regular | 12px | 12px |
| `body small/semibold` | Inter | SemiBold | 12px | 12px |
| `body small/medium` | Inter | Medium | 12px | 12px |
| `caption/normal` | Inter | Regular | 10px | 16px |
| `caption/link` | Inter | Regular | 10px | 20px |
| `caption/semibold` | Inter | SemiBold | 10px | 20px |
| `mention` | Inter | Regular | 8px | 4px |

> Note : ces text styles sont aussi reflétés dans les variables de la collection Responsive (h1/font size, h2/line height, etc.) qui ont des modes Desktop et Mobile. Un changement de text style peut donc être capté à deux niveaux : via le style lui-même ET via la variable Responsive si elles sont liées.

### Collections de variables

| Collection | Variables | Modes | Type | Exemples |
|-----------|-----------|-------|------|----------|
| **Brand** | 106 | Mode 1 | COLOR | `Foundation/Black`, `Foundation/White`, `Grey/10..900`, `Orange/10..900`, `Blue/10..900`, `Green/10..900`, `Red/10..900`, `Purple/10..900` |
| **Alias** | 108 | Mode 1 | COLOR + FLOAT | `Primary/10..900`, `Primary/Default`, `Border Width/sm`, `Border Radius/sm..lg`, `Scale/2..12` |
| **Mapped** | 119 | Mode 1 | COLOR | `border/default`, `border/negative`, `border/success`, `Surface/field`, `Surface/light-action`, `text/primary`, `text/secondary` |
| **Responsive** | 31 | Desktop, Mobile | FLOAT | `h1/font size`, `h1/line height`, `h2/font size`, `Device Size`, `button/Default/padding top & bottom`, `button/Default/padding left & right`, `gap/Gap icon-text` |

> Note sur la collection Responsive : elle est actuellement sous-utilisée. Seuls quelques composants (Button, Filter, CheckboxCard, Tag) ont leurs padding/radius liés à des variables Responsive. Les autres utilisent des valeurs brutes ou la variable générique `Scale/N`. Les changements de padding sur les composants non-liés ne seront PAS détectés automatiquement en V1.

### Composants publics — component sets (30)

| Composant | ID | Page | Variantes | Propriétés de variante |
|-----------|-----|------|-----------|----------------------|
| Icon | 26:462 | Icons | 5 | Size icon: Default, XS, XL, XXS, XXXS |
| Button | 28:528 | Button | 48 | Type (8 options), Status (3), Button size (2) |
| label | 33:3296 | Label | 2 | Type: Default, required |
| field | 33:3382 | Field | 10 | Status (5), State (2), Theme (1) |
| Input | 208:91 | Input | 10 | Status (5), State (2) |
| Toggle | 3171:3354 | Toggle | 2 | Size: Default, XS |
| Toggle form | 3171:3411 | Toggle | 2 | Size: Default, XS |
| NumberInput | 208:650 | Number Input | 10 | Status (5), State (2) |
| Dynamic Input | 818:4847 | Dynamic Input | 8 | Status (4), State (2) |
| balises dynamic list | 818:7178 | Balise dynamique | 2 | Property 1: Default, disabled |
| Balise dynamique | 818:7236 | Balise dynamique | 2 | Property 1: Default, disabled |
| slider | 765:393 | Sliders | 3 | Property 1: Default, no numbers, No scale |
| select | 208:347 | Select | 10 | Status (5), State (2) |
| menu | 38:723 | Menu | 2 | Property 1: Default, XS |
| CheckboxCard | 3171:374 | Checkbox | 6 | Status (2), State (3) |
| RadioCard | 3171:491 | Radio | 6 | Status (2), State (3) |
| textarea | 101:1083 | Textarea | 4 | Status (2), Type (2) |
| link | 108:619 | Link | 4 | Status: Default, Hover, disable, active |
| tab container | 3086:3503 | Tab | 2 | Size: Default, XS |
| Avatar | 108:1028 | Avatar | 42 | Size (3), Type (3), Status (2), Color (6) |
| Avatar group | 108:1115 | Avatar | 3 | Size: Default, XL, XS |
| tag | 113:776 | Tag | 6 | Status (3), State (2) |
| bage | 120:795 | Badge | 6 | Type (2), Status (2), Size (2) |
| snackbar | 121:1358 | Snackbar | 4 | State: Default, Success, Error, warning |
| progress bar | 121:1329 | Progress bar | 2 | Property 1: 10%, 100% |
| Table | 123:5966 | Table | 1 | Property 1: column |
| Popup | 129:14202 | Popup | 2 | Property 1: positive, negative |
| pills | 123:22337 | Pills | 12 | Color (6), Type (2) |
| Filter | 3076:528 | Filter | 6 | Property 1 (6), Size (2) |
| Containers header | 3086:445 | Container's header | 2 | Property 1: Default, XS |

### Composants publics — standalone sans variantes (5)

Ces composants sont de type `COMPONENT` (pas `COMPONENT_SET`). Ils n'ont pas de variantes mais sont des composants à part entière, souvent les parents qui assemblent des enfants internes.

| Composant | ID | Page | Rôle |
|-----------|-----|------|------|
| `Checkbox` | 77:1471 | Checkbox | Parent qui assemble `.checkbox` + label |
| `Radio button` | 78:287 | Radio | Parent qui assemble `.radio button` + label |
| `switch` | 101:515 | Switch | Parent qui assemble `.switchItem` items |
| `breadcrum` | 108:866 | Breadcrum | Composant unique de navigation fil d'Ariane |
| `Overlay` | 129:14263 | Overlay | Composant de fond overlay plein écran |

### Composants internes — préfixés par "." (component sets)

| Composant interne | ID | Page (famille) | Parent(s) public(s) | Variantes |
|-------------------|-----|---------------|---------------------|-----------|
| `.suffix` | 818:5147 | Field | `field` | 2 |
| `.toggle-item` | 219:4747 | Toggle | `Toggle` | 6 |
| `.toggle-form-item` | 3171:3380 | Toggle | `Toggle form` | 6 |
| `.menuItem` | 36:714 | Menu | `menu` | 3 |
| `.notifications alert` | 38:2802 | Menu | `menu` | 2 |
| `.checkbox` | 77:1415 | Checkbox | `Checkbox` (standalone), `CheckboxCard` | 10 |
| `.radio button` | 78:50 | Radio | `Radio button` (standalone), `RadioCard` | 8 |
| `.switchItem` | 90:768 | Switch | `switch` (standalone) | 8 |
| `.tab item` | 219:4267 | Tab | `tab container` | 6 |
| `.cell item` | 123:1530 | Table | `Table` | 4 |
| `.cell` | 123:1892 | Table | `Table` | 3 |
| `.popupIcon` | 129:13802 | Popup | `Popup` | 4 |

### Composants internes — préfixés par "." (standalone, sans variantes)

| Composant interne | ID | Page (famille) | Parent public |
|-------------------|-----|---------------|---------------|
| `.line background` | 720:4691 | Sliders | `slider` |
| `.line selected` | 720:4692 | Sliders | `slider` |
| `.legend` | 720:4776 | Sliders | `slider` |
| `.dot` | 720:4694 | Sliders | `slider` |
| `.column` | 123:1898 | Table | `Table` |
| `.Column table` | 123:2179 | Table | `Table` |
| `.row` | 123:4562 | Table | `Table` |

---

## 13. Limitations connues et tracking partiel

### Ce que le diff tracke automatiquement (V1)

- **Component sets** : ajout, suppression, renommage, modification de variantes et propriétés — parents ET enfants internes
- **Variables** (4 collections) : ajout, suppression, modification de valeur
- **Text styles** (14 styles) : modification de font-size, font-weight, line-height, letter-spacing
- **Pages** : ajout, suppression (hors pages séparateurs)

### Ce que le diff NE tracke PAS (V1)

- Padding/spacing/dimensions internes des composants quand ils ne sont PAS liés à une variable (la collection Responsive est sous-utilisée pour l'instant — beaucoup de composants utilisent des valeurs brutes)
- Corner radius, fills, strokes en valeur brute (non liés à une variable)
- Changements de typography DANS les layers internes d'un composant (seuls les text styles globaux sont suivis)
- Réorganisation des layers internes d'un composant
- Interactions et prototyping (non exposé par l'API)
- Descriptions de composants (non fiable via API REST)
- Changements purement visuels (repositionnement, recoloration locale)

Le designer complète manuellement les changements non détectés dans l'éditeur de patchnote avant publication.

---

## 14. Fonctionnalités futures (V2/V3) — à préparer dans l'architecture

Ces fonctionnalités ne sont PAS à implémenter maintenant, mais la structure de l'app doit les accueillir facilement :

### V2 — Notifications

- Webhook Microsoft Teams à la publication d'un patchnote
- Email newsletter (service TBD, probablement via N8N)
- Intégration N8N : la publication déclenche un webhook N8N qui dispatche les notifications

### V2 — Documentation / Storybook

Le but est d'ajouter une section `/docs` à l'app qui sert de **storybook** pour le design system :

- **Page index** (`/docs`) : liste de tous les composants publics avec leur screenshot, description courte, et nombre de variantes
- **Fiche composant** (`/docs/{componentName}`) : description détaillée, tableau des propriétés/variantes, screenshot de toutes les variantes, tokens utilisés, et lien vers Figma
- **Page de téléchargement** (`/docs/download`) : permet de télécharger un repo de règles d'utilisation des composants (fichiers `.md` par composant, pensés pour être utilisés comme contexte IA dans Cursor/Copilot). Le repo git contiendra un `.cursorrules` et des `.md` par composant expliquant comment les utiliser dans un projet. L'app affichera la commande `git clone` et un bouton de téléchargement zip.

### V3 — Tracking avancé

- Screenshots automatiques des variantes individuelles (pas juste le component set)
- Tracking des propriétés internes (padding, radius, fills) via la Plugin API Figma ou snapshots enrichis
- Webhook Figma natif (trigger sur LIBRARY_PUBLISH) pour automatiser la détection de merge
- Detection d'impact en cascade : si un token Brand change, lister tous les Alias et Mapped impactés

---

## 15. Checklist d'implémentation (ordre recommandé)

Voici l'ordre dans lequel implémenter, étape par étape :

### Phase 1 : Fondations

- [ ] Init projet Next.js 14+ avec App Router, Tailwind CSS, TypeScript
- [ ] Configurer Supabase : créer projet, exécuter le SQL des tables et policies
- [ ] Créer le bucket Storage `screenshots`
- [ ] Setup Supabase Auth : créer le compte admin dans le dashboard
- [ ] Implémenter `lib/supabase/server.ts` et `lib/supabase/client.ts`
- [ ] Implémenter le middleware de protection des routes
- [ ] Page `/login` fonctionnelle

### Phase 2 : Core — Figma & Diff

- [ ] Implémenter `lib/figma.ts` (client API Figma : branches, file tree, variables, image export)
- [ ] Implémenter `lib/diff.ts` (algorithme de diff complet)
- [ ] API route `GET /api/figma/branches`
- [ ] API route `POST /api/diff/generate` (snapshot + diff + screenshots + IA)
- [ ] Implémenter `lib/ai.ts` avec les deux providers (OpenAI et Anthropic)
- [ ] Implémenter `lib/patchnote-template.ts` (prompt système)

### Phase 3 : CRUD Versions

- [ ] API routes CRUD `/api/versions`
- [ ] API route `/api/versions/[id]` (GET, PATCH, DELETE)

### Phase 4 : Interface admin

- [ ] Layout global (Header, navigation)
- [ ] Page d'accueil admin avec les deux onglets
- [ ] Composant `BranchList` avec sélection et bouton "Comparer"
- [ ] Loader avec messages de progression
- [ ] Page d'édition du patchnote (`/versions/[id]/edit`)
- [ ] Composant `DiffItemList` (affichage des changements)
- [ ] Composant `ScreenshotComparison` (avant/après)
- [ ] Composant `PatchnoteEditor` (textarea markdown + preview)
- [ ] Boutons Publier / Draft / Supprimer

### Phase 5 : Vue publique

- [ ] Page `/changelog` (liste des versions publiées)
- [ ] Page `/changelog/[versionNumber]` (détail avec sidebar)
- [ ] Rendu markdown → HTML avec `react-markdown`
- [ ] Barre de recherche sur le changelog
- [ ] Intégration des screenshots dans le rendu

### Phase 6 : Polish

- [ ] Responsive mobile (lecture changelog)
- [ ] Favicon et meta tags
- [ ] Déploiement Vercel
- [ ] Variables d'environnement dans Vercel

---

## 16. Notes techniques pour Cursor

- Utiliser `fetch` natif pour les appels API Figma (pas besoin de librairie)
- Pour le rendu markdown : `react-markdown` + `remark-gfm` + `rehype-raw`
- Pour les dates relatives : `date-fns` avec locale `fr`
- Le middleware Supabase Auth doit utiliser `@supabase/ssr` pour Next.js App Router
- Les API routes qui appellent Figma peuvent être lentes (5-15s) — implémenter un feedback de progression côté client (polling ou streaming)
- Les images Figma sont des URLs temporaires (14 jours) : **toujours les télécharger et les re-uploader dans Supabase Storage** immédiatement après l'export
- Pour la conversion des couleurs Figma (RGBA 0-1) en hex : `Math.round(r * 255).toString(16).padStart(2, '0')` etc.

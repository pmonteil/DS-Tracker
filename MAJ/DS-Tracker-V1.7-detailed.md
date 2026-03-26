# DS Tracker — Évolutions V1.7 : Spécification détaillée

> **Contexte pour Cursor** : DS Tracker est une application Next.js 14+ (App Router) avec Tailwind CSS, Supabase (auth + BDD + storage), et l'API Figma. L'app permet à un designer de tracker les changements d'un Design System Figma entre branches et main, de générer des patchnotes, et de les publier pour que les développeurs puissent suivre les évolutions. L'app a un thème sombre (fond slate-900, cartes blanches). Supabase est piloté via le MCP Supabase.

---

## Architecture existante (ce qui existe déjà)

### Stack
- **Framework** : Next.js 14+ avec App Router (`app/` directory)
- **Styling** : Tailwind CSS, thème sombre (bg-slate-900 pour les pages admin, cartes blanches)
- **Auth** : Supabase Auth (email/password)
- **BDD** : Supabase PostgreSQL
- **IA** : OpenAI API (GPT-4o-mini) pour la génération de patchnotes
- **Design source** : Figma REST API pour les composants et pages, screenshots via export d'images

### Tables Supabase existantes
- `versions` : stocke les patchnotes (id, version_number, title, status, patchnote_md, diff_json, summary, branch_name, branch_key, figma_file_key, created_at, published_at, created_by)
- `diff_items` : détail de chaque changement détecté (id, version_id, category, change_type, item_name, old_value, new_value, is_breaking, is_internal, parent_component, family_page, description, screenshot_before, screenshot_after, excluded, sort_order)
- `snapshots` : cache des snapshots Figma

### Pages existantes
- `/login` : page de connexion (email + password), avec onglet "Demander un accès" pour l'inscription
- `/` : page d'accueil admin — sélection de branche Figma, génération du diff
- `/versions/[id]/edit` : édition du patchnote avant publication (diff items, screenshots, titre, résumé IA)
- `/changelog` : liste publique des patchnotes publiés (accessible sans auth pour les devs)
- `/changelog/[versionNumber]` : détail d'un patchnote publié

### Composants existants
- `Header` : barre de navigation en haut (DS Tracker / Real Estate UI / Changelog / Équipe)
- `AnimatedBackground` : fond animé avec des gradients radiaux qui flottent
- Composants de diff : `DiffItemList`, `ComponentDiffDetail`, `VariableDiffDetail`, `ScreenshotComparison`, etc.

---

## Évolution 1 : Fix UX — Page de login, hauteur stable entre onglets

### Contexte
La page `/login` a deux onglets : "Connexion" et "Demander un accès". Le formulaire d'inscription (3 champs : prénom, email, mot de passe + sélecteur d'équipe) est plus haut que le formulaire de connexion (2 champs : email, mot de passe). Quand l'utilisateur switch entre les onglets, le formulaire saute verticalement parce que le conteneur est centré verticalement (`items-center`), et comme la hauteur du contenu change, tout se décale.

### Ce qu'il faut faire
1. Ouvrir le fichier de la page de login (probablement `app/login/page.tsx`)
2. Trouver le conteneur qui centre le formulaire verticalement (probablement un `div` avec `items-center` et `justify-center` ou `min-h-screen` + flexbox centré)
3. Remplacer le centrage vertical par un alignement en haut avec un padding-top fixe

### Code attendu
```tsx
// AVANT (ce qui cause le saut) :
<div className="min-h-screen flex items-center justify-center">
  <Card>...</Card>
</div>

// APRÈS (stable) :
<div className="min-h-screen flex items-start justify-center pt-[18vh]">
  <div className="w-full max-w-md">
    {/* Onglets Connexion / Demander un accès */}
    {/* Le formulaire est dans un div avec une min-height fixe */}
    <div className="min-h-[420px]">
      {activeTab === 'login' ? <LoginForm /> : <RegisterForm />}
    </div>
  </div>
</div>
```

Le `pt-[18vh]` place le haut du formulaire à ~18% de la hauteur de l'écran, fixe. Le `min-h-[420px]` correspond à la hauteur du formulaire le plus grand (inscription) — comme ça le conteneur ne change jamais de taille, et rien ne saute.

---

## Évolution 2 : Fix UX — Navbar qui disparaît au clic

### Contexte
Quand l'utilisateur clique sur un lien dans la barre de navigation en haut (Header), la navbar disparaît brièvement puis réapparaît. C'est causé par un re-render complet du layout lors de la navigation, probablement parce que le Header est rendu à l'intérieur d'un composant qui se démonte/remonte à chaque changement de route.

### Ce qu'il faut faire
1. Vérifier que dans `app/layout.tsx` (le layout racine), le composant `<Header />` est rendu DIRECTEMENT dans le layout, PAS à l'intérieur des pages individuelles
2. Si le Header est un Server Component qui fait un appel Supabase pour vérifier l'auth, le convertir en Client Component qui utilise `useEffect` pour charger l'état d'auth après le render initial — comme ça le HTML du header est affiché immédiatement
3. Ajouter `transition-all duration-200` sur les liens de navigation pour des transitions fluides

### Code attendu pour le layout racine
```tsx
// app/layout.tsx
import { Header } from '@/components/layout/Header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {/* Le Header est ICI, au niveau du layout racine, pas dans les pages */}
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

### Code attendu pour le Header
```tsx
// components/layout/Header.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Ne PAS bloquer le render initial sur l'auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Ne pas afficher le header sur la page de login
  if (pathname === '/login') return null;

  const navItems = [
    { href: '/changelog', label: 'Changelog' },
    { href: '/team', label: 'Équipe' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/85 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm font-semibold text-slate-200 hover:text-white transition-colors">
            DS Tracker
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-400">Real Estate UI</span>
        </div>
        
        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative px-3 py-1.5 rounded-lg text-sm transition-all duration-200
                ${pathname.startsWith(item.href)
                  ? 'text-white bg-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }
              `}
            >
              {item.label}
              {/* Pastille de notification pour Changelog — voir Évolution 5 */}
              {item.href === '/changelog' && unreadCount > 0 && (
                <span 
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400 animate-pulse"
                  style={{ boxShadow: '0 0 8px rgba(251,146,60,0.6)' }}
                />
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
```

---

## Évolution 3 : Inscription — Mot de passe visible + Sélection d'équipe

### Contexte
Le formulaire "Demander un accès" sur la page `/login` permet aux développeurs de créer un compte. Actuellement il a les champs Prénom, Email et Mot de passe. Il faut ajouter :
1. Un bouton "œil" pour voir/masquer le mot de passe
2. Un sélecteur d'équipe avec des pastilles colorées lumineuses

Les équipes sont les suivantes (cette liste est FIXE et ne changera pas) :
- Modelo Office (bleu `#3B82F6`)
- Modelo Legal (violet `#8B5CF6`)
- Modelo Insight/InTouch (cyan `#06B6D4`)
- Cadastre (amber `#F59E0B`)
- Marketing (pink `#EC4899`)
- Direction (emerald `#10B981`)
- Autre (gray `#6B7280`)

### Modifications BDD nécessaires AVANT l'implémentation UI

Exécuter ces requêtes SQL dans Supabase (via le MCP Supabase ou le SQL Editor) :

```sql
-- ==============================================
-- TABLE PROFILES : stocke les infos des utilisateurs
-- ==============================================
-- Cette table est liée à auth.users via l'id
-- Elle stocke le prénom, l'email, l'équipe, et l'avatar

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  team TEXT DEFAULT 'autre' CHECK (team IN (
    'modelo_office', 'modelo_legal', 'modelo_insight', 
    'cadastre', 'marketing', 'direction', 'autre'
  )),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger : quand un nouvel utilisateur s'inscrit via Supabase Auth,
-- créer automatiquement une ligne dans profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Créer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Pour les utilisateurs qui existent DÉJÀ (créés avant cette migration),
-- créer leur profil avec l'équipe "autre"
INSERT INTO profiles (id, email, team)
SELECT id, email, 'autre' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les profils (pour afficher les avatars)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

-- Chaque utilisateur peut modifier SON profil uniquement
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### Implémentation UI

#### Constante des équipes (à créer dans un fichier partagé)

Créer le fichier `lib/teams.ts` :

```typescript
// lib/teams.ts
// Liste des équipes avec leurs couleurs — utilisée dans le formulaire d'inscription,
// les avatars, le profil utilisateur, etc.

export const TEAMS = [
  { value: 'modelo_office', label: 'Modelo Office', color: '#3B82F6' },
  { value: 'modelo_legal', label: 'Modelo Legal', color: '#8B5CF6' },
  { value: 'modelo_insight', label: 'Modelo Insight/InTouch', color: '#06B6D4' },
  { value: 'cadastre', label: 'Cadastre', color: '#F59E0B' },
  { value: 'marketing', label: 'Marketing', color: '#EC4899' },
  { value: 'direction', label: 'Direction', color: '#10B981' },
  { value: 'autre', label: 'Autre', color: '#6B7280' },
] as const;

export type TeamValue = typeof TEAMS[number]['value'];

export function getTeamByValue(value: string) {
  return TEAMS.find(t => t.value === value) || TEAMS[TEAMS.length - 1]; // fallback "autre"
}
```

#### Composant TeamSelect (dropdown custom avec pastilles lumineuses)

Créer `components/ui/TeamSelect.tsx`. On ne peut PAS utiliser un `<select>` HTML natif car les `<option>` ne supportent pas de contenu custom (pastilles colorées). Il faut un dropdown custom.

```tsx
// components/ui/TeamSelect.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { TEAMS } from '@/lib/teams';

interface TeamSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function TeamSelect({ value, onChange }: TeamSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TEAMS.find(t => t.value === value);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Bouton qui ouvre le dropdown */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-left hover:border-white/20 transition-colors"
      >
        {selected ? (
          <>
            {/* Pastille lumineuse */}
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: selected.color,
                boxShadow: `0 0 8px ${selected.color}80`, // 80 = 50% opacité pour le glow
              }}
            />
            <span className="text-white">{selected.label}</span>
          </>
        ) : (
          <span className="text-slate-500">Choisir une équipe...</span>
        )}
        <ChevronDown size={14} className="ml-auto text-slate-400" />
      </button>

      {/* Menu dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
          {TEAMS.map(team => (
            <button
              key={team.value}
              type="button"
              onClick={() => {
                onChange(team.value);
                setOpen(false);
              }}
              className={`
                w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
                ${team.value === value
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                }
              `}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: team.color,
                  boxShadow: `0 0 8px ${team.color}80`,
                }}
              />
              {team.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Modifier le formulaire d'inscription

Dans le fichier de la page login (probablement `app/login/page.tsx`), modifier le formulaire "Demander un accès" :

```tsx
// Dans le formulaire d'inscription, ajouter :
const [showPassword, setShowPassword] = useState(false);
const [team, setTeam] = useState('');

// Le champ mot de passe avec toggle visibilité :
<div>
  <label className="text-sm text-slate-300 mb-1.5 block">Mot de passe</label>
  <div className="relative">
    <input
      type={showPassword ? 'text' : 'password'}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white pr-10"
      placeholder="••••••••"
    />
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>
</div>

// Le sélecteur d'équipe (APRÈS le champ mot de passe) :
<div>
  <label className="text-sm text-slate-300 mb-1.5 block">Équipe</label>
  <TeamSelect value={team} onChange={setTeam} />
</div>
```

#### Modifier la logique d'inscription pour sauvegarder l'équipe

Après le `signUp` de Supabase Auth, mettre à jour le profil :

```typescript
const handleRegister = async () => {
  // 1. Créer le compte via Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    // Afficher l'erreur à l'utilisateur
    setError(error.message);
    return;
  }

  // 2. Le trigger handle_new_user() a automatiquement créé une ligne dans profiles
  // Maintenant on met à jour avec le prénom et l'équipe
  if (data.user) {
    await supabase.from('profiles').update({
      first_name: firstName,
      team: team || 'autre',
    }).eq('id', data.user.id);
  }

  // 3. Rediriger ou afficher un message de succès
};
```

---

## Évolution 4 : Pastille "nouveau" sur les patchnotes non lus

### Contexte
Quand un nouveau patchnote est publié, les développeurs doivent le savoir. Actuellement, il n'y a aucune indication visuelle qu'un nouveau patchnote est disponible. On veut :
1. Une pastille orange clignotante dans la navbar sur l'onglet "Changelog" tant qu'il y a des patchnotes non lus
2. Une pastille orange sur chaque patchnote non lu dans la liste `/changelog`
3. Quand l'utilisateur OUVRE un patchnote (visite la page `/changelog/[version]`), il est marqué comme lu

### Modifications BDD

```sql
-- ==============================================
-- TABLE VERSION_READS : quel user a lu quel patchnote
-- ==============================================
-- Quand un user ouvre un patchnote, on insère une ligne ici
-- Si la ligne n'existe pas pour un couple (user, version), le patchnote est "non lu"

CREATE TABLE IF NOT EXISTS version_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, version_id)  -- Un user ne peut lire un patchnote qu'une fois
);

ALTER TABLE version_reads ENABLE ROW LEVEL SECURITY;

-- Chaque user peut voir ses propres lectures
CREATE POLICY "version_reads_select_own" ON version_reads
  FOR SELECT USING (auth.uid() = user_id);

-- Chaque user peut marquer un patchnote comme lu
CREATE POLICY "version_reads_insert_own" ON version_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==============================================
-- FONCTION RPC : compter les patchnotes non lus pour un user
-- ==============================================
-- Appelée depuis le Header pour afficher la pastille

CREATE OR REPLACE FUNCTION get_unread_versions_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM versions v
  WHERE v.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM version_reads vr
    WHERE vr.version_id = v.id 
    AND vr.user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### Implémentation

#### Dans le Header : afficher le compteur de non lus

Le Header (voir Évolution 2) doit appeler la fonction RPC pour obtenir le nombre de patchnotes non lus :

```typescript
// Dans le Header, ajouter :
useEffect(() => {
  if (!user) return;
  const supabase = createClient();
  supabase.rpc('get_unread_versions_count', { p_user_id: user.id })
    .then(({ data }) => setUnreadCount(data || 0));
}, [user]);
```

La pastille est déjà dans le code du Header (voir Évolution 2).

#### Dans la page `/changelog` : pastille sur chaque patchnote non lu

```typescript
// Dans la page /changelog/page.tsx, récupérer la liste des versions lues par l'user
const [readVersionIds, setReadVersionIds] = useState<string[]>([]);

useEffect(() => {
  if (!user) return;
  supabase.from('version_reads')
    .select('version_id')
    .eq('user_id', user.id)
    .then(({ data }) => {
      setReadVersionIds(data?.map(d => d.version_id) || []);
    });
}, [user]);

// Dans le rendu de chaque version :
const isUnread = user && !readVersionIds.includes(version.id);

// Afficher la pastille :
{isUnread && (
  <span 
    className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0"
    style={{ boxShadow: '0 0 6px rgba(251,146,60,0.5)' }}
  />
)}
```

#### Dans la page `/changelog/[versionNumber]` : marquer comme lu à l'ouverture

```typescript
// Dans la page du patchnote, ajouter un useEffect :
useEffect(() => {
  if (!user || !version) return;
  const supabase = createClient();
  // upsert = insert si n'existe pas, ignore si existe déjà
  supabase.from('version_reads').upsert(
    { user_id: user.id, version_id: version.id },
    { onConflict: 'user_id,version_id' }
  );
}, [user, version]);
```

---

## Évolution 5 : Suivi d'intégration par utilisateur

### Contexte
C'est la feature la plus complexe de cette version. L'idée : quand un développeur consulte un patchnote, il peut cocher individuellement chaque changement pour indiquer qu'il l'a intégré dans son code. C'est personnel — chaque dev a sa propre progression, qui n'affecte pas les autres.

Quand il a tout coché, il peut "clôturer" son intégration. Les autres utilisateurs voient alors son avatar sur le patchnote, indiquant qu'il a terminé.

### Modifications BDD

```sql
-- ==============================================
-- TABLE INTEGRATION_PROGRESS : progression item par item
-- ==============================================
-- Chaque ligne = un dev a coché (ou décoché) un item spécifique
-- C'est PERSONNEL : chaque user a sa propre progression

CREATE TABLE IF NOT EXISTS integration_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  diff_item_id UUID NOT NULL REFERENCES diff_items(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, diff_item_id)  -- Un user ne peut avoir qu'un état par item
);

ALTER TABLE integration_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_progress_select_own" ON integration_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "integration_progress_all_own" ON integration_progress
  FOR ALL USING (auth.uid() = user_id);

-- ==============================================
-- TABLE INTEGRATION_COMPLETIONS : clôture globale d'un patchnote
-- ==============================================
-- Quand un dev a tout coché et clique "Clôturer", une ligne est créée ici
-- VISIBLE PAR TOUS : les autres voient qui a terminé (avatars)

CREATE TABLE IF NOT EXISTS integration_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, version_id)
);

ALTER TABLE integration_completions ENABLE ROW LEVEL SECURITY;

-- TOUT LE MONDE peut voir qui a terminé (pour afficher les avatars)
CREATE POLICY "integration_completions_select_all" ON integration_completions
  FOR SELECT USING (true);

-- Chaque user gère sa propre complétion
CREATE POLICY "integration_completions_all_own" ON integration_completions
  FOR ALL USING (auth.uid() = user_id);
```

### Implémentation UI

#### Composant IntegrationCheckbox (bouton flottant par bloc)

Ce composant est affiché à côté de chaque bloc de changement dans la page `/changelog/[versionNumber]`. Il est visible uniquement si l'utilisateur est connecté.

Créer `components/changelog/IntegrationCheckbox.tsx` :

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Check, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface IntegrationCheckboxProps {
  diffItemId: string;
  versionId: string;
  userId: string;  // L'id de l'utilisateur connecté
  onToggle?: (completed: boolean) => void;  // Callback pour mettre à jour le compteur parent
}

export function IntegrationCheckbox({ diffItemId, versionId, userId, onToggle }: IntegrationCheckboxProps) {
  const [completed, setCompleted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const supabase = createClient();

  // Charger l'état initial depuis la BDD
  useEffect(() => {
    supabase
      .from('integration_progress')
      .select('completed')
      .eq('user_id', userId)
      .eq('diff_item_id', diffItemId)
      .single()
      .then(({ data }) => {
        if (data) setCompleted(data.completed);
      });
  }, [userId, diffItemId]);

  const toggle = async () => {
    const newState = !completed;
    setCompleted(newState);
    onToggle?.(newState);

    // Animation de succès quand on coche
    if (newState) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }

    // Sauvegarder en BDD
    await supabase.from('integration_progress').upsert(
      {
        user_id: userId,
        version_id: versionId,
        diff_item_id: diffItemId,
        completed: newState,
        completed_at: newState ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,diff_item_id' }
    );
  };

  return (
    <button
      onClick={toggle}
      className={`
        w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 relative
        ${completed
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-white/[0.06] text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400'
        }
      `}
      title={completed ? 'Marquer comme non fait' : 'Marquer comme intégré'}
    >
      {completed ? <Check size={14} strokeWidth={2.5} /> : <Circle size={14} />}

      {/* Animation "ping" au moment du check */}
      {animating && (
        <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-[ping-once_0.6s_ease-out_forwards]" />
      )}
    </button>
  );
}
```

Ajouter l'animation dans `tailwind.config.ts` :

```typescript
// Dans extend.keyframes :
'ping-once': {
  '0%': { transform: 'scale(1)', opacity: '0.6' },
  '100%': { transform: 'scale(2.5)', opacity: '0' },
},
// Dans extend.animation — PAS nécessaire si on utilise la syntaxe arbitraire animate-[...]
```

#### Intégration dans la page du patchnote

Dans la page `/changelog/[versionNumber]/page.tsx`, chaque bloc de changement doit :
1. Avoir le bouton `IntegrationCheckbox` flottant à sa droite
2. Baisser en opacité quand complété
3. Pouvoir être re-toggle

```tsx
// Pour chaque bloc de changement :
<div className={`
  relative group transition-opacity duration-500
  ${isItemCompleted(item.id) ? 'opacity-40' : 'opacity-100'}
`}>
  {/* Contenu du bloc (ce qui existe déjà) */}
  <div className="bg-white rounded-2xl p-5 ...">
    {/* ... */}
  </div>

  {/* Bouton flottant à droite — VISIBLE UNIQUEMENT si l'user est connecté */}
  {user && (
    <div className="absolute -right-12 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
      <IntegrationCheckbox
        diffItemId={item.id}
        versionId={version.id}
        userId={user.id}
        onToggle={(completed) => handleItemToggle(item.id, completed)}
      />
    </div>
  )}
</div>
```

#### Barre de progression sticky en bas

Quand l'utilisateur est connecté et qu'il a commencé à cocher des items, afficher une barre de progression en bas de la page :

Créer `components/changelog/IntegrationBar.tsx` :

```tsx
'use client';

interface IntegrationBarProps {
  totalItems: number;
  completedItems: number;
  onSave: () => void;
  onComplete: () => void;
}

export function IntegrationBar({ totalItems, completedItems, onSave, onComplete }: IntegrationBarProps) {
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Ne pas afficher si aucun item n'a été coché
  if (completedItems === 0) return null;

  return (
    <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/[0.06] px-6 py-4 z-40">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        {/* Barre de progression visuelle */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{completedItems}/{totalItems} intégrés</span>
            <span>{percentage}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Bouton Enregistrer — toujours visible */}
        <button
          onClick={onSave}
          className="px-4 py-2 bg-white/[0.08] text-slate-200 rounded-xl text-sm border border-white/10 hover:bg-white/[0.12] transition-colors"
        >
          Enregistrer
        </button>

        {/* Bouton Clôturer — visible UNIQUEMENT quand tout est coché (100%) */}
        {percentage === 100 && (
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            Clôturer l'intégration ✓
          </button>
        )}
      </div>
    </div>
  );
}
```

#### Logique de clôture

Quand l'utilisateur clique "Clôturer l'intégration" :

```typescript
const handleComplete = async () => {
  await supabase.from('integration_completions').upsert(
    {
      user_id: user.id,
      version_id: version.id,
      status: 'completed',
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,version_id' }
  );
  // Rafraîchir les données pour afficher l'avatar
};
```

---

## Évolution 6 : Avatars des utilisateurs ayant terminé l'intégration

### Contexte
Sur chaque patchnote (dans la page ET dans la liste), on affiche les avatars (petits cercles avec l'initiale du prénom, couleur de l'équipe) des utilisateurs qui ont clôturé l'intégration. Au survol d'un avatar, un tooltip affiche le nom complet et l'équipe.

Ces avatars sont **visibles par tous** — c'est le seul élément du suivi d'intégration qui est partagé.

### Composant CompletedAvatars

Créer `components/changelog/CompletedAvatars.tsx` :

```tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTeamByValue } from '@/lib/teams';

interface CompletedAvatarsProps {
  versionId: string;
}

interface CompletedUser {
  first_name: string | null;
  email: string;
  team: string;
}

export function CompletedAvatars({ versionId }: CompletedAvatarsProps) {
  const [users, setUsers] = useState<CompletedUser[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Récupérer les users qui ont clôturé l'intégration de ce patchnote
    // En joignant la table profiles pour avoir le nom et l'équipe
    supabase
      .from('integration_completions')
      .select(`
        user_id,
        profiles:user_id (first_name, email, team)
      `)
      .eq('version_id', versionId)
      .eq('status', 'completed')
      .then(({ data }) => {
        if (data) {
          const parsed = data
            .map((d: any) => d.profiles)
            .filter(Boolean) as CompletedUser[];
          setUsers(parsed);
        }
      });
  }, [versionId]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center">
      {/* Avatars empilés */}
      <div className="flex -space-x-1.5">
        {users.map((user, i) => {
          const team = getTeamByValue(user.team);
          const initial = (user.first_name || user.email || '?')[0].toUpperCase();

          return (
            <div key={i} className="group relative">
              {/* Avatar circle */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-slate-900 cursor-default transition-transform hover:scale-110 hover:z-10"
                style={{ backgroundColor: team.color }}
              >
                {initial}
              </div>

              {/* Tooltip au survol */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg border border-white/10 z-50">
                <span className="font-medium">{user.first_name || user.email}</span>
                <span className="text-slate-400 ml-1.5">· {team.label}</span>
                {/* Petite flèche en bas du tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                  <div className="w-2 h-2 bg-slate-800 border-r border-b border-white/10 transform rotate-45" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Texte résumé */}
      <span className="text-xs text-slate-500 ml-2.5">
        {users.length} intégration{users.length > 1 ? 's' : ''} terminée{users.length > 1 ? 's' : ''}
      </span>
    </div>
  );
}
```

### Où placer les avatars

1. **Dans la page du patchnote** (`/changelog/[versionNumber]`) : sous le titre, à côté de la date
```tsx
<div className="flex items-center gap-4 mt-2">
  <span className="text-sm text-slate-400">Publié le {formatDate(version.published_at)}</span>
  <CompletedAvatars versionId={version.id} />
</div>
```

2. **Dans la liste des changelogs** (`/changelog`) : à droite de chaque ligne
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    {/* Pastille non-lu + version + titre */}
  </div>
  <div className="flex items-center gap-3">
    <CompletedAvatars versionId={version.id} />
    <span className="text-sm text-slate-500">{formatRelativeDate(version.published_at)}</span>
  </div>
</div>
```

---

## Récapitulatif — Ordre d'implémentation recommandé

Faire ces étapes dans l'ordre, en validant chaque étape avant de passer à la suivante :

### Étape 1 : BDD (via MCP Supabase ou SQL Editor)
Exécuter TOUTES les requêtes SQL ci-dessus dans l'ordre :
1. Table `profiles` + trigger + migration users existants + RLS
2. Table `version_reads` + RLS + fonction RPC
3. Table `integration_progress` + RLS
4. Table `integration_completions` + RLS

### Étape 2 : Fichier partagé
- Créer `lib/teams.ts` avec la constante TEAMS

### Étape 3 : Login/Register
- Fix hauteur stable entre onglets
- Toggle visibilité mot de passe
- Composant `TeamSelect` avec pastilles lumineuses
- Modifier la logique d'inscription pour sauvegarder l'équipe

### Étape 4 : Navbar
- Fix re-render (Header dans le layout racine, client component)
- Pastille orange clignotante avec le compteur de non lus

### Étape 5 : Notifications "non lu"
- Récupérer les versions lues dans `/changelog`
- Pastille sur chaque patchnote non lu
- Marquer comme lu à l'ouverture d'un patchnote

### Étape 6 : Suivi d'intégration
- Composant `IntegrationCheckbox`
- Intégration dans la page du patchnote (bouton flottant par bloc)
- Animation de succès
- Opacité réduite sur les blocs complétés
- Composant `IntegrationBar` (barre de progression sticky)
- Logique de clôture

### Étape 7 : Avatars
- Composant `CompletedAvatars`
- Placement dans la page du patchnote et la liste des changelogs

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ExternalLink, AlertTriangle, Pencil } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { DiffItemList } from '@/components/versions/DiffItemList';
import { VersionSidebar } from '@/components/changelog/VersionSidebar';
import { createClient } from '@/lib/supabase/client';
import type { Version, DiffItem } from '@/lib/types';

function cleanVersionTitle(version: Version): string {
  let t = version.title;
  const vn = version.version_number;
  for (const sep of [' — ', ' - ', '—', '-']) {
    if (t.startsWith(vn + sep)) {
      t = t.slice((vn + sep).length);
      break;
    }
  }
  return t.replace(/^\[.*?\]\s*/, '').trim() || t;
}

export default function VersionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const versionNumber = decodeURIComponent(params.versionNumber as string);

  const [version, setVersion] = useState<Version | null>(null);
  const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
  const [allVersions, setAllVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        setIsAdmin(profile?.role === 'admin');
      }
    };
    checkAdmin();
  }, []);

  const fetchData = useCallback(async () => {
    const versionsRes = await fetch('/api/versions?public=true');
    const versionsData = await versionsRes.json();
    const versions: Version[] = versionsData.versions ?? [];
    setAllVersions(versions);

    const matched = versions.find((v) => v.version_number === versionNumber);
    if (matched) {
      const detailRes = await fetch(`/api/versions/${matched.id}`);
      const detailData = await detailRes.json();
      setVersion(detailData.version);
      setDiffItems(detailData.diffItems ?? []);
    }

    setLoading(false);
  }, [versionNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasBreaking = diffItems.some((item) => item.is_breaking && !item.excluded);
  const visibleItems = diffItems.filter((d) => !d.excluded);

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <Loader message="Chargement..." />
      </div>
    );
  }

  if (!version) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-sm text-slate-300">Version introuvable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-2xl font-semibold text-slate-100">
                {version.version_number} — {cleanVersionTitle(version)}
              </h1>
            </div>

            <div className="flex items-center gap-3 mb-6">
              {version.published_at && (
                <span className="text-sm text-slate-300">
                  Publié le{' '}
                  {format(new Date(version.published_at), 'd MMMM yyyy', {
                    locale: fr,
                  })}
                </span>
              )}
              {hasBreaking && <Badge variant="warning">Breaking changes</Badge>}
              <a
                href="https://www.figma.com/design/9ZjzJGJ07zCiTHMpbXB2j2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-200 transition-colors"
              >
                Voir dans Figma
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
            </div>

            {/* Résumé */}
            {version.summary && (
              <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-5 mb-8 text-sm text-slate-200 leading-relaxed">
                {version.summary}
              </div>
            )}

            {/* Breaking changes callout */}
            {hasBreaking && (
              <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 mb-8">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="text-sm text-amber-300/90 leading-relaxed">
                  <strong className="font-semibold text-amber-200">Attention — Breaking changes</strong>
                  <p className="mt-1">
                    Cette version contient des changements non rétro-compatibles.
                    Consultez le détail ci-dessous pour adapter votre code.
                  </p>
                </div>
              </div>
            )}

            {/* Compteur */}
            <div className="mb-4">
              <span className="text-sm font-medium text-slate-500">
                {visibleItems.length} changement{visibleItems.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Diff items en mode lecture seule - identique à l'éditeur */}
            <DiffItemList
              items={diffItems}
              readOnly
              variableScreenshots={version.variable_screenshots}
              customBlocks={version.custom_blocks}
            />

            {/* Bouton Modifier pour admin */}
            {isAdmin && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => router.push(`/versions/${version.id}/edit`)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-300 hover:text-white border border-white/[0.12] hover:border-white/[0.22] bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Modifier ce patchnote
                </button>
              </div>
            )}
          </div>

          <VersionSidebar
            versions={allVersions}
            currentVersionNumber={version.version_number}
          />
        </div>
      </main>
    </div>
  );
}

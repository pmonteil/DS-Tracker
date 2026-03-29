'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, Search, Trash2 } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { CompletedAvatars } from '@/components/changelog/CompletedAvatars';
import type { Version, DiffItem } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

function cleanTitle(version: Version): string {
  let t = version.title;
  const vn = version.version_number;
  const patterns = [
    `${vn} — `,
    `${vn} - `,
    `${vn}—`,
    `${vn}-`,
  ];
  for (const p of patterns) {
    if (t.startsWith(p)) {
      t = t.slice(p.length);
      break;
    }
  }
  return t.replace(/^\[.*?\]\s*/, '').trim() || t;
}

export default function ChangelogPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Version | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [integratedVersionIds, setIntegratedVersionIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let admin = false;
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        admin = profile?.role === 'admin';

        const { data: integrated } = await supabase
          .from('integration_completions')
          .select('version_id')
          .eq('user_id', user.id)
          .eq('status', 'completed');
        if (integrated) {
          setIntegratedVersionIds(new Set(integrated.map((r) => r.version_id)));
        }
      }
      setIsAdmin(admin);

      const params = new URLSearchParams();
      if (!admin) params.set('public', 'true');
      const res = await fetch(`/api/versions?${params}`);
      const data = await res.json();
      setVersions(data.versions ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/versions/${deleteTarget.id}`, { method: 'DELETE' });
    setVersions((prev) => prev.filter((v) => v.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const sorted = [...versions].sort((a, b) => {
    if (a.status === 'draft' && b.status !== 'draft') return -1;
    if (a.status !== 'draft' && b.status === 'draft') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filtered = sorted.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.version_number.toLowerCase().includes(q) ||
      v.title.toLowerCase().includes(q) ||
      v.patchnote_md?.toLowerCase().includes(q)
    );
  });

  const latestPublishedId = sorted.find((v) => v.status === 'published')?.id ?? null;

  const hasBreaking = (v: Version) =>
    (v.diff_json as DiffItem[] | null)?.some((item) => item.is_breaking) ?? false;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 max-w-3xl w-full mx-auto px-6 pt-8 pb-2">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-medium text-slate-100">Changelog</h1>
            <p className="text-sm text-slate-300 mt-1">
              Historique des versions du Design System Real Estate UI
            </p>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/[0.15] transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 pb-8">
        {loading ? (
          <Loader message="Chargement..." />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-300 text-center py-12">
            {search ? 'Aucun résultat' : 'Aucun patchnote'}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((version) => {
              const isDraft = version.status === 'draft';
              const isLatest = version.id === latestPublishedId;
              const href = isAdmin && isDraft
                ? `/versions/${version.id}/edit`
                : `/changelog/${version.version_number}`;

              const isIntegrated =
                !isDraft && !isAdmin && currentUserId && integratedVersionIds.has(version.id);
              const isNotIntegrated =
                !isDraft && !isAdmin && currentUserId && !integratedVersionIds.has(version.id);

              return (
                <div
                  key={version.id}
                  className={`group/row flex items-center gap-0 rounded-xl transition-colors ${
                    isIntegrated ? 'opacity-[0.42] hover:opacity-[0.55]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <Link href={href} className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 py-3.5 px-4">
                      <div className="relative shrink-0 w-5 h-5 flex items-center justify-center">
                        {isDraft && (
                          <>
                            <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-40" />
                            <span className="relative block w-2.5 h-2.5 rounded-full bg-blue-400" />
                          </>
                        )}
                        {!isDraft && isIntegrated && (
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/35">
                            <Check className="w-3 h-3 text-emerald-400" strokeWidth={2.5} aria-hidden />
                          </span>
                        )}
                        {!isDraft && isNotIntegrated && (
                          <>
                            <span
                              className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse opacity-50"
                              style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }}
                            />
                            <span className="relative block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          </>
                        )}
                        {!isDraft && !isIntegrated && !isNotIntegrated && isLatest && (
                          <>
                            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
                            <span className="relative block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          </>
                        )}
                        {!isDraft && !isIntegrated && !isNotIntegrated && !isLatest && (
                          <span className="block w-2.5 h-2.5 rounded-full bg-slate-600" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-sm font-mono font-medium text-slate-200 shrink-0">
                          {version.version_number}
                        </span>
                        <span className="text-sm text-slate-300 truncate">
                          {cleanTitle(version)}
                        </span>
                        {hasBreaking(version) && (
                          <span className="text-amber-500 text-xs shrink-0">⚠️</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {!isDraft && (
                          <div className="hidden sm:block">
                            <CompletedAvatars versionId={version.id} />
                          </div>
                        )}
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(version.published_at || version.created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTarget(version);
                      }}
                      className="shrink-0 p-2 mr-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/[0.04] opacity-0 group-hover/row:opacity-100 transition-all cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Modale de confirmation de suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-medium text-slate-100 mb-2">
              Supprimer ce changelog ?
            </h3>
            <p className="text-sm text-slate-300 mb-1">
              <span className="font-mono text-slate-100">{deleteTarget.version_number}</span>
              {' — '}
              {cleanTitle(deleteTarget)}
            </p>
            <p className="text-xs text-slate-600 mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500/90 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
